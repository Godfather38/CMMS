import { Router, Request, Response, NextFunction } from 'express';
import * as googleService from '../services/google';
import * as authService from '../services/auth';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// GET /api/v1/auth/google
router.get('/google', (req: Request, res: Response) => {
  const url = googleService.getAuthUrl();
  res.redirect(url);
});

// GET /api/v1/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'Authorization code missing' });
    }

    const { user, token } = await authService.authenticateGoogleUser(code);

    // In a real SPA, you might redirect back to frontend with token in URL 
    // or set a cookie. For API testing, we just return JSON.
    res.status(200).json({
      status: 'success',
      token,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: { user: req.user },
  });
});

// POST /api/v1/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // Since we use stateless JWTs, "logout" is mostly client-side (delete token).
  // Optionally, we could blacklist the token in Redis here.
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

export default router;