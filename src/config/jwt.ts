import jwt from 'jsonwebtoken';
import { TokenPayload } from '../interfaces/common';
import { IUser } from '../interfaces/IUser';
import { JWTTokens } from '../utils/types';

export class JWTService {
  private static accessTokenSecret = process.env.JWT_SECRET || 'your_jwt_secret';
  private static refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret';
  private static accessTokenExpiry = process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m';
  private static refreshTokenExpiry = process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d';

  static generateTokens(user: IUser): JWTTokens {
    const payload: any = {
      userId: user._id,
      email: user.email,
      role: user.role
    };

    const accessToken = (jwt.sign as any)(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry
    });

    const refreshToken = (jwt.sign as any)(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry
    });

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  static verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  static generateAccessToken(payload: any): string {
    return (jwt.sign as any)(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry
    });
  }

  static decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  static getTokenExpiry(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  }

  static isTokenExpired(token: string): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    return expiry.getTime() < Date.now();
  }
}

export default JWTService;