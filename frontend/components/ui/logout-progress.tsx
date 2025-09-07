import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Progress } from './progress';
import { CheckCircle, Circle, Loader2, Shield, Database, LogOut, UserX, Lock } from 'lucide-react';

interface LogoutProgressProps {
  isOpen: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
}

interface ProgressStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  duration: number; // in milliseconds
}

const logoutSteps: ProgressStep[] = [
  {
    id: 'session',
    label: 'Securing your session...',
    description: 'Saving your work and preferences',
    icon: <Shield className="h-4 w-4" />,
    duration: 800,
  },
  {
    id: 'activity',
    label: 'Recording logout activity...',
    description: 'Updating your activity log',
    icon: <UserX className="h-4 w-4" />,
    duration: 700,
  },
  {
    id: 'cache',
    label: 'Clearing cached data...',
    description: 'Removing sensitive information',
    icon: <Database className="h-4 w-4" />,
    duration: 800,
  },
  {
    id: 'tokens',
    label: 'Revoking access tokens...',
    description: 'Invalidating authentication tokens',
    icon: <Lock className="h-4 w-4" />,
    duration: 700,
  },
  {
    id: 'complete',
    label: 'Logout successful!',
    description: 'You have been securely logged out',
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    duration: 600,
  },
];

export function LogoutProgress({ isOpen, onComplete, onCancel }: LogoutProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  
  // Use refs to track execution state and prevent overlapping runs
  const isExecutingRef = useRef(false);
  const isCompletedRef = useRef(false);
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalRefs = useRef<Set<NodeJS.Timeout>>(new Set());

  // Debug logging - only when dialog is open
  if (process.env.NODE_ENV === 'development' && isOpen) {
    console.log('LogoutProgress component - isOpen:', isOpen, 'currentStep:', currentStep, 'progress:', progress);
  }

  // Clear all timers helper
  const clearAllTimers = useCallback(() => {
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    intervalRefs.current.forEach(interval => clearInterval(interval));
    timeoutRefs.current.clear();
    intervalRefs.current.clear();
  }, []);

  // Reset state helper
  const resetState = useCallback(() => {
    console.log('🔄 Resetting logout progress state');
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setProgress(0);
    isExecutingRef.current = false;
    isCompletedRef.current = false;
  }, []);

  // Atomic step progression function
  const runStepProgression = useCallback(() => {
    if (isExecutingRef.current || isCompletedRef.current) {
      console.log('🚫 Step progression already running or completed, skipping');
      return;
    }

    isExecutingRef.current = true;
    console.log('🚀 Starting step progression');
    
    // Reset refs to ensure clean start
    isCompletedRef.current = false;

    let currentStepIndex = 0;
    const totalSteps = logoutSteps.length;
    const maxTimeout = 6000; // 6 seconds maximum

    // Set up maximum timeout protection
    const maxTimeoutId = setTimeout(() => {
      if (isCompletedRef.current) return;
      
      console.warn('⚠️ Logout progress timeout, forcing completion');
      isCompletedRef.current = true;
      setCurrentStep(totalSteps - 1);
      setCompletedSteps(new Set(logoutSteps.map((_, index) => index)));
      setProgress(100);
      
      setTimeout(() => {
        onComplete?.();
        isExecutingRef.current = false;
      }, 500);
    }, maxTimeout);
    
    timeoutRefs.current.add(maxTimeoutId);

    // Execute each step
    const executeStep = (stepIndex: number) => {
      if (isCompletedRef.current || stepIndex >= totalSteps) {
        // All steps completed
        isCompletedRef.current = true;
        setCurrentStep(totalSteps - 1);
        setCompletedSteps(new Set(logoutSteps.map((_, index) => index)));
        setProgress(100);
        
        console.log('✅ All steps completed');
        
        setTimeout(() => {
          onComplete?.();
          isExecutingRef.current = false;
        }, 500);
        return;
      }

      const step = logoutSteps[stepIndex];
      console.log(`🔄 Executing step ${stepIndex + 1}: ${step.label}`);
      
      setCurrentStep(stepIndex);
      
      // Calculate progress based on step completion
      const stepProgress = (stepIndex / totalSteps) * 100;
      console.log(`📊 Setting progress to ${stepProgress}% for step ${stepIndex + 1}`);
      setProgress(stepProgress);
      
      // Mark step as completed after its duration
      const stepTimeout = setTimeout(() => {
        if (isCompletedRef.current) return;
        
        setCompletedSteps(prev => new Set([...prev, stepIndex]));
        console.log(`✅ Completed step ${stepIndex + 1}: ${step.label}`);
        
        // Update progress to show step completion
        const completedProgress = ((stepIndex + 1) / totalSteps) * 100;
        console.log(`📊 Updating progress to ${completedProgress}% after completing step ${stepIndex + 1}`);
        setProgress(completedProgress);
        
        // Move to next step
        executeStep(stepIndex + 1);
      }, step.duration);
      
      timeoutRefs.current.add(stepTimeout);
    };

    // Start first step immediately
    console.log('🚀 Starting first step execution');
    executeStep(0);
  }, [onComplete]);

  useEffect(() => {
    if (!isOpen) {
      clearAllTimers();
      resetState();
      return;
    }

    // Start progression immediately when dialog opens
    console.log('🚀 Dialog opened, starting step progression');
    runStepProgression();

    return () => {
      clearAllTimers();
    };
  }, [isOpen, runStepProgression, clearAllTimers, resetState]);

  const getStepIcon = (stepIndex: number, step: ProgressStep) => {
    if (completedSteps.has(stepIndex)) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-4 w-4 animate-spin text-red-500" />;
    } else {
      return <Circle className="h-4 w-4 text-gray-300" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Logout Progress</DialogTitle>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          {/* Header */}
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 text-red-500 animate-spin mx-auto" />
            <h2 className="text-lg font-semibold text-gray-900">Signing you out...</h2>
            <p className="text-sm text-gray-500">Please wait while we securely log you out</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full space-y-2">
            <Progress value={progress} className="w-full h-2" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{Math.round(progress)}%</span>
              <span>{currentStep + 1} of {logoutSteps.length}</span>
            </div>
          </div>

          {/* Current Step Only */}
          <div className="w-full">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {getStepIcon(currentStep, logoutSteps[currentStep])}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900">
                    {logoutSteps[currentStep]?.label}
                  </p>
                  <p className="text-xs text-red-600">
                    {logoutSteps[currentStep]?.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}