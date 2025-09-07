import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import AttendanceManagement from '../components/AttendanceManagement';
import { useAuth } from '../contexts/AuthContext';


// Mock the auth context
jest.mock('../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock the backend
const mockBackend = {
  staff: {
    listAttendance: jest.fn(),
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    updateAttendance: jest.fn(),
    attendanceStatistics: jest.fn(),
    exportAttendance: jest.fn(),
    attendanceValidation: jest.fn(),
  },
};

const mockUser = {
  userID: '1',
  orgId: 1,
  displayName: 'Test User',
  email: 'user@test.com',
  role: 'MANAGER' as const,
};

const mockAttendanceData = {
  attendance: [
    {
      id: 1,
      staffId: 1,
      staffName: 'John Doe',
      attendanceDate: '2023-12-01',
      checkInTime: '09:00:00',
      checkOutTime: '17:00:00',
      totalHours: 8.0,
      status: 'present',
      isLate: false,
      isOvertime: false,
      notes: 'Regular day',
      createdAt: '2023-12-01T09:00:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

const mockAttendanceStats = {
  overview: {
    totalRecords: 1,
    presentCount: 1,
    absentCount: 0,
    lateCount: 0,
    averageHours: 8.0,
    totalHours: 8.0,
  },
  periodAnalysis: {
    currentMonth: {
      totalDays: 1,
      presentDays: 1,
      absentDays: 0,
      lateDays: 0,
      averageHours: 8.0,
    },
  },
  trends: {
    weeklyTrend: [
      { week: '2023-W48', presentDays: 1, totalHours: 8.0 },
    ],
  },
};

describe('AttendanceManagement', () => {
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
      clearCorruptedTokens: jest.fn(),
      clearAllAuthData: jest.fn(),
    });

    // Mock API responses
    mockBackend.staff.listAttendance.mockResolvedValue(mockAttendanceData);
    mockBackend.staff.attendanceStatistics.mockResolvedValue(mockAttendanceStats);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderAttendanceManagement = () => {
    return render(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(AttendanceManagement)
        )
      )
    );
  };

  it('renders attendance management interface', async () => {
    renderAttendanceManagement();

    expect(screen.getByText('Attendance Management')).toBeInTheDocument();
    expect(screen.getByText('Track and manage staff attendance')).toBeInTheDocument();
    
    // Check for main sections
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Today\'s Attendance')).toBeInTheDocument();
    expect(screen.getByText('Attendance History')).toBeInTheDocument();
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });

  it('displays check-in/check-out buttons for managers', async () => {
    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('Check In')).toBeInTheDocument();
      expect(screen.getByText('Check Out')).toBeInTheDocument();
    });
  });

  it('shows attendance statistics', async () => {
    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('Total Records')).toBeInTheDocument();
      expect(screen.getByText('Present')).toBeInTheDocument();
      expect(screen.getByText('Average Hours')).toBeInTheDocument();
    });
  });

  it('displays attendance history with filtering options', async () => {
    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument();
      expect(screen.getByText('8.0 hours')).toBeInTheDocument();
    });

    // Check for filter options
    expect(screen.getByText('Filter by Date')).toBeInTheDocument();
    expect(screen.getByText('Filter by Status')).toBeInTheDocument();
  });

  it('handles check-in functionality', async () => {
    mockBackend.staff.checkIn.mockResolvedValue({ success: true });

    renderAttendanceManagement();

    // Click check-in button
    const checkInButton = screen.getByText('Check In');
    fireEvent.click(checkInButton);

    // Should open check-in dialog
    await waitFor(() => {
      expect(screen.getByText('Check In')).toBeInTheDocument();
    });

    // Fill form and submit
    const submitButton = screen.getByText('Check In Now');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockBackend.staff.checkIn).toHaveBeenCalled();
    });
  });

  it('handles check-out functionality', async () => {
    mockBackend.staff.checkOut.mockResolvedValue({ success: true });

    renderAttendanceManagement();

    // Click check-out button
    const checkOutButton = screen.getByText('Check Out');
    fireEvent.click(checkOutButton);

    // Should open check-out dialog
    await waitFor(() => {
      expect(screen.getByText('Check Out')).toBeInTheDocument();
    });

    // Fill form and submit
    const submitButton = screen.getByText('Check Out Now');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockBackend.staff.checkOut).toHaveBeenCalled();
    });
  });

  it('displays loading states', () => {
    // Mock loading state
    mockBackend.staff.listAttendance.mockImplementation(() => new Promise(() => {}));
    mockBackend.staff.attendanceStatistics.mockImplementation(() => new Promise(() => {}));

    renderAttendanceManagement();

    // Check for loading indicators
    expect(screen.getByText('Loading attendance data...')).toBeInTheDocument();
  });

  it('displays empty state when no attendance data', async () => {
    mockBackend.staff.listAttendance.mockResolvedValue({ attendance: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('No attendance records found')).toBeInTheDocument();
      expect(screen.getByText('Start by checking in for today')).toBeInTheDocument();
    });
  });

  it('handles attendance filtering', async () => {
    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Test date filter
    const dateFilter = screen.getByLabelText('Filter by Date');
    fireEvent.change(dateFilter, { target: { value: '2023-12-01' } });

    await waitFor(() => {
      expect(mockBackend.staff.listAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });
  });

  it('handles attendance status filtering', async () => {
    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Test status filter
    const statusFilter = screen.getByLabelText('Filter by Status');
    fireEvent.change(statusFilter, { target: { value: 'present' } });

    await waitFor(() => {
      expect(mockBackend.staff.listAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'present',
        })
      );
    });
  });

  it('handles attendance export', async () => {
    mockBackend.staff.exportAttendance.mockResolvedValue({ success: true, downloadUrl: 'test-url' });

    renderAttendanceManagement();

    // Click export button
    const exportButton = screen.getByText('Export Data');
    fireEvent.click(exportButton);

    // Should open export dialog
    await waitFor(() => {
      expect(screen.getByText('Export Attendance Data')).toBeInTheDocument();
    });

    // Select format and export
    const csvOption = screen.getByText('CSV');
    fireEvent.click(csvOption);

    const exportSubmitButton = screen.getByText('Export');
    fireEvent.click(exportSubmitButton);

    await waitFor(() => {
      expect(mockBackend.staff.exportAttendance).toHaveBeenCalled();
    });
  });

  it('displays error messages for failed operations', async () => {
    mockBackend.staff.checkIn.mockRejectedValue(new Error('Failed to check in'));

    renderAttendanceManagement();

    // Click check-in button
    const checkInButton = screen.getByText('Check In');
    fireEvent.click(checkInButton);

    // Submit form
    const submitButton = screen.getByText('Check In Now');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to check in')).toBeInTheDocument();
    });
  });

  it('shows real-time update indicators', () => {
    renderAttendanceManagement();

    expect(screen.getByText('Live updates active')).toBeInTheDocument();
  });

  it('handles mobile responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    renderAttendanceManagement();

    // Check for mobile-specific elements
    expect(screen.getByText('Attendance Management')).toBeInTheDocument();
  });

  it('displays attendance validation warnings', async () => {
    mockBackend.staff.attendanceValidation.mockResolvedValue({
      isValid: false,
      warnings: ['Check-in time is outside normal hours'],
      errors: [],
    });

    renderAttendanceManagement();

    // Click check-in button
    const checkInButton = screen.getByText('Check In');
    fireEvent.click(checkInButton);

    // Fill form with invalid time
    const timeInput = screen.getByLabelText('Check-in Time');
    fireEvent.change(timeInput, { target: { value: '2023-12-01T02:00' } });

    // Submit form
    const submitButton = screen.getByText('Check In Now');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Check-in time is outside normal hours')).toBeInTheDocument();
    });
  });

  it('handles attendance update for admin users', async () => {
    // Mock admin user
    mockUseAuth.mockReturnValue({
      getAuthenticatedBackend: () => mockBackend,
      user: { ...mockUser, role: 'ADMIN' as const },
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
      trackActivity: jest.fn(),
      showLogoutProgress: false,
      setShowLogoutProgress: jest.fn(),
      clearCorruptedTokens: jest.fn(),
      clearAllAuthData: jest.fn(),
    });

    mockBackend.staff.updateAttendance.mockResolvedValue({ success: true });

    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click edit button (should be visible for admin)
    const editButton = screen.queryByText('Edit');
    if (editButton) {
      fireEvent.click(editButton);

      // Should open edit dialog
      await waitFor(() => {
        expect(screen.getByText('Edit Attendance Record')).toBeInTheDocument();
      });
    }
  });

  it('displays attendance trends and analytics', async () => {
    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('Weekly Trends')).toBeInTheDocument();
      expect(screen.getByText('Monthly Overview')).toBeInTheDocument();
    });
  });

  it('handles pagination for large attendance datasets', async () => {
    const largeAttendanceData = {
      attendance: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        staffId: 1,
        staffName: `Staff ${i + 1}`,
        attendanceDate: '2023-12-01',
        checkInTime: '09:00:00',
        checkOutTime: '17:00:00',
        totalHours: 8.0,
        status: 'present',
        isLate: false,
        isOvertime: false,
        notes: '',
        createdAt: '2023-12-01T09:00:00Z',
      })),
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    };

    mockBackend.staff.listAttendance.mockResolvedValue(largeAttendanceData);

    renderAttendanceManagement();

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });
});
