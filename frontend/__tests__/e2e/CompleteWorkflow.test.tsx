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
    generatePayslip: jest.fn(),
  },
};

describe('Complete Workflow End-to-End Tests', () => {
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
      refreshUser: jest.fn(),
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

  describe('Complete Staff Management Workflow', () => {
    it('should handle complete staff lifecycle from creation to deletion', async () => {
      // Initial empty state
      const emptyData = {
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
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
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

      const updatedStaffData = {
        staff: [
          {
            id: 1,
            name: 'John Smith',
            email: 'john.smith@example.com',
            role: 'MANAGER',
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

      // Mock API responses
      mockBackend.staff.list
        .mockResolvedValueOnce(emptyData)
        .mockResolvedValueOnce(newStaffData)
        .mockResolvedValueOnce(updatedStaffData);

      mockBackend.staff.create.mockResolvedValue({ success: true });
      mockBackend.staff.update.mockResolvedValue({ success: true });
      mockBackend.staff.delete.mockResolvedValue({ success: true });

      renderStaffPage();

      // Step 1: Verify empty state
      await waitFor(() => {
        expect(screen.getByText('No staff found')).toBeInTheDocument();
      });

      // Step 2: Create new staff
      fireEvent.click(screen.getByText('Add Staff'));
      await waitFor(() => {
        expect(screen.getByText('Add Staff')).toBeInTheDocument();
      });

      // Fill form
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
      fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'MANAGER' } });
      fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'Operations' } });

      fireEvent.click(screen.getByText('Create Staff'));

      // Step 3: Verify staff creation
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Step 4: Update staff
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => {
        expect(screen.getByText('Edit Staff')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Smith' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john.smith@example.com' } });

      fireEvent.click(screen.getByText('Save'));

      // Step 5: Verify staff update
      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      });

      // Step 6: Delete staff
      fireEvent.click(screen.getByText('Delete'));
      await waitFor(() => {
        expect(screen.getByText('Delete Staff')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm Delete'));

      // Step 7: Verify staff deletion
      await waitFor(() => {
        expect(screen.getByText('No staff found')).toBeInTheDocument();
      });
    });

    it('should handle complete attendance workflow', async () => {
      const staffData = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
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

      const attendanceData = {
        attendance: [
          {
            id: 1,
            staffId: 1,
            staffName: 'John Doe',
            checkInTime: '2023-12-01T09:00:00Z',
            checkOutTime: null,
            status: 'present',
            totalHours: 0,
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

      const updatedAttendanceData = {
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
      mockBackend.staff.listAttendance
        .mockResolvedValueOnce(attendanceData)
        .mockResolvedValueOnce(updatedAttendanceData);

      mockBackend.staff.checkIn.mockResolvedValue({ success: true });
      mockBackend.staff.checkOut.mockResolvedValue({ success: true });

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to attendance tab
      fireEvent.click(screen.getByText('Attendance'));

      await waitFor(() => {
        expect(screen.getByText('Attendance Management')).toBeInTheDocument();
      });

      // Check in
      fireEvent.click(screen.getByText('Check In'));
      await waitFor(() => {
        expect(screen.getByText('Check In')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Check In'));

      // Check out
      fireEvent.click(screen.getByText('Check Out'));
      await waitFor(() => {
        expect(screen.getByText('Check Out')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Check Out'));

      // Verify attendance record
      await waitFor(() => {
        expect(screen.getByText('8 hours')).toBeInTheDocument();
      });
    });

    it('should handle complete salary management workflow', async () => {
      const staffData = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
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

      const salaryData = {
        salaryComponents: [
          {
            id: 1,
            staffId: 1,
            staffName: 'John Doe',
            componentType: 'base_salary',
            amountCents: 500000,
            effectiveDate: '2023-12-01',
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

      const payslipData = {
        payslips: [
          {
            id: 1,
            staffId: 1,
            staffName: 'John Doe',
            payPeriodStart: '2023-12-01',
            payPeriodEnd: '2023-12-31',
            grossPayCents: 500000,
            deductionsCents: 50000,
            netPayCents: 450000,
            status: 'generated',
            generatedAt: '2023-12-31T00:00:00Z',
            pdfUrl: 'https://example.com/payslip.pdf',
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
      mockBackend.staff.salaryComponents.mockResolvedValue(salaryData);
      mockBackend.staff.payslips.mockResolvedValue(payslipData);

      mockBackend.staff.salaryComponents.mockResolvedValue({ success: true });
      mockBackend.staff.generatePayslip.mockResolvedValue({ success: true });

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to salary tab
      fireEvent.click(screen.getByText('Salary'));

      await waitFor(() => {
        expect(screen.getByText('Salary Management')).toBeInTheDocument();
      });

      // Add salary component
      fireEvent.click(screen.getByText('Add Salary Component'));
      await waitFor(() => {
        expect(screen.getByText('Add Salary Component')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Amount (cents)'), { target: { value: '500000' } });
      fireEvent.click(screen.getByText('Add Component'));

      // Generate payslip
      fireEvent.click(screen.getByText('Generate Payslip'));
      await waitFor(() => {
        expect(screen.getByText('Generate Payslip')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Generate'));

      // Verify payslip generation
      await waitFor(() => {
        expect(screen.getByText('$5,000.00')).toBeInTheDocument();
      });
    });

    it('should handle complete schedule management workflow', async () => {
      const staffData = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
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

      const scheduleData = {
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

      const completedScheduleData = {
        schedules: [
          {
            id: 1,
            staffId: 1,
            staffName: 'John Doe',
            shiftDate: '2023-12-01',
            startTime: '09:00:00',
            endTime: '17:00:00',
            shiftType: 'day_shift',
            status: 'completed',
            isCompleted: true,
            actualStartTime: '09:00:00',
            actualEndTime: '17:00:00',
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
      mockBackend.staff.schedules
        .mockResolvedValueOnce(scheduleData)
        .mockResolvedValueOnce(completedScheduleData);

      mockBackend.staff.createSchedule.mockResolvedValue({ success: true });
      mockBackend.staff.markScheduleComplete.mockResolvedValue({ success: true });

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to attendance tab (schedules are managed there)
      fireEvent.click(screen.getByText('Attendance'));

      await waitFor(() => {
        expect(screen.getByText('Attendance Management')).toBeInTheDocument();
      });

      // Create schedule
      fireEvent.click(screen.getByText('Add Schedule'));
      await waitFor(() => {
        expect(screen.getByText('Add Schedule')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Shift Date'), { target: { value: '2023-12-01' } });
      fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '09:00' } });
      fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '17:00' } });

      fireEvent.click(screen.getByText('Create Schedule'));

      // Mark schedule complete
      fireEvent.click(screen.getByText('Mark Complete'));
      await waitFor(() => {
        expect(screen.getByText('Mark Schedule Complete')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mark Complete'));

      // Verify schedule completion
      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });

    it('should handle complete leave management workflow', async () => {
      const staffData = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
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

      const leaveData = {
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

      const approvedLeaveData = {
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
            status: 'approved',
            requestedAt: '2023-12-01T00:00:00Z',
            reviewedAt: '2023-12-02T00:00:00Z',
            reviewedBy: 'Admin',
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

      mockBackend.staff.list.mockResolvedValue(staffData);
      mockBackend.staff.leaveRequests
        .mockResolvedValueOnce(leaveData)
        .mockResolvedValueOnce(approvedLeaveData);

      mockBackend.staff.createLeaveRequest.mockResolvedValue({ success: true });
      mockBackend.staff.approveLeaveRequest.mockResolvedValue({ success: true });

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to attendance tab (leave requests are managed there)
      fireEvent.click(screen.getByText('Attendance'));

      await waitFor(() => {
        expect(screen.getByText('Attendance Management')).toBeInTheDocument();
      });

      // Request leave
      fireEvent.click(screen.getByText('Request Leave'));
      await waitFor(() => {
        expect(screen.getByText('Request Leave')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2023-12-15' } });
      fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2023-12-17' } });
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Family vacation' } });

      fireEvent.click(screen.getByText('Submit Request'));

      // Approve leave request
      fireEvent.click(screen.getByText('Approve'));
      await waitFor(() => {
        expect(screen.getByText('Approve Leave Request')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Approve Request'));

      // Verify leave approval
      await waitFor(() => {
        expect(screen.getByText('Approved')).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should maintain data consistency across all features', async () => {
      const staffData = {
        staff: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'MANAGER',
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

      mockBackend.staff.list.mockResolvedValue(staffData);
      mockBackend.staff.listAttendance.mockResolvedValue({ attendance: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      mockBackend.staff.salaryComponents.mockResolvedValue({ salaryComponents: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      mockBackend.staff.schedules.mockResolvedValue({ schedules: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      mockBackend.staff.leaveRequests.mockResolvedValue({ leaveRequests: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      renderStaffPage();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Test all tabs
      const tabs = ['Attendance', 'Salary', 'Reports'];
      
      for (const tab of tabs) {
        fireEvent.click(screen.getByText(tab));
        await waitFor(() => {
          expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
      }

      // Verify all APIs were called
      expect(mockBackend.staff.list).toHaveBeenCalled();
      expect(mockBackend.staff.listAttendance).toHaveBeenCalled();
      expect(mockBackend.staff.salaryComponents).toHaveBeenCalled();
      expect(mockBackend.staff.schedules).toHaveBeenCalled();
      expect(mockBackend.staff.leaveRequests).toHaveBeenCalled();
    });
  });
});
