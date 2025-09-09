import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { LogoutProgress } from '../../../components/ui/logout-progress';

// Mock the dialog components
jest.mock('../../components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => 
    open ? React.createElement('div', { 'data-testid': 'dialog' }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'dialog-content' }, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'dialog-title' }, children),
}));

// Mock the progress component
jest.mock('../../components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className: string }) => 
    React.createElement('div', { 'data-testid': 'progress', 'data-value': value, className }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  CheckCircle: () => React.createElement('div', { 'data-testid': 'check-circle' }),
  Circle: () => React.createElement('div', { 'data-testid': 'circle' }),
  Loader2: () => React.createElement('div', { 'data-testid': 'loader' }),
  Shield: () => React.createElement('div', { 'data-testid': 'shield' }),
  Database: () => React.createElement('div', { 'data-testid': 'database' }),
  LogOut: () => React.createElement('div', { 'data-testid': 'log-out' }),
  UserX: () => React.createElement('div', { 'data-testid': 'user-x' }),
  Lock: () => React.createElement('div', { 'data-testid': 'lock' }),
}));

describe('LogoutProgress', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not render when isOpen is false', () => {
    render(
      <LogoutProgress 
        isOpen={false} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <LogoutProgress 
        isOpen={true} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Signing you out...')).toBeInTheDocument();
  });

  it('should start at step 0 with 0% progress', () => {
    render(
      <LogoutProgress 
        isOpen={true} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    const progress = screen.getByTestId('progress');
    expect(progress).toHaveAttribute('data-value', '0');
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
  });

  it('should progress through all steps without getting stuck', async () => {
    render(
      <LogoutProgress 
        isOpen={true} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    // Fast-forward through all steps
    act(() => {
      jest.advanceTimersByTime(5000); // Total duration of all steps
    });
    
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('should complete within maximum timeout', async () => {
    render(
      <LogoutProgress 
        isOpen={true} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    // Fast-forward past maximum timeout (6 seconds)
    act(() => {
      jest.advanceTimersByTime(7000);
    });
    
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('should reset state when isOpen changes to false', () => {
    const { rerender } = render(
      <LogoutProgress 
        isOpen={true} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    // Advance time to step 2
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    // Close dialog
    rerender(
      <LogoutProgress 
        isOpen={false} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    // Reopen dialog - should start from beginning
    rerender(
      <LogoutProgress 
        isOpen={true} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    const progress = screen.getByTestId('progress');
    expect(progress).toHaveAttribute('data-value', '0');
  });

  it('should not call onComplete multiple times', async () => {
    render(
      <LogoutProgress 
        isOpen={true} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    // Fast-forward through all steps
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
    
    // Fast-forward more time
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    
    // Should still only be called once
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });
});
