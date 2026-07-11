import { Router, Request, Response, NextFunction } from 'express';
import { getAuthUrl } from '../config/google';
import * as authService from '../services/auth';
import { requireAuth } from '../middleware/auth';
import { validate, updateMeSchema } from '../middleware/validation';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env';

const router = Router();

// GET /api/v1/auth/google — kick off the OAuth flow
router.get('/google', (req: Request, res: Response) => {
  res.redirect(getAuthUrl());
});

// GET /api/v1/auth/google/callback — Google redirects here, we redirect to the SPA.
// Token travels in the URL fragment so it never reaches server logs.
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
    }

    const { token } = await authService.authenticateGoogleUser(code);
    res.redirect(`${env.FRONTEND_URL}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: { user: req.user },
  });
});

// PATCH /api/v1/auth/me — update profile / watched folder
router.patch(
  '/me',
  requireAuth,
  validate(updateMeSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await authService.updateMe(req.user!.id, req.body);
      res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // Stateless JWTs: logout is client-side (delete token).
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

// POST /api/v1/auth/dev-login — development only, no Google account needed
if (env.ALLOW_DEV_LOGIN && env.NODE_ENV !== 'production') {
  router.post('/dev-login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, token } = await authService.authenticateDevUser();
      res.status(200).json({ status: 'success', token, data: { user } });
    } catch (error) {
      next(error);
    }
  });
}

export default router;
