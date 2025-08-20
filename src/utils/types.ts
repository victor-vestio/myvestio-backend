import { Request } from 'express';
import { IUser } from '../interfaces/IUser';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export interface JWTTokens {
  accessToken: string;
  refreshToken: string;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}