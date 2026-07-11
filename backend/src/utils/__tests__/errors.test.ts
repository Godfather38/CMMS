import { describe, it, expect } from 'vitest';
import { AppError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from '../errors';

describe('error classes', () => {
  it('AppError carries message, status code, and operational flag', () => {
    const err = new AppError('boom', 418);
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(418);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  it('AppError defaults to 500', () => {
    expect(new AppError('oops').statusCode).toBe(500);
  });

  it.each([
    [BadRequestError, 400, 'Bad Request'],
    [UnauthorizedError, 401, 'Unauthorized'],
    [ForbiddenError, 403, 'Forbidden'],
    [NotFoundError, 404, 'Not Found'],
  ])('%p maps to the right status and default message', (Ctor, status, defaultMessage) => {
    const err = new Ctor();
    expect(err.statusCode).toBe(status);
    expect(err.message).toBe(defaultMessage);
    expect(err).toBeInstanceOf(AppError);
    // instanceof survives class extension of Error (prototype fix)
    expect(err).toBeInstanceOf(Ctor);
  });

  it('subclasses accept custom messages', () => {
    expect(new NotFoundError('Segment not found').message).toBe('Segment not found');
  });
});
