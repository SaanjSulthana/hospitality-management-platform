import React from 'react';
import { render, screen } from '@testing-library/react';
import { ReceiptViewer } from '../../../components/ui/receipt-viewer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../contexts/AuthContext';
import { ThemeProvider } from '../../../contexts/ThemeContext';

// Mock the auth context
const mockAuthContext = {
  getAuthenticatedBackend: jest.fn(),
  user: { userID: '1', role: 'ADMIN' },
  login: jest.fn(),
  logout: jest.fn(),
  isAuthenticated: true,
};

// Mock the theme context
const mockThemeContext = {
  theme: { currency: 'INR' },
  setTheme: jest.fn(),
};

// Mock the API_CONFIG
jest.mock('../../../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://localhost:4000',
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('ReceiptViewer Approval Information', () => {
  const mockTransaction = {
    id: 1,
    type: 'expense' as const,
    category: 'supplies',
    propertyName: 'Test Property',
    amountCents: 5000,
    description: 'Test expense',
    date: new Date('2024-01-15'),
    createdByName: 'John Doe',
    status: 'approved',
    paymentMode: 'cash',
    bankReference: 'REF123',
    approvedByName: 'Admin User',
    approvedAt: new Date('2024-01-15T10:30:00Z'),
  };

  it('should display approval information for approved transactions', () => {
    render(
      <ReceiptViewer
        isOpen={true}
        onClose={jest.fn()}
        transaction={mockTransaction}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Approved By')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('1/15/2024 at 10:30:00 AM')).toBeInTheDocument();
  });

  it('should display rejection information for rejected transactions', () => {
    const rejectedTransaction = {
      ...mockTransaction,
      status: 'rejected',
      approvedByName: 'Admin User',
      approvedAt: new Date('2024-01-15T10:30:00Z'),
    };

    render(
      <ReceiptViewer
        isOpen={true}
        onClose={jest.fn()}
        transaction={rejectedTransaction}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Rejected By')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('1/15/2024 at 10:30:00 AM')).toBeInTheDocument();
  });

  it('should display pending status for pending transactions', () => {
    const pendingTransaction = {
      ...mockTransaction,
      status: 'pending',
      approvedByName: undefined,
      approvedAt: undefined,
    };

    render(
      <ReceiptViewer
        isOpen={true}
        onClose={jest.fn()}
        transaction={pendingTransaction}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Awaiting admin review')).toBeInTheDocument();
  });

  it('should handle missing approval information gracefully', () => {
    const transactionWithoutApproval = {
      ...mockTransaction,
      status: 'approved',
      approvedByName: undefined,
      approvedAt: undefined,
    };

    render(
      <ReceiptViewer
        isOpen={true}
        onClose={jest.fn()}
        transaction={transactionWithoutApproval}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Approved By')).toBeInTheDocument();
    expect(screen.getByText('System Action')).toBeInTheDocument();
    expect(screen.getByText('Auto-approved')).toBeInTheDocument();
  });
});

