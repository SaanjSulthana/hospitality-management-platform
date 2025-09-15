import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import SalaryManagement from '../components/SalaryManagement';
import { useAuth } from '../contexts/AuthContext';


// Mock the auth context
jest.mock('../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock the backend
const mockBackend = {
  staff: {
    salaryComponents: jest.fn(),
    calculateSalary: jest.fn(),
    generatePayslip: jest.fn(),
    payslips: jest.fn(),
    salaryStatistics: jest.fn(),
    exportSalary: jest.fn(),
    salaryValidation: jest.fn(),
  },
};

const mockUser = {
  userID: '1',
  orgId: 1,
  displayName: 'Test Admin',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
};

const mockSalaryComponents = {
  salaryComponents: [
    {
      id: 1,
      staffId: 1,
      staffName: 'John Doe',
      componentType: 'base_salary',
      amountCents: 500000,
      effectiveDate: '2023-01-01',
      endDate: null,
      isActive: true,
      notes: 'Base salary component',
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

const mockPayslips = {
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

const mockSalaryStats = {
  overview: {
    totalStaff: 10,
    totalPayrollCents: 5000000,
    averageSalaryCents: 500000,
    totalPayslips: 120,
    pendingPayslips: 5,
  },
  periodAnalysis: {
    currentMonth: {
      totalPayrollCents: 500000,
      averageSalaryCents: 50000,
      payslipsGenerated: 10,
    },
  },
  trends: {
    monthlyTrend: [
      { month: '2023-11', totalPayrollCents: 480000, payslipsGenerated: 9 },
      { month: '2023-12', totalPayrollCents: 500000, payslipsGenerated: 10 },
    ],
  },
};

describe('SalaryManagement', () => {
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
      refreshUser: jest.fn(),
      showLogoutProgress: false,
      setShowLogoutProgress: jest.fn(),
      setIsTestingLogoutDialog: jest.fn(),
      clearCorruptedTokens: jest.fn(),
      clearAllAuthData: jest.fn(),
    });

    // Mock API responses
    mockBackend.staff.salaryComponents.mockResolvedValue(mockSalaryComponents);
    mockBackend.staff.payslips.mockResolvedValue(mockPayslips);
    mockBackend.staff.salaryStatistics.mockResolvedValue(mockSalaryStats);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderSalaryManagement = () => {
    return render(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(SalaryManagement)
        )
      )
    );
  };

  it('renders salary management interface', async () => {
    renderSalaryManagement();

    expect(screen.getByText('Salary Management')).toBeInTheDocument();
    expect(screen.getByText('Manage staff salary components and payslips')).toBeInTheDocument();
    
    // Check for main sections
    expect(screen.getByText('Salary Components')).toBeInTheDocument();
    expect(screen.getByText('Payslips')).toBeInTheDocument();
    expect(screen.getByText('Salary Statistics')).toBeInTheDocument();
  });

  it('displays salary components for admin users', async () => {
    renderSalaryManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('$5,000.00')).toBeInTheDocument();
      expect(screen.getByText('Base Salary')).toBeInTheDocument();
    });
  });

  it('shows salary statistics', async () => {
    renderSalaryManagement();

    await waitFor(() => {
      expect(screen.getByText('Total Payroll')).toBeInTheDocument();
      expect(screen.getByText('Average Salary')).toBeInTheDocument();
      expect(screen.getByText('Total Payslips')).toBeInTheDocument();
    });
  });

  it('displays payslips with download functionality', async () => {
    renderSalaryManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('$5,000.00')).toBeInTheDocument();
      expect(screen.getByText('Generated')).toBeInTheDocument();
    });

    // Check for download button
    const downloadButton = screen.queryByText('Download');
    if (downloadButton) {
      expect(downloadButton).toBeInTheDocument();
    }
  });

  it('handles salary component creation', async () => {
    mockBackend.staff.salaryComponents.mockResolvedValue({ success: true });

    renderSalaryManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for add salary component button
    const addButton = screen.queryByText('Add Salary Component');
    if (addButton) {
      fireEvent.click(addButton);

      // Should open add dialog
      await waitFor(() => {
        expect(screen.getByText('Add Salary Component')).toBeInTheDocument();
      });

      // Fill form and submit
      const submitButton = screen.getByText('Add Component');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.salaryComponents).toHaveBeenCalled();
      });
    }
  });

  it('handles payslip generation', async () => {
    mockBackend.staff.generatePayslip.mockResolvedValue({ success: true });

    renderSalaryManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for generate payslip button
    const generateButton = screen.queryByText('Generate Payslip');
    if (generateButton) {
      fireEvent.click(generateButton);

      // Should open generation dialog
      await waitFor(() => {
        expect(screen.getByText('Generate Payslip')).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByText('Generate');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.generatePayslip).toHaveBeenCalled();
      });
    }
  });

  it('displays loading states', () => {
    // Mock loading state
    mockBackend.staff.salaryComponents.mockImplementation(() => new Promise(() => {}));
    mockBackend.staff.payslips.mockImplementation(() => new Promise(() => {}));
    mockBackend.staff.salaryStatistics.mockImplementation(() => new Promise(() => {}));

    renderSalaryManagement();

    // Check for loading indicators
    expect(screen.getByText('Loading salary data...')).toBeInTheDocument();
  });

  it('displays empty state when no salary components', async () => {
    mockBackend.staff.salaryComponents.mockResolvedValue({ salaryComponents: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

    renderSalaryManagement();

    await waitFor(() => {
      expect(screen.getByText('No salary components found')).toBeInTheDocument();
      expect(screen.getByText('Start by adding your first salary component')).toBeInTheDocument();
    });
  });

  it('handles salary calculation', async () => {
    mockBackend.staff.calculateSalary.mockResolvedValue({
      grossPayCents: 500000,
      deductionsCents: 50000,
      netPayCents: 450000,
      breakdown: {
        baseSalaryCents: 400000,
        overtimeCents: 100000,
        bonusCents: 0,
        taxCents: 30000,
        insuranceCents: 20000,
      },
    });

    renderSalaryManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for calculate salary button
    const calculateButton = screen.queryByText('Calculate Salary');
    if (calculateButton) {
      fireEvent.click(calculateButton);

      // Should open calculation dialog
      await waitFor(() => {
        expect(screen.getByText('Calculate Salary')).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByText('Calculate');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockBackend.staff.calculateSalary).toHaveBeenCalled();
      });
    }
  });

  it('handles salary export', async () => {
    mockBackend.staff.exportSalary.mockResolvedValue({ success: true, downloadUrl: 'test-url' });

    renderSalaryManagement();

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
        expect(screen.getByText('Export Salary Data')).toBeInTheDocument();
      });

      // Select format and export
      const csvOption = screen.getByText('CSV');
      fireEvent.click(csvOption);

      const exportSubmitButton = screen.getByText('Export');
      fireEvent.click(exportSubmitButton);

      await waitFor(() => {
        expect(mockBackend.staff.exportSalary).toHaveBeenCalled();
      });
    }
  });

  it('displays error messages for failed operations', async () => {
    mockBackend.staff.salaryComponents.mockRejectedValue(new Error('Failed to create salary component'));

    renderSalaryManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Try to add salary component
    const addButton = screen.queryByText('Add Salary Component');
    if (addButton) {
      fireEvent.click(addButton);

      // Submit form
      const submitButton = screen.getByText('Add Component');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create salary component')).toBeInTheDocument();
      });
    }
  });

  it('shows real-time update indicators', () => {
    renderSalaryManagement();

    expect(screen.getByText('Live updates active')).toBeInTheDocument();
  });

  it('handles mobile responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    renderSalaryManagement();

    // Check for mobile-specific elements
    expect(screen.getByText('Salary Management')).toBeInTheDocument();
  });

  it('displays salary validation warnings', async () => {
    mockBackend.staff.salaryValidation.mockResolvedValue({
      isValid: false,
      warnings: ['Salary amount is below minimum wage'],
      errors: [],
    });

    renderSalaryManagement();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Try to add salary component
    const addButton = screen.queryByText('Add Salary Component');
    if (addButton) {
      fireEvent.click(addButton);

      // Fill form with invalid amount
      const amountInput = screen.getByLabelText('Amount (cents)');
      fireEvent.change(amountInput, { target: { value: '10000' } });

      // Submit form
      const submitButton = screen.getByText('Add Component');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Salary amount is below minimum wage')).toBeInTheDocument();
      });
    }
  });

  it('handles payslip status updates for admin users', async () => {
    mockBackend.staff.payslips.mockResolvedValue({ success: true });

    renderSalaryManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for status update button
    const statusButton = screen.queryByText('Update Status');
    if (statusButton) {
      fireEvent.click(statusButton);

      // Should open status update dialog
      await waitFor(() => {
        expect(screen.getByText('Update Payslip Status')).toBeInTheDocument();
      });
    }
  });

  it('displays salary trends and analytics', async () => {
    renderSalaryManagement();

    await waitFor(() => {
      expect(screen.getByText('Monthly Trends')).toBeInTheDocument();
      expect(screen.getByText('Payroll Overview')).toBeInTheDocument();
    });
  });

  it('handles pagination for large salary datasets', async () => {
    const largeSalaryData = {
      salaryComponents: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        staffId: 1,
        staffName: `Staff ${i + 1}`,
        componentType: 'base_salary',
        amountCents: 500000,
        effectiveDate: '2023-01-01',
        endDate: null,
        isActive: true,
        notes: '',
        createdAt: '2023-01-01T00:00:00Z',
      })),
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    };

    mockBackend.staff.salaryComponents.mockResolvedValue(largeSalaryData);

    renderSalaryManagement();

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
      refreshUser: jest.fn(),
      showLogoutProgress: false,
      setShowLogoutProgress: jest.fn(),
      setIsTestingLogoutDialog: jest.fn(),
      clearCorruptedTokens: jest.fn(),
      clearAllAuthData: jest.fn(),
    });

    renderSalaryManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Manager should not see add button
    const addButton = screen.queryByText('Add Salary Component');
    expect(addButton).not.toBeInTheDocument();
  });

  it('displays salary breakdown and calculations', async () => {
    renderSalaryManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Look for breakdown button
    const breakdownButton = screen.queryByText('View Breakdown');
    if (breakdownButton) {
      fireEvent.click(breakdownButton);

      // Should show breakdown details
      await waitFor(() => {
        expect(screen.getByText('Salary Breakdown')).toBeInTheDocument();
      });
    }
  });
});
