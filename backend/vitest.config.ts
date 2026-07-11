import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Unit tests never touch the DB or Google, but the modules under test
    // import config/env.ts, which validates these at import time.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/v1/auth/google/callback',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars-long',
    },
  },
});
