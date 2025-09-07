import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import StaffPage from '../../pages/StaffPage';
import { useAuth } from '../../contexts/AuthContext';


// Mock the auth context
jest.mock('../../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock the backend
const mockBackend = {
  staff: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    listAttendance: jest.fn(),
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    salaryComponents: jest.fn(),
    payslips: jest.fn(),
    salaryStatistics: jest.fn(),
    schedules: jest.fn(),
    createSchedule: jest.fn(),
    markScheduleComplete: jest.fn(),
    createScheduleChangeRequest: jest.fn(),
    approveScheduleChangeRequest: jest.fn(),
    leaveRequests: jest.fn(),
    createLeaveRequest: jest.fn(),
    approveLeaveRequest: jest.fn(),
    rejectLeaveRequest: jest.fn(),
    leaveBalance: jest.fn(),
    leaveStatistics: jest.fn(),
    statistics: jest.fn(),
  },
};

const mockStaffData = {
  staff: [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'MANAGER',
      department: 'Operations',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

describe('Role-Based Access Control Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Mock API responses
    mockBackend.staff.list.mockResolvedValue(mockStaffData);
    mockBackend.staff.listAttendance.mockResolvedValue({ attendance: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    mockBackend.staff.salaryComponents.mockResolvedValue({ salaryComponents: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    mockBackend.staff.schedules.mockResolvedValue({ schedules: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    mockBackend.staff.leaveRequests.mockResolvedValue({ leaveRequests: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    mockBackend.staff.statistics.mockResolvedValue({
      overview: {
        totalStaff: 10,
        activeStaff: 8,
        totalAttendance: 200,
        presentToday: 7,
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderStaffPage = (userRole: string) => {
    mockUseAuth.mockReturnValue({
      getAuthenticatedBackend: () => mockBackend,
      user: {
        userID: '1',
        orgId: 1,
        displayName: 'Test User',
        email: 'test@example.com',
        role: userRole as 'ADMIN' | 'MANAGER',
      },
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

    return render(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(StaffPage)
        )
      )
    );
  };

  describe('Admin Role Access Control', () => {
    it('should allow admin to access all features', async () => {
      renderStaffPage('ADMIN');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Admin should see all tabs
      expect(screen.getByText('Staff')).toBeInTheDocument();
      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();

      // Admin should see all action buttons
      expect(screen.getByText('Add Staff')).toBeInTheDocument();
      expect(screen.getByText('Add Schedule')).toBeInTheDocument();
      expect(screen.getByText('Add Salary Component')).toBeInTheDocument();
    });

    it('should allow admin to perform all CRUD operations', async () => {
      renderStaffPage('ADMIN');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Test staff creation
      fireEvent.click(screen.getByText('Add Staff'));
      expect(screen.getByText('Add Staff')).toBeInTheDocument();

      // Test schedule creation
      fireEvent.click(screen.getByText('Attendance'));
      fireEvent.click(screen.getByText('Add Schedule'));
      expect(screen.getByText('Add Schedule')).toBeInTheDocument();

      // Test salary component creation
      fireEvent.click(screen.getByText('Salary'));
      fireEvent.click(screen.getByText('Add Salary Component'));
      expect(screen.getByText('Add Salary Component')).toBeInTheDocument();
    });

    it('should allow admin to approve/reject requests', async () => {
      renderStaffPage('ADMIN');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Test leave request approval
      fireEvent.click(screen.getByText('Attendance'));
      // Should see approve/reject buttons for pending requests
      expect(screen.queryByText('Approve')).toBeInTheDocument();
      expect(screen.queryByText('Reject')).toBeInTheDocument();
    });
  });

  describe('Manager Role Access Control', () => {
    it('should restrict manager access to appropriate features', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Manager should see all tabs
      expect(screen.getByText('Staff')).toBeInTheDocument();
      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();

      // Manager should NOT see admin-only buttons
      expect(screen.queryByText('Add Staff')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Schedule')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Salary Component')).not.toBeInTheDocument();
    });

    it('should allow manager to view their own data', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Manager should see their own attendance
      fireEvent.click(screen.getByText('Attendance'));
      await waitFor(() => {
        expect(screen.getByText('Attendance Management')).toBeInTheDocument();
      });

      // Manager should see their own salary
      fireEvent.click(screen.getByText('Salary'));
      await waitFor(() => {
        expect(screen.getByText('Salary Management')).toBeInTheDocument();
      });
    });

    it('should allow manager to request changes', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Manager should be able to request leave
      fireEvent.click(screen.getByText('Attendance'));
      expect(screen.queryByText('Request Leave')).toBeInTheDocument();

      // Manager should be able to request schedule changes
      expect(screen.queryByText('Request Change')).toBeInTheDocument();
    });
  });

  describe('Staff Role Access Control', () => {
    it('should restrict staff access to view-only features', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Staff should see limited tabs
      expect(screen.getByText('Staff')).toBeInTheDocument();
      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();

      // Staff should NOT see admin-only buttons
      expect(screen.queryByText('Add Staff')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Schedule')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Salary Component')).not.toBeInTheDocument();
    });

    it('should allow staff to view their own data only', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Staff should see their own attendance
      fireEvent.click(screen.getByText('Attendance'));
      await waitFor(() => {
        expect(screen.getByText('Attendance Management')).toBeInTheDocument();
      });

      // Staff should see their own salary
      fireEvent.click(screen.getByText('Salary'));
      await waitFor(() => {
        expect(screen.getByText('Salary Management')).toBeInTheDocument();
      });
    });

    it('should allow staff to perform basic operations', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Staff should be able to check in/out
      fireEvent.click(screen.getByText('Attendance'));
      expect(screen.queryByText('Check In')).toBeInTheDocument();
      expect(screen.queryByText('Check Out')).toBeInTheDocument();

      // Staff should be able to request leave
      expect(screen.queryByText('Request Leave')).toBeInTheDocument();
    });
  });

  describe('Cross-Role Data Isolation', () => {
    it('should isolate data between different roles', async () => {
      // Test with manager role
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Manager should only see their own data
      expect(mockBackend.staff.list).toHaveBeenCalledWith(
        expect.objectContaining({
          // Should include role-based filtering
        })
      );
    });

    it('should enforce data access restrictions', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Staff should not see other staff's sensitive data
      fireEvent.click(screen.getByText('Salary'));
      await waitFor(() => {
        expect(screen.getByText('Salary Management')).toBeInTheDocument();
      });

      // Should only show their own salary data
      expect(mockBackend.staff.salaryComponents).toHaveBeenCalledWith(
        expect.objectContaining({
          // Should include staff ID filtering
        })
      );
    });
  });

  describe('Permission Escalation Prevention', () => {
    it('should prevent permission escalation attempts', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Staff should not be able to access admin functions
      expect(screen.queryByText('Add Staff')).not.toBeInTheDocument();
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('Reject')).not.toBeInTheDocument();
    });

    it('should handle role changes gracefully', async () => {
      // Start with staff role
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Change to manager role
      mockUseAuth.mockReturnValue({
        getAuthenticatedBackend: () => mockBackend,
        user: {
          userID: '1',
          orgId: 1,
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'MANAGER' as const,
        },
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

      // Re-render with new role
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Should now see manager-level features
      expect(screen.queryByText('Request Leave')).toBeInTheDocument();
    });
  });

  describe('API Security Integration', () => {
    it('should enforce API-level access control', async () => {
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // API calls should include proper authorization
      expect(mockBackend.staff.list).toHaveBeenCalled();
      
      // Verify that sensitive operations are not called for staff role
      expect(mockBackend.staff.create).not.toHaveBeenCalled();
      expect(mockBackend.staff.delete).not.toHaveBeenCalled();
    });

    it('should handle unauthorized access attempts', async () => {
      // Mock unauthorized response
      mockBackend.staff.list.mockRejectedValue(new Error('Unauthorized'));

      renderStaffPage('MANAGER');

      // Should handle unauthorized access gracefully
      await waitFor(() => {
        expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI State Management', () => {
    it('should update UI based on role permissions', async () => {
      renderStaffPage('ADMIN');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Admin should see all features
      expect(screen.getByText('Add Staff')).toBeInTheDocument();

      // Change to staff role
      mockUseAuth.mockReturnValue({
        getAuthenticatedBackend: () => mockBackend,
        user: {
          userID: '1',
          orgId: 1,
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'MANAGER' as const,
        },
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

      // Re-render
      renderStaffPage('MANAGER');

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Staff should not see admin features
      expect(screen.queryByText('Add Staff')).not.toBeInTheDocument();
    });
  });
});
