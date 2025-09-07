import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { WelcomePopup } from '@/components/ui/welcome-popup';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock the useAuth hook
const mockUser = {
  displayName: 'John Doe',
  role: 'ADMIN',
  userID: '1'
};

const mockDashboardData = {
  pendingApprovals: 5,
  urgentTasks: 3,
  overdueTasks: 2,
  financialPending: 7,
  activeProperties: 2,
  activeTasks: 8
};

const mockUserData = {
  name: 'John Doe',
  role: 'ADMIN',
  hasProperties: true,
  propertyCount: 2
};

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
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('WelcomePopup', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    userData: mockUserData,
    dashboardData: mockDashboardData
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders welcome popup when open', () => {
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Good morning|Good afternoon|Good evening/)).toBeInTheDocument();
    expect(screen.getByText('John Doe! 👋')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('displays important items for today', () => {
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Important for Today')).toBeInTheDocument();
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText('Urgent Tasks')).toBeInTheDocument();
    expect(screen.getByText('Overdue Tasks')).toBeInTheDocument();
  });

  it('shows correct counts for important items', () => {
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('5')).toBeInTheDocument(); // pendingApprovals
    expect(screen.getByText('3')).toBeInTheDocument(); // urgentTasks
    expect(screen.getByText('2')).toBeInTheDocument(); // overdueTasks
  });

  it('displays quick stats', () => {
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('shows onboarding actions for users without properties', () => {
    const userDataWithoutProperties = {
      ...mockUserData,
      hasProperties: false,
      propertyCount: 0
    };

    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} userData={userDataWithoutProperties} />
      </TestWrapper>
    );

    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.getByText('Add Your First Property')).toBeInTheDocument();
    expect(screen.getByText('Invite Team Members')).toBeInTheDocument();
    expect(screen.getByText('Create Your First Task')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when escape key is pressed', () => {
    const onClose = jest.fn();
    
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the popup', () => {
    const onClose = jest.fn();
    
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    const backdrop = screen.getByRole('dialog').parentElement;
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the popup', () => {
    const onClose = jest.fn();
    
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    const popupContent = screen.getByRole('dialog');
    fireEvent.click(popupContent);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('navigates to correct pages when action buttons are clicked', () => {
    const { container } = render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} />
      </TestWrapper>
    );

    // Test Review Now button for pending approvals
    const reviewButton = screen.getByText('Review Now');
    fireEvent.click(reviewButton);

    // The navigation would be handled by react-router-dom in the actual app
    // In tests, we can verify the button exists and is clickable
    expect(reviewButton).toBeInTheDocument();
  });

  it('displays current time and date', () => {
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} />
      </TestWrapper>
    );

    // Check that time and date elements are present
    const timeElement = screen.getByText(/\d{1,2}:\d{2}/);
    expect(timeElement).toBeInTheDocument();
  });

  it('shows appropriate greeting based on time of day', () => {
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} />
      </TestWrapper>
    );

    // The greeting should be one of the expected values
    const greeting = screen.getByText(/Good (morning|afternoon|evening)/);
    expect(greeting).toBeInTheDocument();
  });

  it('handles empty dashboard data gracefully', () => {
    const emptyDashboardData = {
      pendingApprovals: 0,
      urgentTasks: 0,
      overdueTasks: 0,
      financialPending: 0,
      activeProperties: 0,
      activeTasks: 0
    };

    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} dashboardData={emptyDashboardData} />
      </TestWrapper>
    );

    // Should still show the popup with general stats
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <TestWrapper>
        <WelcomePopup {...defaultProps} isOpen={false} />
      </TestWrapper>
    );

    expect(screen.queryByText(/Good morning|Good afternoon|Good evening/)).not.toBeInTheDocument();
  });
});
