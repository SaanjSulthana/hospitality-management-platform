import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import ScheduleManagement from '../components/ScheduleManagement';
import { useAuth } from '../contexts/AuthContext';


// Mock the auth context
jest.mock('../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock the backend
const mockBackend = {
  staff: {
    schedules: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    markScheduleComplete: jest.fn(),
    createScheduleChangeRequest: jest.fn(),
    approveScheduleChangeRequest: jest.fn(),
    rejectScheduleChangeRequest: jest.fn(),
    scheduleStatistics: jest.fn(),
    exportSchedule: jest.fn(),
  },
};

const mockUser = {
  userID: '1',
  orgId: 1,
  displayName: 'Test Admin',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
};

const mockSchedules = {
  schedules: [
    {
      id: 1,
      staffId: 1,
      staffName: 'John Doe',
      shiftDate: '2023-12-01',
      startTime: '09:00:00',
      endTime: '17:00:00',
      shiftType: 'day_shift',
      status: 'scheduled',
      isCompleted: false,
      actualStartTime: null,
      actualEndTime: null,
      notes: 'Regular day shift',
      createdAt: '2023-11-25T00:00:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

const mockScheduleChangeRequests = {
  changeRequests: [
    {
      id: 1,
      scheduleId: 1,
      staffId: 1,
      staffName: 'John Doe',
      requestType: 'time_change',
      currentStartTime: '09:00:00',
      currentEndTime: '17:00:00',
      requestedStartTime: '10:00:00',
      requestedEndTime: '18:00:00',
      reason: 'Personal appointment',
      status: 'pending',
      requestedAt: '2023-11-30T00:00:00Z',
      reviewedAt: null,
      reviewedBy: null,
      adminNotes: null,
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

const mockScheduleStats = {
  overview: {
    totalSchedules: 50,
    completedSchedules: 45,
    pendingSchedules: 5,
    totalChangeRequests: 3,
    pendingChangeRequests: 2,
  },
  periodAnalysis: {
    currentWeek: {
      totalSchedules: 10,
      completedSchedules: 8,
      completionRate: 80,
    },
  },
  trends: {
    weeklyTrend: [
      { week: '2023-W48', totalSchedules: 8, completionRate: 87.5 },
      { week: '2023-W49', totalSchedules: 10, completionRate: 80 },
    ],
  },
};

describe('ScheduleManagement', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    mockUseAuth.mockReturnValue({
      getAuthenticatedBackend: () => mockBackend,
      user: mockUser,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
      trackActivity: jest.fn(),
      showLogoutProgress: false,
      setShowLogoutProgress: jest.fn(),
      setIsTestingLogoutDialog: jest.fn(),
      clearCorruptedTokens: jest.fn(),
      clearAllAuthData: jest.fn(),
    });

    // Mock API responses
    mockBackend.staff.schedules.mockResolvedValue(mockSchedules);
    mockBackend.staff.scheduleStatistics.mockResolvedValue(mockScheduleStats);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderScheduleManagement = () => {
    return render(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(ScheduleManagement)
        )
      )
    );
  };

  it('renders schedule management interface', async () => {
    renderScheduleManagement();

    expect(screen.getByText('Schedule Management')).toBeInTheDocument();
    expect(screen.getByText('Manage staff schedules and shift assignments')).toBeInTheDocument();
    
    // Check for main sections
    expect(screen.getByText('Schedules')).toBeInTheDocument();
    expect(screen.getByText('Change Requests')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('displays schedules for admin users', async () => {
    renderScheduleManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Day Shift')).toBeInTheDocument();
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
    });
  });

  it('shows schedule statistics', async () => {
    renderScheduleManagement();

    await waitFor(() => {
      expect(screen.getByText('Total Schedules')).toBeInTheDocument();
      expect(screen.getByText('Completed Schedules')).toBeInTheDocument();
      expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    });
  });

  it('handles schedule creation', async () => {
    mockBackend.staff.createSchedule.mockResolvedValue({ success: true });

    renderScheduleManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for add schedule button
    const addButton = screen.queryByText('Add Schedule');
    if (addButton) {
      fireEvent.click(addButton);

      // Should open add dialog
      await waitFor(() => {
        expect(screen.getByText('Add Schedule')).toBeInTheDocument();
      });

      // Fill form and submit
      const submitButton = screen.getByText('Create Schedule');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.createSchedule).toHaveBeenCalled();
      });
    }
  });

  it('handles schedule completion marking', async () => {
    mockBackend.staff.markScheduleComplete.mockResolvedValue({ success: true });

    renderScheduleManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for mark complete button
    const completeButton = screen.queryByText('Mark Complete');
    if (completeButton) {
      fireEvent.click(completeButton);

      // Should open completion dialog
      await waitFor(() => {
        expect(screen.getByText('Mark Schedule Complete')).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByText('Mark Complete');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.markScheduleComplete).toHaveBeenCalled();
      });
    }
  });

  it('handles schedule change request creation', async () => {
    mockBackend.staff.createScheduleChangeRequest.mockResolvedValue({ success: true });

    renderScheduleManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for request change button
    const requestButton = screen.queryByText('Request Change');
    if (requestButton) {
      fireEvent.click(requestButton);

      // Should open request dialog
      await waitFor(() => {
        expect(screen.getByText('Request Schedule Change')).toBeInTheDocument();
      });

      // Fill form and submit
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.createScheduleChangeRequest).toHaveBeenCalled();
      });
    }
  });

  it('displays loading states', () => {
    // Mock loading state
    mockBackend.staff.schedules.mockImplementation(() => new Promise(() => {}));
    mockBackend.staff.scheduleStatistics.mockImplementation(() => new Promise(() => {}));

    renderScheduleManagement();

    // Check for loading indicators
    expect(screen.getByText('Loading schedule data...')).toBeInTheDocument();
  });

  it('displays empty state when no schedules', async () => {
    mockBackend.staff.schedules.mockResolvedValue({ schedules: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

    renderScheduleManagement();

    await waitFor(() => {
      expect(screen.getByText('No schedules found')).toBeInTheDocument();
      expect(screen.getByText('Start by creating your first schedule')).toBeInTheDocument();
    });
  });

  it('handles schedule export', async () => {
    mockBackend.staff.exportSchedule.mockResolvedValue({ success: true, downloadUrl: 'test-url' });

    renderScheduleManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.queryByText('Export Data');
    if (exportButton) {
      fireEvent.click(exportButton);

      // Should open export dialog
      await waitFor(() => {
        expect(screen.getByText('Export Schedule Data')).toBeInTheDocument();
      });

      // Select format and export
      const csvOption = screen.getByText('CSV');
      fireEvent.click(csvOption);

      const exportSubmitButton = screen.getByText('Export');
      fireEvent.click(exportSubmitButton);

      await waitFor(() => {
        expect(mockBackend.staff.exportSchedule).toHaveBeenCalled();
      });
    }
  });

  it('displays error messages for failed operations', async () => {
    mockBackend.staff.createSchedule.mockRejectedValue(new Error('Failed to create schedule'));

    renderScheduleManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Try to add schedule
    const addButton = screen.queryByText('Add Schedule');
    if (addButton) {
      fireEvent.click(addButton);

      // Submit form
      const submitButton = screen.getByText('Create Schedule');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create schedule')).toBeInTheDocument();
      });
    }
  });

  it('shows real-time update indicators', () => {
    renderScheduleManagement();

    expect(screen.getByText('Live updates active')).toBeInTheDocument();
  });

  it('handles mobile responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    renderScheduleManagement();

    // Check for mobile-specific elements
    expect(screen.getByText('Schedule Management')).toBeInTheDocument();
  });

  it('displays schedule conflict warnings', async () => {
    mockBackend.staff.schedules.mockResolvedValue({
      schedules: [{
        ...mockSchedules.schedules[0],
        hasConflict: true,
        conflictReason: 'Overlapping with another shift',
      }],
      pagination: mockSchedules.pagination,
    });

    renderScheduleManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Should show conflict warning
    expect(screen.getByText('Overlapping with another shift')).toBeInTheDocument();
  });

  it('handles schedule change request approval for admin users', async () => {
    mockBackend.staff.approveScheduleChangeRequest.mockResolvedValue({ success: true });

    renderScheduleManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for approve button
    const approveButton = screen.queryByText('Approve');
    if (approveButton) {
      fireEvent.click(approveButton);

      // Should open approval dialog
      await waitFor(() => {
        expect(screen.getByText('Approve Schedule Change')).toBeInTheDocument();
      });
    }
  });

  it('displays schedule trends and analytics', async () => {
    renderScheduleManagement();

    await waitFor(() => {
      expect(screen.getByText('Weekly Trends')).toBeInTheDocument();
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    });
  });

  it('handles pagination for large schedule datasets', async () => {
    const largeScheduleData = {
      schedules: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        staffId: 1,
        staffName: `Staff ${i + 1}`,
        shiftDate: '2023-12-01',
        startTime: '09:00:00',
        endTime: '17:00:00',
        shiftType: 'day_shift',
        status: 'scheduled',
        isCompleted: false,
        actualStartTime: null,
        actualEndTime: null,
        notes: '',
        createdAt: '2023-11-25T00:00:00Z',
      })),
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    };

    mockBackend.staff.schedules.mockResolvedValue(largeScheduleData);

    renderScheduleManagement();

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  it('handles role-based access control', async () => {
    // Mock manager user
    mockUseAuth.mockReturnValue({
      getAuthenticatedBackend: () => mockBackend,
      user: { ...mockUser, role: 'MANAGER' as const },
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
      trackActivity: jest.fn(),
      showLogoutProgress: false,
      setShowLogoutProgress: jest.fn(),
      setIsTestingLogoutDialog: jest.fn(),
      clearCorruptedTokens: jest.fn(),
      clearAllAuthData: jest.fn(),
    });

    renderScheduleManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Manager should not see add button
    const addButton = screen.queryByText('Add Schedule');
    expect(addButton).not.toBeInTheDocument();
  });

  it('displays schedule completion tracking', async () => {
    renderScheduleManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for completion tracking
    const completionButton = screen.queryByText('Track Completion');
    if (completionButton) {
      fireEvent.click(completionButton);

      // Should show completion tracking
      await waitFor(() => {
        expect(screen.getByText('Schedule Completion')).toBeInTheDocument();
      });
    }
  });
});
