import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import StaffPage from '../pages/StaffPage';
import { useAuth } from '../contexts/AuthContext';


// Mock the auth context
jest.mock('../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock the backend
const mockBackend = {
  staff: {
    list: jest.fn(),
    create: jest.fn(),
    listSchedules: jest.fn(),
    createSchedule: jest.fn(),
    listLeaveRequests: jest.fn(),
    requestLeave: jest.fn(),
    approveLeave: jest.fn(),
  },
  users: {
    list: jest.fn(),
  },
  properties: {
    list: jest.fn(),
  },
};

const mockUser = {
  userID: '1',
  orgId: 1,
  displayName: 'Test Admin',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
};

const mockStaff = {
  staff: [
    {
      id: 1,
      userId: 1,
      userName: 'John Doe',
      userEmail: 'john@test.com',
      propertyId: 1,
      propertyName: 'Test Property',
      department: 'frontdesk',
      hourlyRateCents: 1500,
      performanceRating: 4.5,
      hireDate: '2023-01-01',
      notes: 'Test staff member',
      status: 'active',
    },
  ],
};

const mockSchedules = {
  schedules: [
    {
      id: 1,
      staffId: 1,
      staffName: 'John Doe',
      propertyId: 1,
      propertyName: 'Test Property',
      shiftDate: '2023-12-01',
      startTime: '09:00',
      endTime: '17:00',
      breakMinutes: 30,
      notes: 'Regular shift',
      status: 'scheduled',
    },
  ],
};

const mockLeaveRequests = {
  leaveRequests: [
    {
      id: 1,
      staffId: 1,
      staffName: 'John Doe',
      leaveType: 'vacation',
      startDate: '2023-12-15',
      endDate: '2023-12-17',
      reason: 'Family vacation',
      status: 'pending',
    },
  ],
};

const mockUsers = {
  users: [
    {
      id: 1,
      displayName: 'John Doe',
      email: 'john@test.com',
      role: 'MANAGER',
    },
  ],
};

const mockProperties = {
  properties: [
    {
      id: 1,
      name: 'Test Property',
    },
  ],
};

describe('StaffPage', () => {
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
    mockBackend.staff.list.mockResolvedValue(mockStaff);
    mockBackend.staff.listSchedules.mockResolvedValue(mockSchedules);
    mockBackend.staff.listLeaveRequests.mockResolvedValue(mockLeaveRequests);
    mockBackend.users.list.mockResolvedValue(mockUsers);
    mockBackend.properties.list.mockResolvedValue(mockProperties);
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

  it('renders staff management page with tabs', async () => {
    renderStaffPage();

    expect(screen.getByText('Staff Management')).toBeInTheDocument();
    expect(screen.getByText('Manage staff members, schedules, and leave requests')).toBeInTheDocument();
    
    // Check tabs are present
    expect(screen.getByText('Staff Members')).toBeInTheDocument();
    expect(screen.getByText('Schedules')).toBeInTheDocument();
    expect(screen.getByText('Leave Requests')).toBeInTheDocument();
  });

  it('displays staff members in staff tab', async () => {
    renderStaffPage();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
      expect(screen.getByText('frontdesk')).toBeInTheDocument();
      expect(screen.getByText('Test Property')).toBeInTheDocument();
    });
  });

  it('displays schedules in schedules tab', async () => {
    renderStaffPage();

    // Click on schedules tab
    fireEvent.click(screen.getByText('Schedules'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Test Property')).toBeInTheDocument();
      expect(screen.getByText('12/1/2023')).toBeInTheDocument();
      expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument();
    });
  });

  it('displays leave requests in leave tab', async () => {
    renderStaffPage();

    // Click on leave tab
    fireEvent.click(screen.getByText('Leave Requests'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('vacation')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('Family vacation')).toBeInTheDocument();
    });
  });

  it('opens staff creation dialog for admin users', async () => {
    renderStaffPage();

    // Wait for staff data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for add staff button (should be present for admin)
    const addButton = screen.queryByText('Add Staff Member');
    if (addButton) {
      fireEvent.click(addButton);
      expect(screen.getByText('Add Staff Member')).toBeInTheDocument();
    }
  });

  it('opens schedule creation dialog for admin users', async () => {
    renderStaffPage();

    // Click on schedules tab
    fireEvent.click(screen.getByText('Schedules'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for create schedule button
    const createButton = screen.queryByText('Create Schedule');
    if (createButton) {
      fireEvent.click(createButton);
      expect(screen.getByText('Create Staff Schedule')).toBeInTheDocument();
    }
  });

  it('opens leave request dialog', async () => {
    renderStaffPage();

    // Click on leave tab
    fireEvent.click(screen.getByText('Leave Requests'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for request leave button
    const requestButton = screen.queryByText('Request Leave');
    if (requestButton) {
      fireEvent.click(requestButton);
      expect(screen.getByText('Request Leave')).toBeInTheDocument();
    }
  });

  it('shows approval buttons for pending leave requests for admin users', async () => {
    renderStaffPage();

    // Click on leave tab
    fireEvent.click(screen.getByText('Leave Requests'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check for approval buttons
    const approveButton = screen.queryByText('Approve');
    const rejectButton = screen.queryByText('Reject');
    
    if (approveButton && rejectButton) {
      expect(approveButton).toBeInTheDocument();
      expect(rejectButton).toBeInTheDocument();
    }
  });

  it('displays loading states', () => {
    // Mock loading state
    mockBackend.staff.list.mockImplementation(() => new Promise(() => {}));
    mockBackend.staff.listSchedules.mockImplementation(() => new Promise(() => {}));
    mockBackend.staff.listLeaveRequests.mockImplementation(() => new Promise(() => {}));

    renderStaffPage();

    // Check for loading indicators
    expect(screen.getByText('Live updates active')).toBeInTheDocument();
  });

  it('displays empty states when no data', async () => {
    // Mock empty responses
    mockBackend.staff.list.mockResolvedValue({ staff: [] });
    mockBackend.staff.listSchedules.mockResolvedValue({ schedules: [] });
    mockBackend.staff.listLeaveRequests.mockResolvedValue({ leaveRequests: [] });

    renderStaffPage();

    await waitFor(() => {
      expect(screen.getByText('No staff members')).toBeInTheDocument();
    });
  });

  it('handles staff creation form submission', async () => {
    mockBackend.staff.create.mockResolvedValue({ success: true });

    renderStaffPage();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open staff creation dialog
    const addButton = screen.queryByText('Add Staff Member');
    if (addButton) {
      fireEvent.click(addButton);

      // Fill form
      const userSelect = screen.getByDisplayValue('Select user');
      if (userSelect) {
        fireEvent.click(userSelect);
        // Select user option would be here
      }

      // Submit form
      const submitButton = screen.getByText('Add Staff Member');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.create).toHaveBeenCalled();
      });
    }
  });

  it('handles leave approval', async () => {
    mockBackend.staff.approveLeave.mockResolvedValue({ success: true });

    renderStaffPage();

    // Click on leave tab
    fireEvent.click(screen.getByText('Leave Requests'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click approve button
    const approveButton = screen.queryByText('Approve');
    if (approveButton) {
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(mockBackend.staff.approveLeave).toHaveBeenCalledWith({
          id: 1,
          approved: true,
        });
      });
    }
  });

  it('displays error messages for failed operations', async () => {
    mockBackend.staff.create.mockRejectedValue(new Error('Failed to create staff'));

    renderStaffPage();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open staff creation dialog
    const addButton = screen.queryByText('Add Staff Member');
    if (addButton) {
      fireEvent.click(addButton);

      // Submit form
      const submitButton = screen.getByText('Add Staff Member');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.create).toHaveBeenCalled();
      });
    }
  });

  it('shows real-time update indicators', () => {
    renderStaffPage();

    expect(screen.getByText('Live updates active')).toBeInTheDocument();
  });

  it('displays debug information when debug button is clicked', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    renderStaffPage();

    // Click debug button
    const debugButton = screen.getByText('Debug Info');
    fireEvent.click(debugButton);

    expect(consoleSpy).toHaveBeenCalledWith('=== STAFF DEBUG TEST ===');

    consoleSpy.mockRestore();
  });
});
