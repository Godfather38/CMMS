import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';

/**
 * Landing page for the OAuth redirect: the backend sends the browser here
 * with the JWT in the URL fragment (#token=...), which never reaches any
 * server. We validate it against /auth/me, store it, and move on.
 */
export const AuthCallback = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode double-invoke guard
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');

    if (!token) {
      navigate('/login?error=missing_token', { replace: true });
      return;
    }

    // Strip the token from the address bar/history immediately
    window.history.replaceState(null, '', window.location.pathname);

    api
      .get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setAuth(res.data.data.user, token);
        navigate(onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
      })
      .catch(() => setFailed(true));
  }, [navigate, setAuth, onboardingCompleted]);

  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-700 mb-4">Could not complete sign-in.</p>
          <button onClick={() => navigate('/login')} className="text-indigo-600 hover:underline text-sm">
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-gray-500">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Completing sign-in...
      </div>
    </div>
  );
};
