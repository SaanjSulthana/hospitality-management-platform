import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SignupFormData {
  displayName: string;
  email: string;
  password: string;
  organizationName: string;
  subdomainPrefix: string;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<SignupFormData>({
    displayName: '',
    email: '',
    password: '',
    organizationName: '',
    subdomainPrefix: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is already authenticated
    // Note: This should check for user authentication status, not the signup function
    // For now, we'll let the user access the signup page
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate subdomain format
      const subdomainRegex = /^[a-z0-9-]+$/;
      if (!subdomainRegex.test(formData.subdomainPrefix)) {
        throw new Error('Subdomain can only contain lowercase letters, numbers, and hyphens');
      }

      // Call signup function
      await signup(formData);
      
      // Redirect to login page
      navigate('/login', { replace: true });
      toast({
        title: "Account created",
        description: "Please log in with your new credentials.",
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Signup failed. Please try again.';
      
      if (error.message) {
        if (error.message.includes('subdomain')) {
          errorMessage = 'This subdomain is already taken. Please choose a different one.';
        } else if (error.message.includes('email')) {
          errorMessage = 'This email address is already in use.';
        } else if (error.message.includes('password')) {
          errorMessage = 'Password must be at least 8 characters long.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const generateSubdomain = (orgName: string) => {
    return orgName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };

  const handleOrgNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      organizationName: value,
      // Auto-generate subdomain if it's empty or was auto-generated
      subdomainPrefix: prev.subdomainPrefix === generateSubdomain(prev.organizationName) || !prev.subdomainPrefix
        ? generateSubdomain(value)
        : prev.subdomainPrefix
    }));
    if (error) {
      setError('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Building2 className="h-12 w-12" style={{ color: theme.primaryColor }} />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Create Admin Account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Set up your hospitality management platform
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Admin Registration</CardTitle>
            <CardDescription>
              Create your administrator account and organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="displayName">Full Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  required
                  placeholder="Enter your full name"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
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
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  placeholder="Enter your password (min 8 characters)"
                  disabled={isLoading}
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  required
                  placeholder="Enter your organization name"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomainPrefix">Subdomain</Label>
                <div className="flex">
                  <Input
                    id="subdomainPrefix"
                    type="text"
                    value={formData.subdomainPrefix}
                    onChange={(e) => handleInputChange('subdomainPrefix', e.target.value)}
                    required
                    placeholder="mycompany"
                    disabled={isLoading}
                    className="rounded-r-none"
                    title="Only lowercase letters, numbers, and hyphens allowed"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    .hospitality.com
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Choose a unique subdomain for your organization (lowercase letters, numbers, and hyphens only)
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                style={{ backgroundColor: theme.primaryColor }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Admin Account'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
