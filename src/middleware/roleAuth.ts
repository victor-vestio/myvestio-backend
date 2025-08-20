import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../utils/types';
import { ApiResponse, UserRole } from '../interfaces/common';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Access denied',
        error: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access forbidden',
        error: `Access restricted to: ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
};

export const requireKYC = (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Access denied',
      error: 'Authentication required'
    });
    return;
  }

  if (!req.user.isKYCApproved) {
    res.status(403).json({
      success: false,
      message: 'KYC verification required',
      error: 'Please complete KYC verification to access this feature'
    });
    return;
  }

  next();
};

export const requireEmailVerification = (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Access denied',
      error: 'Authentication required'
    });
    return;
  }

  if (!req.user.isEmailVerified) {
    res.status(403).json({
      success: false,
      message: 'Email verification required',
      error: 'Please verify your email address to access this feature'
    });
    return;
  }

  next();
};

export const requireSeller = requireRole(UserRole.SELLER);
export const requireLender = requireRole(UserRole.LENDER);
export const requireAnchor = requireRole(UserRole.ANCHOR);
export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireSellerOrAnchor = requireRole(UserRole.SELLER, UserRole.ANCHOR);
export const requireLenderOrAdmin = requireRole(UserRole.LENDER, UserRole.ADMIN);