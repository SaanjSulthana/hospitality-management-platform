import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { LoginProgress } from '@/components/ui/login-progress';
import { Building2, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const formRef = React.useRef<HTMLFormElement>(null);

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  // Debug email state changes
  useEffect(() => {
    console.log('Email state changed to:', email);
    console.log('Email state length:', email.length);
    console.log('Email state type:', typeof email);
  }, [email]);

  // Verify form configuration
  useEffect(() => {
    if (formRef.current) {
      console.log('Form configuration verified:', {
        method: formRef.current.method,
        action: formRef.current.action,
        onsubmit: formRef.current.onsubmit,
        hasOnSubmit: !!formRef.current.onsubmit
      });
      
      // Ensure form has proper configuration
      formRef.current.method = 'POST';
      formRef.current.action = '#';
      
      // Test form submission binding
      console.log('Testing form submission binding...');
      const testEvent = new Event('submit', { bubbles: true, cancelable: true });
      formRef.current.dispatchEvent(testEvent);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use the current state values directly (controlled inputs)
    const currentEmail = email;
    const currentPassword = password;
    
    console.log('=== LOGIN FORM DEBUG ===');
    console.log('Form event:', e);
    console.log('Email state value:', email);
    console.log('Password state value:', password);
    console.log('Current email from state:', currentEmail);
    console.log('Current password from state:', currentPassword);
    console.log('Email length:', currentEmail.length);
    console.log('Password length:', currentPassword.length);
    console.log('Email type:', typeof currentEmail);
    console.log('Password type:', typeof currentPassword);
    console.log('Email === ""', currentEmail === "");
    console.log('Password === ""', currentPassword === "");
    console.log('Login form submitted!', { email: currentEmail, password: currentPassword });
    
    // Validate inputs
    if (!currentEmail || !currentPassword) {
      setError('Please enter both email and password');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      // Start progress dialog immediately
      setShowProgress(true);
      
      // Add a small delay to let the progress dialog appear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Calling login function with:', { email: currentEmail, password: currentPassword });
      await login(currentEmail, currentPassword);
      console.log('Login successful!');

      // Remember email if selected
      if (rememberMe) {
        localStorage.setItem('rememberEmail', currentEmail);
      } else {
        localStorage.removeItem('rememberEmail');
      }

      // Progress dialog will continue to show success steps and then call onComplete
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
      setShowProgress(false); // Hide progress on error
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginComplete = () => {
    setShowProgress(false);
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Building2 className="h-12 w-12" style={{ color: theme.primaryColor }} />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to {theme.brandName}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Access your hospitality management platform
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form 
              onSubmit={handleSubmit} 
              method="POST"
              action="#"
              className="space-y-4"
              noValidate
              ref={formRef}
            >
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    console.log('=== EMAIL INPUT DEBUG ===');
                    console.log('Event target:', e.target);
                    console.log('Event target value:', e.target.value);
                    console.log('Event target type:', e.target.type);
                    console.log('Current email state:', email);
                    console.log('Setting email to:', e.target.value);
                    setEmail(e.target.value);
                    console.log('Email state after setEmail:', email); // This will still show old value due to React's async nature
                  }}
                  required
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                  />
                  Remember me
                </label>
                <div className="text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || showProgress}
                style={{ backgroundColor: theme.primaryColor }}
              >
                {isLoading || showProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {showProgress ? 'Processing...' : 'Signing in...'}
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign up as Admin
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Login Progress Dialog */}
      <LoginProgress 
        isOpen={showProgress} 
        onComplete={handleLoginComplete}
      />
    </div>
  );
}
