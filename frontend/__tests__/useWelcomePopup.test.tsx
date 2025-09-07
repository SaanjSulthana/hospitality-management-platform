import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWelcomePopup } from '@/hooks/use-welcome-popup';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock the useAuth hook
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      displayName: 'John Doe',
      role: 'ADMIN',
      userID: '1'
    },
    getAuthenticatedBackend: jest.fn(() => ({
      properties: {
        list: jest.fn(() => Promise.resolve({ properties: [{ id: 1, name: 'Test Property' }] }))
      },
      tasks: {
        list: jest.fn(() => Promise.resolve({ tasks: [{ id: 1, title: 'Test Task', status: 'pending' }] }))
      },
      finance: {
        listExpenses: jest.fn(() => Promise.resolve({ expenses: [{ id: 1, status: 'pending' }] })),
        listRevenues: jest.fn(() => Promise.resolve({ revenues: [{ id: 1, status: 'pending' }] }))
      },
      staff: {
        listLeaveRequests: jest.fn(() => Promise.resolve({ leaveRequests: [{ id: 1, status: 'pending' }] }))
      }
    }))
  })
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('useWelcomePopup', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    expect(result.current.showWelcomePopup).toBe(false);
    expect(result.current.closeWelcomePopup).toBeInstanceOf(Function);
    expect(result.current.resetWelcomePopup).toBeInstanceOf(Function);
    expect(result.current.dashboardData).toBeDefined();
    expect(result.current.userData).toBeDefined();
  });

  it('shows welcome popup for new user', async () => {
    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    // Wait for the effect to run
    await waitFor(() => {
      expect(result.current.showWelcomePopup).toBe(true);
    }, { timeout: 2000 });
  });

  it('does not show welcome popup if user has seen it before', () => {
    // Set localStorage to indicate user has seen welcome popup
    localStorage.setItem('hasSeenWelcome', 'true');

    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    expect(result.current.showWelcomePopup).toBe(false);
  });

  it('closes welcome popup when closeWelcomePopup is called', async () => {
    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    // Wait for popup to show
    await waitFor(() => {
      expect(result.current.showWelcomePopup).toBe(true);
    });

    // Close the popup
    result.current.closeWelcomePopup();

    expect(result.current.showWelcomePopup).toBe(false);
  });

  it('resets welcome popup state when resetWelcomePopup is called', async () => {
    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    // Wait for popup to show
    await waitFor(() => {
      expect(result.current.showWelcomePopup).toBe(true);
    });

    // Reset the popup
    result.current.resetWelcomePopup();

    expect(result.current.showWelcomePopup).toBe(false);
    expect(localStorage.getItem('hasSeenWelcome')).toBeNull();
  });

  it('calculates dashboard data correctly', async () => {
    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    await waitFor(() => {
      expect(result.current.dashboardData).toBeDefined();
    });

    // Check that dashboard data has the expected structure
    expect(result.current.dashboardData).toHaveProperty('pendingApprovals');
    expect(result.current.dashboardData).toHaveProperty('urgentTasks');
    expect(result.current.dashboardData).toHaveProperty('overdueTasks');
    expect(result.current.dashboardData).toHaveProperty('financialPending');
    expect(result.current.dashboardData).toHaveProperty('activeProperties');
    expect(result.current.dashboardData).toHaveProperty('activeTasks');
  });

  it('calculates user data correctly', async () => {
    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    await waitFor(() => {
      expect(result.current.userData).toBeDefined();
    });

    // Check that user data has the expected structure
    expect(result.current.userData).toHaveProperty('name');
    expect(result.current.userData).toHaveProperty('role');
    expect(result.current.userData).toHaveProperty('hasProperties');
    expect(result.current.userData).toHaveProperty('propertyCount');
  });

  it('sets hasProperties to true when user has properties', async () => {
    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    await waitFor(() => {
      expect(result.current.userData.hasProperties).toBe(true);
    });
  });

  it('handles loading state correctly', () => {
    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);
  });

  it('does not show popup when user is not logged in', () => {
    // Mock no user
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: null,
        getAuthenticatedBackend: jest.fn()
      })
    }));

    const { result } = renderHook(() => useWelcomePopup(), {
      wrapper: TestWrapper
    });

    expect(result.current.showWelcomePopup).toBe(false);
  });
});