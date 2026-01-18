import { Request } from 'express';

export interface User {
  id: string;
  google_id: string;
  email: string;
  display_name: string;
  profile_image_url?: string;
  watched_folder_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
  expiry_date?: number;
}