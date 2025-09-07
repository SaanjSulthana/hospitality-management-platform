import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Progress } from './progress';
import { CheckCircle, Circle, Loader2, Zap, Shield, Database, UserCheck } from 'lucide-react';

interface LoginProgressProps {
  isOpen: boolean;
  onComplete?: () => void;
}

interface ProgressStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  duration: number; // in milliseconds
}

const loginSteps: ProgressStep[] = [
  {
    id: 'auth',
    label: 'Starting login process...',
    description: 'Connecting to authentication server',
    icon: <Zap className="h-4 w-4" />,
    duration: 800,
  },
  {
    id: 'verify',
    label: 'Verifying credentials...',
    description: 'Checking email and password',
    icon: <Shield className="h-4 w-4" />,
    duration: 1200,
  },
  {
    id: 'session',
    label: 'Creating secure session...',
    description: 'Generating authentication tokens',
    icon: <UserCheck className="h-4 w-4" />,
    duration: 600,
  },
  {
    id: 'cache',
    label: 'Clearing query cache...',
    description: 'Preparing fresh data for your session',
    icon: <Database className="h-4 w-4" />,
    duration: 400,
  },
  {
    id: 'complete',
    label: 'Login successful!',
    description: 'Redirecting to your dashboard...',
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    duration: 500,
  },
];

export function LoginProgress({ isOpen, onComplete }: LoginProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('LoginProgress component - isOpen:', isOpen, 'currentStep:', currentStep, 'progress:', progress);
  }

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setCompletedSteps(new Set());
      setProgress(0);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;

    const runStep = (stepIndex: number) => {
      if (stepIndex >= loginSteps.length) {
        setTimeout(() => {
          onComplete?.();
        }, 300);
        return;
      }

      setCurrentStep(stepIndex);
      const step = loginSteps[stepIndex];
      const stepProgress = (stepIndex / loginSteps.length) * 100;
      
      // Animate progress bar
      progressInterval = setInterval(() => {
        setProgress(prev => {
          const target = ((stepIndex + 1) / loginSteps.length) * 100;
          const increment = (target - stepProgress) / (step.duration / 50);
          const newProgress = Math.min(prev + increment, target);
          
          if (newProgress >= target) {
            clearInterval(progressInterval);
          }
          
          return newProgress;
        });
      }, 50);

      timeoutId = setTimeout(() => {
        setCompletedSteps(prev => new Set([...prev, stepIndex]));
        clearInterval(progressInterval);
        runStep(stepIndex + 1);
      }, step.duration);
    };

    runStep(0);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isOpen, onComplete]);

  const getStepIcon = (stepIndex: number, step: ProgressStep) => {
    if (completedSteps.has(stepIndex)) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    } else {
      return <Circle className="h-4 w-4 text-gray-300" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Login Progress</DialogTitle>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          {/* Header */}
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
            <h2 className="text-lg font-semibold text-gray-900">Signing you in...</h2>
            <p className="text-sm text-gray-500">Please wait while we securely log you in</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full space-y-2">
            <Progress value={progress} className="w-full h-2" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{Math.round(progress)}%</span>
              <span>{currentStep + 1} of {loginSteps.length}</span>
            </div>
          </div>

          {/* Current Step Only */}
          <div className="w-full">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {getStepIcon(currentStep, loginSteps[currentStep])}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900">
                    {loginSteps[currentStep]?.label}
                  </p>
                  <p className="text-xs text-blue-600">
                    {loginSteps[currentStep]?.description}
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
