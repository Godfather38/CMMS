import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, RefreshCw, TerminalSquare, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui';
import { api, apiErrorMessage } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';

const DEV_LOGIN_ENABLED = import.meta.env.VITE_ALLOW_DEV_LOGIN === 'true';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_code:
    'Google did not send back an authorization code (the sign-in may have been cancelled). Please try again.',
  exchange_failed:
    'Could not complete the Google sign-in exchange. If this keeps happening, the backend GOOGLE_REDIRECT_URI probably does not match Google Cloud Console.',
  server_error: 'The server hit an unexpected error during sign-in. Try again in a minute.',
  missing_token:
    'Sign-in finished but no session token arrived. Check the FRONTEND_URL configured on the backend.',
  auth_failed: 'Google sign-in failed. Please try again.',
};

export const Login = () => {
  const { setAuth } = useAuthStore();
  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [devLoading, setDevLoading] = useState(false);
  const errorCode = searchParams.get('error');
  const [error, setError] = useState<string | null>(
    errorCode ? AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES.auth_failed : null
  );

  // Full-page redirect: backend 302s to Google's consent screen, then
  // redirects back to /auth/callback#token=<jwt>.
  const handleGoogleLogin = () => {
    window.location.href = '/api/v1/auth/google';
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/dev-login');
      setAuth(res.data.data.user, res.data.token);
      navigate(onboardingCompleted ? '/dashboard' : '/onboarding');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
          <span className="text-3xl">🎙️</span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Sign in to CMMS</h2>
        <p className="mt-2 text-center text-sm text-gray-500">Your comedy material, organized.</p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow-xl ring-1 ring-gray-900/5 sm:rounded-lg sm:px-10 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <Button onClick={handleGoogleLogin} className="w-full flex justify-center gap-3 h-11 text-base">
            <LogIn className="h-5 w-5" />
            Sign in with Google
          </Button>
          {DEV_LOGIN_ENABLED && (
            <Button
              variant="secondary"
              onClick={handleDevLogin}
              disabled={devLoading}
              className="w-full flex justify-center gap-3 h-11 text-base"
            >
              {devLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <TerminalSquare className="h-5 w-5" />}
              {devLoading ? 'Signing in...' : 'Dev Login (no Google)'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
