import React from 'react';
import { AlertCircle, WifiOff, LogIn, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  mode: 'expired' | 'offline';
  onLogin?: () => void;
  onReload?: () => void;
  onRetry?: () => void;
};

export function GlobalAuthBanner({ mode, onLogin, onReload, onRetry }: Props) {
  const isExpired = mode === 'expired';
  return (
    <div className="sticky top-0 z-[1000] w-full border-b shadow-sm">
      <div
        className={`px-2 sm:px-6 py-2 sm:py-3 ${isExpired ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-center sm:items-center gap-2 sm:gap-3">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-100' : 'bg-yellow-100'}`}>
            {isExpired ? (
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            ) : (
              <WifiOff className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
            )}
            </div>
            <div>
              <div className={`text-[13px] sm:text-sm font-semibold ${isExpired ? 'text-red-800' : 'text-yellow-800'}`}>
              {isExpired ? 'Session expired' : 'You are offline'}
              </div>
              <div className="text-[11px] sm:text-xs text-gray-700">
              {isExpired
                ? 'Log in again to continue. Your current page stays visible so you can copy or save your work.'
                : 'Check your connection. We will resume automatically when you are back online.'}
              </div>
            </div>
          </div>

          <div className="flex items-stretch sm:items-center gap-2 sm:gap-2 w-full sm:w-auto">
            {isExpired ? (
              <>
                <Button
                  size="sm"
                  onClick={onLogin}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                >
                  <LogIn className="h-4 w-4 mr-2" /> <span className="hidden xs:inline">Log in</span><span className="xs:hidden">Login</span>
                </Button>
                <Button size="sm" variant="outline" onClick={onReload} className="w-full sm:w-auto">
                  <RefreshCw className="h-4 w-4 mr-2" /> Reload
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={onRetry} className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" /> Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


