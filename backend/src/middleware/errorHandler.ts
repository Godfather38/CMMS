import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  console.error('💥 Unexpected Error:', err);

  // Generic fallback
  return res.status(500).json({
    status: 'error',
    message: env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};