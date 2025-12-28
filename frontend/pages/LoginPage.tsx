import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { LoginProgress } from '@/components/ui/login-progress';
import { Building2, Loader2, Mail, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentEmail = email;
    const currentPassword = password;

    if (!currentEmail || !currentPassword) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      setShowProgress(true);
      // Removed 600ms artificial delay - LoginProgress provides visual feedback

      await login(currentEmail, currentPassword);

      if (rememberMe) {
        localStorage.setItem('rememberEmail', currentEmail);
      } else {
        localStorage.removeItem('rememberEmail');
      }

      // Progress dialog handles navigation on complete
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
      setShowProgress(false);
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
    // Smooth transition out
    setTimeout(() => {
      setShowProgress(false);
      navigate(from, { replace: true });
    }, 500);
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-gray-50/50 pt-safe pb-safe">
      {/* Dynamic Background */}
      <div className="absolute inset-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-sky-200/30 blur-[100px] animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      <div className="w-full max-w-md px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Glass Card */}
          <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/40 ring-1 ring-white/50">

            {/* Header Content */}
            <div className="pt-8 pb-6 px-6 sm:pt-10 sm:pb-8 sm:px-8 text-center">
              <motion.div
                initial={{ transform: "translateY(10px)", opacity: 0 }}
                animate={{ transform: "translateY(0px)", opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex justify-center mb-6"
              >
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2 font-display">
                  Welcome to {theme.brandName}
                </h2>
                <p className="text-gray-500 text-base">
                  Sign in to manage your property
                </p>
              </motion.div>
            </div>

            {/* Form Section */}
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
                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">
                      Email Address
                    </Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-11 h-12 bg-gray-50/50 border-gray-200/60 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl transition-all duration-300 text-base shadow-sm"
                        placeholder="name@company.com"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Password
                      </Label>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-blue-600 hover:text-blue-500 transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-11 h-12 bg-gray-50/50 border-gray-200/60 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl transition-all duration-300 text-base shadow-sm"
                        placeholder="••••••••"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>

                {/* Remember Me & Submit */}
                <div className="pt-2 space-y-5">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 transition-all cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 cursor-pointer select-none">
                      Keep me signed in
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-base font-medium shadow-lg shadow-gray-900/20 active:scale-[0.98] transition-all duration-200"
                    disabled={isLoading || showProgress}
                    style={{
                      background: theme.primaryColor ? `linear-gradient(135deg, ${theme.primaryColor}, ${adjustColor(theme.primaryColor, -20)})` : undefined
                    }}
                  >
                    {isLoading || showProgress ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-white/80" />
                        <span>Signing In...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 group">
                        <span>Sign In</span>
                        <ArrowRight className="h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </Button>
                </div>

                {/* Footer Link */}
                <div className="pt-2 text-center">
                  <p className="text-sm text-gray-500">
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                      Create Admin Account
                    </Link>
                  </p>
                </div>
              </form>
            </div>

            {/* Bottom Accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80" />
          </div>
        </motion.div>

        {/* Footer info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="text-center mt-8 text-xs text-gray-400 font-medium"
        >
          © 2025 {theme.brandName}. Secure Login.
        </motion.p>
      </div>

      <LoginProgress
        isOpen={showProgress}
        onComplete={handleLoginComplete}
      />
    </div>
  );
}

// Helper for color manipulation if needed, or simple hex adjustment
function adjustColor(color: string, amount: number) {
  return color; // Placeholder, in real app usage we might use a color lib or just rely on CSS variables
}
