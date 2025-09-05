import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verify2FASchema,
  refreshTokenSchema,
  verifyEmailOTPSchema,
  verifyTwoFASchema
} from '../utils/validators';

const router = Router();

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || '5'),
  skip: (req, res) => {
    // Force skip in development mode
    const isDev = process.env.NODE_ENV === 'development';
    console.log('Rate limiter check - NODE_ENV:', process.env.NODE_ENV, 'Skip:', isDev);
    return isDev;
  },
  message: {
    success: false,
    message: 'Too many authentication attempts',
    error: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.GENERAL_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.GENERAL_RATE_LIMIT_MAX_REQUESTS || '20'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many requests',
    error: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_HOURS || '1') * 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS || '3'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many password reset attempts',
    error: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const emailVerificationLimiter = rateLimit({
  windowMs: parseInt(process.env.EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_HOURS || '1') * 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.EMAIL_VERIFICATION_RATE_LIMIT_MAX_ATTEMPTS || '5'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many verification email requests',
    error: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Public routes
router.post('/register', 
  authLimiter,
  validateRequest(registerSchema),
  AuthController.register
);

router.post('/login',
  authLimiter,
  validateRequest(loginSchema),
  AuthController.login
);

router.post('/refresh-token',
  generalLimiter,
  validateRequest(refreshTokenSchema),
  AuthController.refreshToken
);

router.post('/forgot-password',
  passwordResetLimiter,
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post('/reset-password',
  passwordResetLimiter,
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword
);

router.post('/verify-email',
  emailVerificationLimiter,
  validateRequest(verifyEmailSchema),
  AuthController.verifyEmail
);

router.post('/verify-email-otp',
  authLimiter,
  validateRequest(verifyEmailOTPSchema),
  AuthController.verifyEmailOTP
);

router.post('/verify-2fa-login',
  authLimiter,
  validateRequest(verifyTwoFASchema),
  AuthController.verifyTwoFA
);

// Protected routes (require authentication)
router.use(authenticate);

router.post('/logout',
  generalLimiter,
  AuthController.logout
);

router.get('/profile',
  generalLimiter,
  AuthController.getProfile
);

router.put('/change-password',
  authLimiter,
  validateRequest(changePasswordSchema),
  AuthController.changePassword
);

router.post('/resend-verification',
  emailVerificationLimiter,
  AuthController.resendVerificationEmail
);

// 2FA routes
router.post('/enable-2fa',
  authLimiter,
  AuthController.enable2FA
);

router.post('/verify-2fa',
  authLimiter,
  validateRequest(verify2FASchema),
  AuthController.verify2FA
);

router.post('/disable-2fa',
  authLimiter,
  AuthController.disable2FA
);

export default router;