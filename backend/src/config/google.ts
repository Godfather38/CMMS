import { google } from 'googleapis';
import { env } from '../config/env';
import { GoogleTokens } from '../types';

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

export const getAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/documents',
    'openid',
    'email',
    'profile',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests a refresh token
    prompt: 'consent',      // Forces consent screen to ensure we get refresh token
    scope: scopes,
  });
};

export const getGoogleTokens = async (code: string): Promise<GoogleTokens> => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens as GoogleTokens;
};

export const getGoogleUserInfo = async (accessToken: string) => {
  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2',
  });
  
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const { data } = await oauth2.userinfo.get();
  return data;
};

// Helper to refresh Google Token if expired
export const refreshGoogleToken = async (refreshToken: string) => {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
};