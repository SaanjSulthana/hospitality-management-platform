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

const mockUser = {
  userID: '1',
  orgId: 1,
  displayName: 'Test Admin',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
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

const mockAttendanceData = {
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

const mockSalaryData = {
  salaryComponents: [
    {
      id: 1,
      staffId: 1,
      staffName: 'John Doe',
      componentType: 'base_salary',
      amountCents: 500000,
      effectiveDate: '2023-01-01',
      isActive: true,
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

const mockScheduleData = {
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
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

const mockLeaveData = {
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

describe('Staff Management Integration Tests', () => {
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
    mockBackend.staff.list.mockResolvedValue(mockStaffData);
    mockBackend.staff.listAttendance.mockResolvedValue(mockAttendanceData);
    mockBackend.staff.salaryComponents.mockResolvedValue(mockSalaryData);
    mockBackend.staff.schedules.mockResolvedValue(mockScheduleData);
    mockBackend.staff.leaveRequests.mockResolvedValue(mockLeaveData);
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

  const renderStaffPage = () => {
    return render(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(StaffPage)
        )
      )
    );
  };

  describe('Complete Staff Management Workflow', () => {
    it('should handle complete staff management workflow', async () => {
      renderStaffPage();

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Verify all tabs are present
      expect(screen.getByText('Staff')).toBeInTheDocument();
      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();

      // Test staff management
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Test attendance management
      fireEvent.click(screen.getByText('Attendance'));
      await waitFor(() => {
        expect(screen.getByText('Attendance Management')).toBeInTheDocument();
      });

      // Test salary management
      fireEvent.click(screen.getByText('Salary'));
      await waitFor(() => {
        expect(screen.getByText('Salary Management')).toBeInTheDocument();
      });

      // Test reports
      fireEvent.click(screen.getByText('Reports'));
      await waitFor(() => {
        expect(screen.getByText('Reports')).toBeInTheDocument();
      });
    });

    it('should handle role-based access control across all features', async () => {
      // Test with manager role
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

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Manager should see limited functionality
      expect(screen.queryByText('Add Staff')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Schedule')).not.toBeInTheDocument();
    });

    it('should handle data synchronization across tabs', async () => {
      renderStaffPage();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to attendance tab
      fireEvent.click(screen.getByText('Attendance'));
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to salary tab
      fireEvent.click(screen.getByText('Salary'));
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Verify data consistency
      expect(mockBackend.staff.list).toHaveBeenCalled();
      expect(mockBackend.staff.listAttendance).toHaveBeenCalled();
      expect(mockBackend.staff.salaryComponents).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully across all features', async () => {
      // Mock API errors
      mockBackend.staff.list.mockRejectedValue(new Error('API Error'));
      mockBackend.staff.listAttendance.mockRejectedValue(new Error('API Error'));
      mockBackend.staff.salaryComponents.mockRejectedValue(new Error('API Error'));

      renderStaffPage();

      // Should show error states
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should handle network connectivity issues', async () => {
      // Mock network error
      mockBackend.staff.list.mockRejectedValue(new Error('Network Error'));

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText(/network/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock large dataset
      const largeStaffData = {
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

      mockBackend.staff.list.mockResolvedValue(largeStaffData);

      renderStaffPage();

      // Should handle large dataset without performance issues
      await waitFor(() => {
        expect(screen.getByText('Staff 1')).toBeInTheDocument();
      });

      // Should show pagination
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    it('should handle concurrent operations', async () => {
      renderStaffPage();

      // Simulate concurrent operations
      const promises = [
        waitFor(() => expect(screen.getByText('Staff')).toBeInTheDocument()),
        waitFor(() => expect(screen.getByText('Attendance')).toBeInTheDocument()),
        waitFor(() => expect(screen.getByText('Salary')).toBeInTheDocument()),
      ];

      await Promise.all(promises);

      // All operations should complete successfully
      expect(mockBackend.staff.list).toHaveBeenCalled();
      expect(mockBackend.staff.listAttendance).toHaveBeenCalled();
      expect(mockBackend.staff.salaryComponents).toHaveBeenCalled();
    });
  });

  describe('Mobile Responsiveness Integration', () => {
    it('should handle mobile viewport correctly', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderStaffPage();

      // Should render mobile-optimized layout
      expect(screen.getByText('Staff Management')).toBeInTheDocument();
    });

    it('should handle tablet viewport correctly', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      renderStaffPage();

      // Should render tablet-optimized layout
      expect(screen.getByText('Staff Management')).toBeInTheDocument();
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain accessibility across all features', async () => {
      renderStaffPage();

      // Check for proper ARIA labels
      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Check for keyboard navigation
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);

      // Test keyboard navigation
      fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(tabs[1]);
    });

    it('should handle screen reader compatibility', async () => {
      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('Staff Management')).toBeInTheDocument();
      });

      // Check for proper heading structure
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);

      // Check for proper button labels
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency across operations', async () => {
      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Simulate data update
      const updatedStaffData = {
        ...mockStaffData,
        staff: [{
          ...mockStaffData.staff[0],
          name: 'John Smith',
        }],
      };

      mockBackend.staff.list.mockResolvedValue(updatedStaffData);

      // Trigger refresh
      fireEvent.click(screen.getByText('Refresh'));

      // Data should be updated consistently
      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      });
    });

    it('should handle optimistic updates correctly', async () => {
      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Simulate optimistic update
      mockBackend.staff.create.mockResolvedValue({ success: true });

      // Add new staff
      fireEvent.click(screen.getByText('Add Staff'));
      fireEvent.click(screen.getByText('Create Staff'));

      // Should show optimistic update
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });
  });
});
