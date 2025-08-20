import { Response, NextFunction } from 'express';
import { User } from '../models/User';
import JWTService from '../config/jwt';
import { AuthenticatedRequest } from '../utils/types';
import { ApiResponse, UserRole } from '../interfaces/common';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access denied',
        error: 'No token provided or invalid token format'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = JWTService.verifyAccessToken(token);
      const user = await User.findById(payload.userId);

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Access denied',
          error: 'User not found'
        });
        return;
      }

      if (user.status !== 'active') {
        res.status(403).json({
          success: false,
          message: 'Access forbidden',
          error: 'User account is not active'
        });
        return;
      }

      req.user = user;
      next();
    } catch (jwtError) {
      res.status(401).json({
        success: false,
        message: 'Access denied',
        error: 'Invalid or expired token'
      });
      return;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'Authentication failed'
    });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = JWTService.verifyAccessToken(token);
    const user = await User.findById(payload.userId);

    if (user && user.status === 'active') {
      req.user = user;
    }
  } catch (error) {
    // Silent fail for optional auth
  }
  
  next();
};