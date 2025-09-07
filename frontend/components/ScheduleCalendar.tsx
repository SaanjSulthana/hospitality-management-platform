import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';

interface Schedule {
  id: number;
  staffId: number;
  staffName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  shiftType: 'day_shift' | 'night_shift' | 'split_shift' | 'overtime';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  isCompleted: boolean;
  actualStartTime?: string;
  actualEndTime?: string;
  notes?: string;
  hasConflict?: boolean;
  conflictReason?: string;
  createdAt: string;
}

interface ScheduleCalendarProps {
  staffId?: number;
  showAll?: boolean;
}

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ staffId, showAll = false }) => {
  const { getAuthenticatedBackend, user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // API Query
  const { data: schedules, isLoading, error } = useQuery({
    queryKey: ['schedules', staffId, currentWeek],
    queryFn: () => getAuthenticatedBackend().staff.schedules({
      staffId: staffId,
      startDate: format(startOfWeek(currentWeek), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(currentWeek), 'yyyy-MM-dd'),
      page: 1,
      limit: 100,
    }),
    refetchInterval: 30000, // 30 seconds
  });

  const formatTime = (time: string) => {
    return format(new Date(`2000-01-01T${time}`), 'h:mm a');
  };

  const getShiftTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      day_shift: 'Day',
      night_shift: 'Night',
      split_shift: 'Split',
      overtime: 'OT',
    };
    return labels[type] || type;
  };

  const getShiftTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      day_shift: 'bg-blue-100 text-blue-800 border-blue-200',
      night_shift: 'bg-purple-100 text-purple-800 border-purple-200',
      split_shift: 'bg-green-100 text-green-800 border-green-200',
      overtime: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'border-blue-300',
      in_progress: 'border-yellow-300',
      completed: 'border-green-300',
      cancelled: 'border-red-300',
    };
    return colors[status] || 'border-gray-300';
  };

  const getSchedulesForDate = (date: Date) => {
    if (!schedules?.schedules) return [];
    return schedules.schedules.filter((schedule: Schedule) => 
      isSameDay(parseISO(schedule.shiftDate), date)
    );
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Calendar className="h-8 w-8 animate-pulse mx-auto mb-4" />
          <p className="text-lg">Loading schedule calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Calendar</h3>
        <p className="text-muted-foreground">
          There was a problem loading the schedule calendar. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Schedule Calendar
          </h2>
          <p className="text-muted-foreground">
            Weekly view of staff schedules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Live updates
          </Badge>
        </div>
      </div>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(startOfWeek(currentWeek), 'MMM dd')} - {format(endOfWeek(currentWeek), 'MMM dd, yyyy')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
                className="p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
                className="p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile Calendar View */}
          {isMobile ? (
            <div className="space-y-4">
              {getWeekDays().map((day, index) => {
                const daySchedules = getSchedulesForDate(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                
                return (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg ${
                      isToday ? 'bg-blue-50 border-blue-200' : 
                      isSelected ? 'bg-gray-50 border-gray-300' : 
                      'bg-white border-gray-200'
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-lg">
                          {format(day, 'dd')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(day, 'EEE')}
                        </p>
                      </div>
                      {daySchedules.length > 0 && (
                        <Badge variant="secondary">
                          {daySchedules.length} shift{daySchedules.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    
                    {daySchedules.length > 0 && (
                      <div className="space-y-2">
                        {daySchedules.slice(0, 2).map((schedule: Schedule) => (
                          <div
                            key={schedule.id}
                            className={`p-2 rounded border-l-4 ${getShiftTypeColor(schedule.shiftType)} ${getStatusColor(schedule.status)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSchedule(schedule);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{schedule.staffName}</p>
                                <p className="text-xs">
                                  {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {getShiftTypeLabel(schedule.shiftType)}
                                </Badge>
                                {schedule.hasConflict && (
                                  <AlertCircle className="h-3 w-3 text-red-500" />
                                )}
                                {schedule.isCompleted && (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {daySchedules.length > 2 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{daySchedules.length - 2} more shifts
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Desktop Calendar View */
            <div className="grid grid-cols-7 gap-2">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-2 text-center font-semibold text-sm text-muted-foreground">
                  {day}
                </div>
              ))}
              
              {/* Day Cells */}
              {getWeekDays().map((day, index) => {
                const daySchedules = getSchedulesForDate(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                
                return (
                  <div
                    key={index}
                    className={`min-h-32 p-2 border rounded-lg ${
                      isToday ? 'bg-blue-50 border-blue-200' : 
                      isSelected ? 'bg-gray-50 border-gray-300' : 
                      'bg-white border-gray-200'
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-semibold ${isToday ? 'text-blue-600' : ''}`}>
                        {format(day, 'dd')}
                      </span>
                      {daySchedules.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {daySchedules.length}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      {daySchedules.slice(0, 3).map((schedule: Schedule) => (
                        <div
                          key={schedule.id}
                          className={`p-1 rounded text-xs border-l-2 ${getShiftTypeColor(schedule.shiftType)} ${getStatusColor(schedule.status)} cursor-pointer hover:opacity-80`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSchedule(schedule);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{schedule.staffName}</span>
                            <div className="flex items-center gap-1">
                              {schedule.hasConflict && (
                                <AlertCircle className="h-2 w-2 text-red-500" />
                              )}
                              {schedule.isCompleted && (
                                <CheckCircle className="h-2 w-2 text-green-500" />
                              )}
                            </div>
                          </div>
                          <p className="text-xs opacity-75">
                            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                          </p>
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{daySchedules.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Details Dialog */}
      <Dialog open={!!selectedSchedule} onOpenChange={() => setSelectedSchedule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Details
            </DialogTitle>
            <DialogDescription>
              {selectedSchedule?.staffName} - {format(new Date(selectedSchedule?.shiftDate || ''), 'MMM dd, yyyy')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSchedule && (
            <div className="space-y-4">
              {/* Schedule Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Shift Type</p>
                  <Badge className={getShiftTypeColor(selectedSchedule.shiftType)}>
                    {getShiftTypeLabel(selectedSchedule.shiftType)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline">
                    {selectedSchedule.status.charAt(0).toUpperCase() + selectedSchedule.status.slice(1).replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Scheduled Time</p>
                <p className="font-medium">
                  {formatTime(selectedSchedule.startTime)} - {formatTime(selectedSchedule.endTime)}
                </p>
              </div>

              {selectedSchedule.actualStartTime && (
                <div>
                  <p className="text-sm text-muted-foreground">Actual Time</p>
                  <p className="font-medium">
                    {formatTime(selectedSchedule.actualStartTime)} - {formatTime(selectedSchedule.actualEndTime || '')}
                  </p>
                </div>
              )}

              {selectedSchedule.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedSchedule.notes}</p>
                </div>
              )}

              {selectedSchedule.hasConflict && selectedSchedule.conflictReason && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-800">
                      <strong>Conflict:</strong> {selectedSchedule.conflictReason}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!selectedSchedule.isCompleted && (
                  <Button variant="outline" className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                )}
                <Button variant="outline" className="flex-1">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Request Change
                </Button>
                {user?.role === 'ADMIN' && (
                  <Button variant="outline" className="flex-1">
                    Edit
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Shift Type Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
              <span className="text-sm">Day Shift</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
              <span className="text-sm">Night Shift</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
              <span className="text-sm">Split Shift</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"></div>
              <span className="text-sm">Overtime</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleCalendar;
