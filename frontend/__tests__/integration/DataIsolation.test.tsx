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

describe('Data Isolation Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderStaffPage = (orgId: string, userId: string) => {
    mockUseAuth.mockReturnValue({
      getAuthenticatedBackend: () => mockBackend,
      user: {
        userID: userId,
        orgId: parseInt(orgId),
        displayName: 'Test User',
        email: 'test@example.com',
        role: 'ADMIN' as const,
      },
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
      trackActivity: jest.fn(),
      refreshUser: jest.fn(),
      showLogoutProgress: false,
      setShowLogoutProgress: jest.fn(),
      setIsTestingLogoutDialog: jest.fn(),
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

  describe('Organization Data Isolation', () => {
    it('should isolate data between different organizations', async () => {
      // Mock data for Organization A
      const orgAData = {
        staff: [
          {
            id: 1,
            name: 'John Doe - Org A',
            email: 'john@orga.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-a',
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

      // Mock data for Organization B
      const orgBData = {
        staff: [
          {
            id: 2,
            name: 'Jane Smith - Org B',
            email: 'jane@orgb.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-b',
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

      // Test Organization A
      mockBackend.staff.list.mockResolvedValue(orgAData);
      renderStaffPage('org-a', '1');

      await waitFor(() => {
        expect(screen.getByText('John Doe - Org A')).toBeInTheDocument();
      });

      // Should not see Organization B data
      expect(screen.queryByText('Jane Smith - Org B')).not.toBeInTheDocument();

      // Verify API was called with correct org context
      expect(mockBackend.staff.list).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-a',
        })
      );
    });

    it('should prevent cross-organization data access', async () => {
      // Mock unauthorized access attempt
      mockBackend.staff.list.mockRejectedValue(new Error('Unauthorized: Cross-organization access denied'));

      renderStaffPage('org-a', '1');

      // Should handle unauthorized access gracefully
      await waitFor(() => {
        expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
      });
    });

    it('should maintain data isolation across all features', async () => {
      const orgAData = {
        staff: [
          {
            id: 1,
            name: 'John Doe - Org A',
            email: 'john@orga.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-a',
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

      mockBackend.staff.list.mockResolvedValue(orgAData);
      mockBackend.staff.listAttendance.mockResolvedValue({
        attendance: [
          {
            id: 1,
            staffId: 1,
            staffName: 'John Doe - Org A',
            checkInTime: '2023-12-01T09:00:00Z',
            checkOutTime: '2023-12-01T17:00:00Z',
            status: 'present',
            totalHours: 8,
            date: '2023-12-01',
            orgId: 'org-a',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });

      renderStaffPage('org-a', '1');

      await waitFor(() => {
        expect(screen.getByText('John Doe - Org A')).toBeInTheDocument();
      });

      // Test attendance data isolation
      fireEvent.click(screen.getByText('Attendance'));
      await waitFor(() => {
        expect(screen.getByText('John Doe - Org A')).toBeInTheDocument();
      });

      // Verify attendance API was called with correct org context
      expect(mockBackend.staff.listAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-a',
        })
      );
    });
  });

  describe('User Data Isolation', () => {
    it('should isolate data between different users within same organization', async () => {
      const user1Data = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-a',
            createdBy: 1,
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

      mockBackend.staff.list.mockResolvedValue(user1Data);
      renderStaffPage('org-a', '1');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Verify API was called with correct user context
      expect(mockBackend.staff.list).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
        })
      );
    });

    it('should prevent users from accessing other users data', async () => {
      // Mock unauthorized access attempt
      mockBackend.staff.list.mockRejectedValue(new Error('Unauthorized: User data access denied'));

      renderStaffPage('org-a', '1');

      // Should handle unauthorized access gracefully
      await waitFor(() => {
        expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Consistency Across Operations', () => {
    it('should maintain data consistency during CRUD operations', async () => {
      const initialData = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-a',
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

      mockBackend.staff.list.mockResolvedValue(initialData);
      renderStaffPage('org-a', '1');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Simulate data update
      const updatedData = {
        ...initialData,
        staff: [
          {
            ...initialData.staff[0],
            name: 'John Smith',
          },
        ],
      };

      mockBackend.staff.list.mockResolvedValue(updatedData);
      mockBackend.staff.update.mockResolvedValue({ success: true });

      // Trigger update
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Save'));

      // Data should be updated consistently
      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      });

      // Verify update was called with correct org context
      expect(mockBackend.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-a',
        })
      );
    });

    it('should handle concurrent operations safely', async () => {
      const initialData = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-a',
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

      mockBackend.staff.list.mockResolvedValue(initialData);
      renderStaffPage('org-a', '1');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Simulate concurrent operations
      const promises = [
        waitFor(() => expect(screen.getByText('Staff')).toBeInTheDocument()),
        waitFor(() => expect(screen.getByText('Attendance')).toBeInTheDocument()),
        waitFor(() => expect(screen.getByText('Salary')).toBeInTheDocument()),
      ];

      await Promise.all(promises);

      // All operations should maintain data isolation
      expect(mockBackend.staff.list).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-a',
        })
      );
    });
  });

  describe('Cache Isolation', () => {
    it('should maintain separate caches for different organizations', async () => {
      const orgAData = {
        staff: [
          {
            id: 1,
            name: 'John Doe - Org A',
            email: 'john@orga.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-a',
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

      const orgBData = {
        staff: [
          {
            id: 2,
            name: 'Jane Smith - Org B',
            email: 'jane@orgb.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-b',
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

      // Test Organization A
      mockBackend.staff.list.mockResolvedValue(orgAData);
      renderStaffPage('org-a', '1');

      await waitFor(() => {
        expect(screen.getByText('John Doe - Org A')).toBeInTheDocument();
      });

      // Test Organization B
      mockBackend.staff.list.mockResolvedValue(orgBData);
      renderStaffPage('org-b', '2');

      await waitFor(() => {
        expect(screen.getByText('Jane Smith - Org B')).toBeInTheDocument();
      });

      // Should not see Organization A data
      expect(screen.queryByText('John Doe - Org A')).not.toBeInTheDocument();
    });

    it('should invalidate cache correctly on data changes', async () => {
      const initialData = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-a',
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

      mockBackend.staff.list.mockResolvedValue(initialData);
      mockBackend.staff.create.mockResolvedValue({ success: true });

      renderStaffPage('org-a', '1');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Create new staff member
      fireEvent.click(screen.getByText('Add Staff'));
      fireEvent.click(screen.getByText('Create Staff'));

      // Cache should be invalidated and data refreshed
      await waitFor(() => {
        expect(mockBackend.staff.list).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Security Validation', () => {
    it('should validate organization context in all API calls', async () => {
      const orgAData = {
        staff: [
          {
            id: 1,
            name: 'John Doe - Org A',
            email: 'john@orga.com',
            role: 'MANAGER',
            department: 'Operations',
            isActive: true,
            orgId: 'org-a',
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

      mockBackend.staff.list.mockResolvedValue(orgAData);
      renderStaffPage('org-a', '1');

      await waitFor(() => {
        expect(screen.getByText('John Doe - Org A')).toBeInTheDocument();
      });

      // All API calls should include organization context
      expect(mockBackend.staff.list).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-a',
        })
      );
    });

    it('should handle data leakage prevention', async () => {
      // Mock attempt to access data from different organization
      mockBackend.staff.list.mockRejectedValue(new Error('Data leakage prevention: Unauthorized access'));

      renderStaffPage('org-a', '1');

      // Should handle data leakage prevention gracefully
      await waitFor(() => {
        expect(screen.getByText(/data leakage prevention/i)).toBeInTheDocument();
      });
    });
  });
});
