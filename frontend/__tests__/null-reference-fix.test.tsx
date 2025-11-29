import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MonthlyYearlyReports } from '../components/ui/monthly-yearly-reports';
import { safeApiCall, safeDataAccess } from '../utils/safeApiCall';

// Mock the auth context
const mockAuthContext = {
  getAuthenticatedBackend: jest.fn(),
  user: { id: 1, name: 'Test User' },
  isAuthenticated: true,
  login: jest.fn(),
  logout: jest.fn(),
};

// Mock the theme context
const mockThemeContext = {
  theme: 'light',
  toggleTheme: jest.fn(),
};

// Mock the contexts
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

jest.mock('../contexts/ThemeContext', () => ({
  useTheme: () => mockThemeContext,
}));

// Mock the backend
const mockBackend = {
  reports: {
    getDailyReports: jest.fn(),
  },
};

describe('Null Reference Error Fix', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockAuthContext.getAuthenticatedBackend.mockReturnValue(mockBackend);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle null API responses gracefully', async () => {
    // Mock API returning null
    mockBackend.reports.getDailyReports.mockResolvedValue(null);

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyYearlyReports />
      </QueryClientProvider>
    );

    // Should not crash and should show appropriate UI
    await waitFor(() => {
      expect(screen.getByText(/No reports data available/i)).toBeInTheDocument();
    });
  });

  it('should handle API responses with null reports property', async () => {
    // Mock API returning object with null reports
    mockBackend.reports.getDailyReports.mockResolvedValue({ reports: null });

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyYearlyReports />
      </QueryClientProvider>
    );

    // Should not crash and should show appropriate UI
    await waitFor(() => {
      expect(screen.getByText(/No reports data available/i)).toBeInTheDocument();
    });
  });

  it('should handle API responses with undefined reports property', async () => {
    // Mock API returning object with undefined reports
    mockBackend.reports.getDailyReports.mockResolvedValue({ reports: undefined });

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyYearlyReports />
      </QueryClientProvider>
    );

    // Should not crash and should show appropriate UI
    await waitFor(() => {
      expect(screen.getByText(/No reports data available/i)).toBeInTheDocument();
    });
  });

  it('should handle API responses with empty reports array', async () => {
    // Mock API returning object with empty reports array
    mockBackend.reports.getDailyReports.mockResolvedValue({ reports: [] });

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyYearlyReports />
      </QueryClientProvider>
    );

    // Should not crash and should show appropriate UI
    await waitFor(() => {
      expect(screen.getByText(/No reports data available/i)).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    // Mock API throwing an error
    mockBackend.reports.getDailyReports.mockRejectedValue(new Error('Network error'));

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyYearlyReports />
      </QueryClientProvider>
    );

    // Should not crash and should show error UI
    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });

  it('should handle malformed API responses', async () => {
    // Mock API returning malformed data
    mockBackend.reports.getDailyReports.mockResolvedValue({ 
      reports: [
        { openingBalanceCents: null, cashReceivedCents: undefined },
        { openingBalanceCents: 1000, cashReceivedCents: 500 }
      ]
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyYearlyReports />
      </QueryClientProvider>
    );

    // Should not crash and should handle null/undefined values in calculations
    await waitFor(() => {
      expect(screen.getByText(/₹10.00/)).toBeInTheDocument(); // 1000 cents = ₹10.00
    });
  });
});

describe('Safe API Call Utility', () => {
  it('should handle null responses in safeApiCall', async () => {
    const mockApiCall = jest.fn().mockResolvedValue(null);
    
    await expect(safeApiCall(mockApiCall)).rejects.toThrow('API returned null or undefined');
  });

  it('should handle undefined responses in safeApiCall', async () => {
    const mockApiCall = jest.fn().mockResolvedValue(undefined);
    
    await expect(safeApiCall(mockApiCall)).rejects.toThrow('API returned null or undefined');
  });

  it('should retry on network errors', async () => {
    const mockApiCall = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ data: 'success' });
    
    const result = await safeApiCall(mockApiCall, { maxRetries: 2, baseDelay: 10 });
    expect(result).toEqual({ data: 'success' });
    expect(mockApiCall).toHaveBeenCalledTimes(3);
  });

  it('should not retry on authentication errors', async () => {
    const mockApiCall = jest.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' });
    
    await expect(safeApiCall(mockApiCall)).rejects.toThrow('Unauthorized');
    expect(mockApiCall).toHaveBeenCalledTimes(1);
  });
});

describe('Safe Data Access Utility', () => {
  it('should return default value for null data', () => {
    const result = safeDataAccess(null, 'reports', []);
    expect(result).toEqual([]);
  });

  it('should return default value for undefined data', () => {
    const result = safeDataAccess(undefined, 'reports', []);
    expect(result).toEqual([]);
  });

  it('should return default value for missing property', () => {
    const data = { other: 'value' };
    const result = safeDataAccess(data, 'reports', []);
    expect(result).toEqual([]);
  });

  it('should return actual value when property exists', () => {
    const data = { reports: [{ id: 1 }] };
    const result = safeDataAccess(data, 'reports', []);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('should handle nested property access', () => {
    const data = { user: { profile: { name: 'John' } } };
    const result = safeDataAccess(data, 'user.profile.name', 'Unknown');
    expect(result).toBe('John');
  });

  it('should return default value for nested missing property', () => {
    const data = { user: { profile: {} } };
    const result = safeDataAccess(data, 'user.profile.name', 'Unknown');
    expect(result).toBe('Unknown');
  });
});
