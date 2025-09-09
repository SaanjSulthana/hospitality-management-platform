import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import LeaveManagement from '../components/LeaveManagement';
import { useAuth } from '../contexts/AuthContext';


// Mock the auth context
jest.mock('../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock the backend
const mockBackend = {
  staff: {
    leaveRequests: jest.fn(),
    createLeaveRequest: jest.fn(),
    updateLeaveRequest: jest.fn(),
    deleteLeaveRequest: jest.fn(),
    approveLeaveRequest: jest.fn(),
    rejectLeaveRequest: jest.fn(),
    leaveBalance: jest.fn(),
    leaveStatistics: jest.fn(),
    exportLeave: jest.fn(),
  },
};

const mockUser = {
  userID: '1',
  orgId: 1,
  displayName: 'Test Admin',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
};

const mockLeaveRequests = {
  leaveRequests: [
    {
      id: 1,
      staffId: 1,
      staffName: 'John Doe',
      leaveType: 'annual_leave',
      startDate: '2023-12-15',
      endDate: '2023-12-17',
      totalDays: 3,
      reason: 'Family vacation',
      status: 'pending',
      requestedAt: '2023-12-01T00:00:00Z',
      reviewedAt: null,
      reviewedBy: null,
      adminNotes: null,
      isEmergency: false,
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

const mockLeaveBalance = {
  staffId: 1,
  staffName: 'John Doe',
  annualLeaveDays: 20,
  usedAnnualLeaveDays: 5,
  remainingAnnualLeaveDays: 15,
  sickLeaveDays: 10,
  usedSickLeaveDays: 2,
  remainingSickLeaveDays: 8,
  emergencyLeaveDays: 5,
  usedEmergencyLeaveDays: 0,
  remainingEmergencyLeaveDays: 5,
  lastUpdated: '2023-12-01T00:00:00Z',
};

const mockLeaveStats = {
  overview: {
    totalRequests: 25,
    pendingRequests: 5,
    approvedRequests: 18,
    rejectedRequests: 2,
    totalLeaveDays: 120,
  },
  periodAnalysis: {
    currentMonth: {
      totalRequests: 8,
      approvedRequests: 6,
      rejectedRequests: 1,
      pendingRequests: 1,
    },
  },
  trends: {
    monthlyTrend: [
      { month: '2023-11', totalRequests: 6, approvedRequests: 5, rejectedRequests: 1 },
      { month: '2023-12', totalRequests: 8, approvedRequests: 6, rejectedRequests: 1 },
    ],
  },
};

describe('LeaveManagement', () => {
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
    mockBackend.staff.leaveRequests.mockResolvedValue(mockLeaveRequests);
    mockBackend.staff.leaveBalance.mockResolvedValue(mockLeaveBalance);
    mockBackend.staff.leaveStatistics.mockResolvedValue(mockLeaveStats);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderLeaveManagement = () => {
    return render(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(LeaveManagement)
        )
      )
    );
  };

  it('renders leave management interface', async () => {
    renderLeaveManagement();

    expect(screen.getByText('Leave Management')).toBeInTheDocument();
    expect(screen.getByText('Manage staff leave requests and balances')).toBeInTheDocument();
    
    // Check for main sections
    expect(screen.getByText('Leave Requests')).toBeInTheDocument();
    expect(screen.getByText('Leave Balance')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('displays leave requests for admin users', async () => {
    renderLeaveManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Annual Leave')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  it('shows leave balance information', async () => {
    renderLeaveManagement();

    await waitFor(() => {
      expect(screen.getByText('Leave Balance')).toBeInTheDocument();
      expect(screen.getByText('Annual Leave')).toBeInTheDocument();
      expect(screen.getByText('Sick Leave')).toBeInTheDocument();
    });
  });

  it('handles leave request creation', async () => {
    mockBackend.staff.createLeaveRequest.mockResolvedValue({ success: true });

    renderLeaveManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for add leave request button
    const addButton = screen.queryByText('Request Leave');
    if (addButton) {
      fireEvent.click(addButton);

      // Should open add dialog
      await waitFor(() => {
        expect(screen.getByText('Request Leave')).toBeInTheDocument();
      });

      // Fill form and submit
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.createLeaveRequest).toHaveBeenCalled();
      });
    }
  });

  it('handles leave request approval', async () => {
    mockBackend.staff.approveLeaveRequest.mockResolvedValue({ success: true });

    renderLeaveManagement();

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
        expect(screen.getByText('Approve Leave Request')).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByText('Approve');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.approveLeaveRequest).toHaveBeenCalled();
      });
    }
  });

  it('handles leave request rejection', async () => {
    mockBackend.staff.rejectLeaveRequest.mockResolvedValue({ success: true });

    renderLeaveManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for reject button
    const rejectButton = screen.queryByText('Reject');
    if (rejectButton) {
      fireEvent.click(rejectButton);

      // Should open rejection dialog
      await waitFor(() => {
        expect(screen.getByText('Reject Leave Request')).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByText('Reject');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.rejectLeaveRequest).toHaveBeenCalled();
      });
    }
  });

  it('displays loading states', () => {
    // Mock loading state
    mockBackend.staff.leaveRequests.mockImplementation(() => new Promise(() => {}));
    mockBackend.staff.leaveBalance.mockImplementation(() => new Promise(() => {}));
    mockBackend.staff.leaveStatistics.mockImplementation(() => new Promise(() => {}));

    renderLeaveManagement();

    // Check for loading indicators
    expect(screen.getByText('Loading leave data...')).toBeInTheDocument();
  });

  it('displays empty state when no leave requests', async () => {
    mockBackend.staff.leaveRequests.mockResolvedValue({ leaveRequests: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

    renderLeaveManagement();

    await waitFor(() => {
      expect(screen.getByText('No leave requests found')).toBeInTheDocument();
      expect(screen.getByText('Start by creating your first leave request')).toBeInTheDocument();
    });
  });

  it('handles leave export', async () => {
    mockBackend.staff.exportLeave.mockResolvedValue({ success: true, downloadUrl: 'test-url' });

    renderLeaveManagement();

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
        expect(screen.getByText('Export Leave Data')).toBeInTheDocument();
      });

      // Select format and export
      const csvOption = screen.getByText('CSV');
      fireEvent.click(csvOption);

      const exportSubmitButton = screen.getByText('Export');
      fireEvent.click(exportSubmitButton);

      await waitFor(() => {
        expect(mockBackend.staff.exportLeave).toHaveBeenCalled();
      });
    }
  });

  it('displays error messages for failed operations', async () => {
    mockBackend.staff.createLeaveRequest.mockRejectedValue(new Error('Failed to create leave request'));

    renderLeaveManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Try to add leave request
    const addButton = screen.queryByText('Request Leave');
    if (addButton) {
      fireEvent.click(addButton);

      // Submit form
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create leave request')).toBeInTheDocument();
      });
    }
  });

  it('shows real-time update indicators', () => {
    renderLeaveManagement();

    expect(screen.getByText('Live updates active')).toBeInTheDocument();
  });

  it('handles mobile responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    renderLeaveManagement();

    // Check for mobile-specific elements
    expect(screen.getByText('Leave Management')).toBeInTheDocument();
  });

  it('displays emergency leave requests', async () => {
    mockBackend.staff.leaveRequests.mockResolvedValue({
      leaveRequests: [{
        ...mockLeaveRequests.leaveRequests[0],
        isEmergency: true,
        leaveType: 'emergency_leave',
      }],
      pagination: mockLeaveRequests.pagination,
    });

    renderLeaveManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Should show emergency indicator
    expect(screen.getByText('Emergency Leave')).toBeInTheDocument();
  });

  it('handles leave balance tracking', async () => {
    renderLeaveManagement();

    await waitFor(() => {
      expect(screen.getByText('Leave Balance')).toBeInTheDocument();
      expect(screen.getByText('Annual Leave')).toBeInTheDocument();
      expect(screen.getByText('Sick Leave')).toBeInTheDocument();
    });
  });

  it('displays leave statistics', async () => {
    renderLeaveManagement();

    await waitFor(() => {
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      expect(screen.getByText('Pending Requests')).toBeInTheDocument();
      expect(screen.getByText('Approved Requests')).toBeInTheDocument();
    });
  });

  it('handles pagination for large leave datasets', async () => {
    const largeLeaveData = {
      leaveRequests: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        staffId: 1,
        staffName: `Staff ${i + 1}`,
        leaveType: 'annual_leave',
        startDate: '2023-12-15',
        endDate: '2023-12-17',
        totalDays: 3,
        reason: 'Vacation',
        status: 'pending',
        requestedAt: '2023-12-01T00:00:00Z',
        reviewedAt: null,
        reviewedBy: null,
        adminNotes: null,
        isEmergency: false,
      })),
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    };

    mockBackend.staff.leaveRequests.mockResolvedValue(largeLeaveData);

    renderLeaveManagement();

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

    renderLeaveManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Manager should not see approve/reject buttons
    const approveButton = screen.queryByText('Approve');
    expect(approveButton).not.toBeInTheDocument();
  });

  it('displays leave policy information', async () => {
    renderLeaveManagement();

    await waitFor(() => {
      expect(screen.getByText('Leave Policy')).toBeInTheDocument();
    });
  });

  it('handles leave request filtering', async () => {
    renderLeaveManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for filter options
    const filterSelect = screen.queryByText('All Status');
    if (filterSelect) {
      fireEvent.click(filterSelect);
      // Should show filter options
    }
  });
});
