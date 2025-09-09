import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

describe('Real-Time Updates Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchInterval: 1000, // 1 second for testing
        },
      },
    });

    mockUseAuth.mockReturnValue({
      getAuthenticatedBackend: () => mockBackend,
      user: {
        userID: '1',
        orgId: 1,
        displayName: 'Test Admin',
        email: 'admin@test.com',
        role: 'ADMIN' as const,
      },
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderStaffPage = () => {
    return render(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(StaffPage)
        )
      )
    );
  };

  describe('Real-Time Data Synchronization', () => {
    it('should automatically refresh data at specified intervals', async () => {
      const initialData = {
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

      mockBackend.staff.list.mockResolvedValue(initialData);
      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Wait for automatic refresh
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      // Should have been called multiple times due to polling
      expect(mockBackend.staff.list).toHaveBeenCalledTimes(2);
    });

    it('should handle data updates from external sources', async () => {
      const initialData = {
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

      const updatedData = {
        staff: [
          {
            id: 1,
            name: 'John Smith',
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

      mockBackend.staff.list
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(updatedData);

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Wait for data update
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      // Should show updated data
      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      });
    });

    it('should maintain data consistency across tabs', async () => {
      const staffData = {
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

      const attendanceData = {
        attendance: [
          {
            id: 1,
            staffId: 1,
            staffName: 'John Doe',
            checkInTime: '2023-12-01T09:00:00Z',
            checkOutTime: '2023-12-01T17:00:00Z',
            status: 'present',
            totalHours: 8,
            date: '2023-12-01',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockBackend.staff.list.mockResolvedValue(staffData);
      mockBackend.staff.listAttendance.mockResolvedValue(attendanceData);

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to attendance tab
      fireEvent.click(screen.getByText('Attendance'));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Data should be consistent across tabs
      expect(mockBackend.staff.list).toHaveBeenCalled();
      expect(mockBackend.staff.listAttendance).toHaveBeenCalled();
    });
  });

  describe('Optimistic Updates', () => {
    it('should show optimistic updates for create operations', async () => {
      const initialData = {
        staff: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      };

      const newStaffData = {
        staff: [
          {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            role: 'STAFF',
            department: 'Operations',
            isActive: true,
            createdAt: '2023-12-01T00:00:00Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockBackend.staff.list
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(newStaffData);

      mockBackend.staff.create.mockResolvedValue({ success: true });

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('No staff found')).toBeInTheDocument();
      });

      // Create new staff
      fireEvent.click(screen.getByText('Add Staff'));
      fireEvent.click(screen.getByText('Create Staff'));

      // Should show optimistic update
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });

      // Should show final result
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should handle optimistic update failures gracefully', async () => {
      const initialData = {
        staff: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      };

      mockBackend.staff.list.mockResolvedValue(initialData);
      mockBackend.staff.create.mockRejectedValue(new Error('Creation failed'));

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('No staff found')).toBeInTheDocument();
      });

      // Create new staff
      fireEvent.click(screen.getByText('Add Staff'));
      fireEvent.click(screen.getByText('Create Staff'));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Creation failed')).toBeInTheDocument();
      });

      // Should revert to original state
      expect(screen.getByText('No staff found')).toBeInTheDocument();
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache on data mutations', async () => {
      const initialData = {
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

      mockBackend.staff.list.mockResolvedValue(initialData);
      mockBackend.staff.update.mockResolvedValue({ success: true });

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Update staff
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Save'));

      // Cache should be invalidated and data refreshed
      await waitFor(() => {
        expect(mockBackend.staff.list).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle cache invalidation across related queries', async () => {
      const staffData = {
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

      const attendanceData = {
        attendance: [
          {
            id: 1,
            staffId: 1,
            staffName: 'John Doe',
            checkInTime: '2023-12-01T09:00:00Z',
            checkOutTime: '2023-12-01T17:00:00Z',
            status: 'present',
            totalHours: 8,
            date: '2023-12-01',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockBackend.staff.list.mockResolvedValue(staffData);
      mockBackend.staff.listAttendance.mockResolvedValue(attendanceData);
      mockBackend.staff.checkIn.mockResolvedValue({ success: true });

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to attendance tab
      fireEvent.click(screen.getByText('Attendance'));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Check in
      fireEvent.click(screen.getByText('Check In'));

      // Both staff and attendance caches should be invalidated
      await waitFor(() => {
        expect(mockBackend.staff.list).toHaveBeenCalledTimes(2);
        expect(mockBackend.staff.listAttendance).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling in Real-Time Updates', () => {
    it('should handle network errors during polling', async () => {
      const initialData = {
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

      mockBackend.staff.list
        .mockResolvedValueOnce(initialData)
        .mockRejectedValueOnce(new Error('Network error'));

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Wait for polling attempt
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      // Should handle error gracefully
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should retry failed requests automatically', async () => {
      const initialData = {
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

      mockBackend.staff.list
        .mockResolvedValueOnce(initialData)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(initialData);

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Wait for retry
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 2100));
      });

      // Should eventually succeed
      expect(mockBackend.staff.list).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce rapid updates', async () => {
      const initialData = {
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

      mockBackend.staff.list.mockResolvedValue(initialData);

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Rapidly trigger multiple updates
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByText('Refresh'));
      }

      // Should debounce and not make excessive API calls
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      // Should have made reasonable number of calls
      expect(mockBackend.staff.list).toHaveBeenCalledTimes(2);
    });

    it('should handle large datasets efficiently', async () => {
      const largeData = {
        staff: Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          name: `Staff ${i + 1}`,
          email: `staff${i + 1}@example.com`,
          role: 'STAFF',
          department: 'Operations',
          isActive: true,
          createdAt: '2023-01-01T00:00:00Z',
        })),
        pagination: {
          page: 1,
          limit: 50,
          total: 100,
          totalPages: 2,
        },
      };

      mockBackend.staff.list.mockResolvedValue(largeData);

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('Staff 1')).toBeInTheDocument();
      });

      // Should handle large dataset without performance issues
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });
  });
});
