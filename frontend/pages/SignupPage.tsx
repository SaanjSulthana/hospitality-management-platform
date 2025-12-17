import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Loader2, User, Mail, Lock, Globe, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-gray-50/50 py-safe px-4 sm:px-6 lg:px-8">
      {/* Dynamic Background */}
      <div className="absolute inset-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-sky-200/30 blur-[100px] animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      <div className="w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Glass Card */}
          <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/40 ring-1 ring-white/50">

            {/* Header Content */}
            <div className="pt-8 pb-6 px-6 sm:pt-10 sm:px-8 text-center">
              <motion.div
                initial={{ transform: "translateY(10px)", opacity: 0 }}
                animate={{ transform: "translateY(0px)", opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex justify-center mb-6"
              >
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-2 font-display">
                  Create Admin Account
                </h2>
                <p className="text-gray-500 text-sm">
                  Set up your {theme.brandName}
                </p>
              </motion.div>
            </div>

            <div className="px-6 pb-8 sm:px-8 sm:pb-10">
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 text-sm py-2.5 px-3 rounded-xl flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName" className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Full Name</Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Input
                        id="displayName"
                        type="text"
                        value={formData.displayName}
                        onChange={(e) => handleInputChange('displayName', e.target.value)}
                        required
                        placeholder="John Doe"
                        disabled={isLoading}
                        className="pl-11 h-11 bg-gray-50/50 border-gray-200/60 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl transition-all duration-300 text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Email Address</Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        required
                        placeholder="name@company.com"
                        disabled={isLoading}
                        className="pl-11 h-11 bg-gray-50/50 border-gray-200/60 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl transition-all duration-300 text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Organization Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="organizationName" className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Organization Name</Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Building2 className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Input
                        id="organizationName"
                        type="text"
                        value={formData.organizationName}
                        onChange={(e) => handleOrgNameChange(e.target.value)}
                        required
                        placeholder="My Hotel Group"
                        disabled={isLoading}
                        className="pl-11 h-11 bg-gray-50/50 border-gray-200/60 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl transition-all duration-300 text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Subdomain */}
                  <div className="space-y-1.5">
                    <Label htmlFor="subdomainPrefix" className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Subdomain</Label>
                    <div className="flex relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Globe className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Input
                        id="subdomainPrefix"
                        type="text"
                        value={formData.subdomainPrefix}
                        onChange={(e) => handleInputChange('subdomainPrefix', e.target.value)}
                        required
                        placeholder="mycompany"
                        disabled={isLoading}
                        className="pl-11 h-11 bg-gray-50/50 border-gray-200/60 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-l-xl rounded-r-none transition-all duration-300 text-sm shadow-sm"
                      />
                      <div className="flex items-center px-4 bg-gray-100/50 border border-l-0 border-gray-200/60 rounded-r-xl text-gray-500 text-sm font-medium backdrop-blur-sm">
                        .hospitality.com
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 ml-1">
                      Only lowercase letters, numbers, and hyphens
                    </p>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Password</Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        required
                        placeholder="Min 8 characters"
                        minLength={8}
                        disabled={isLoading}
                        className="pl-11 h-11 bg-gray-50/50 border-gray-200/60 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl transition-all duration-300 text-sm shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-base font-medium shadow-lg shadow-gray-900/20 active:scale-[0.98] transition-all duration-200"
                    disabled={isLoading}
                    style={{
                      background: theme.primaryColor ? `linear-gradient(135deg, ${theme.primaryColor}, #2563eb)` : undefined
                    }}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-white/80" />
                        <span>Creating account...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 group">
                        <span>Create Account</span>
                        <ArrowRight className="h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </Button>
                </div>

                <div className="pt-2 text-center">
                  <p className="text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                      Sign in directly
                    </Link>
                  </p>
                </div>
              </form>
            </div>

            {/* Bottom Accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80" />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="text-center mt-8 text-xs text-gray-400 font-medium"
        >
          © 2025 {theme.brandName}. Secure Registration.
        </motion.p>
      </div>
    </div>
  );
}
