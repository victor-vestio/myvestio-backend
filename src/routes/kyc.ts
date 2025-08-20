import express from 'express';
import { KYCController } from '../controllers/kycController';
import { KYCAnalyticsController } from '../controllers/kycAnalyticsController';
import { AuthenticatedRequest } from '../utils/types';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/roleAuth';
import { validateRequest } from '../middleware/validation';
import { upload } from '../config/multer';
import { processKYCUploads } from '../middleware/upload';
import { 
  submitKYCSchema, 
  updateKYCSchema, 
  approveKYCSchema, 
  rejectKYCSchema 
} from '../utils/validators';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

// Rate limiting for KYC operations - configured via environment variables
const kycUploadLimit = rateLimit({
  windowMs: (parseInt(process.env.KYC_UPLOAD_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000),
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.KYC_UPLOAD_RATE_LIMIT_MAX_REQUESTS || '10'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many KYC uploads, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const kycActionLimit = rateLimit({
  windowMs: (parseInt(process.env.KYC_ACTION_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000),
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.KYC_ACTION_RATE_LIMIT_MAX_REQUESTS || '20'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many KYC requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// User KYC routes
router.get('/status', 
  kycActionLimit,
  authenticate, 
  KYCController.getKYCStatus
);

router.get('/requirements', 
  kycActionLimit,
  authenticate, 
  KYCController.getKYCRequirements
);

router.post('/submit', 
  kycUploadLimit,
  authenticate,
  upload.array('documents', parseInt(process.env.KYC_MAX_FILES_PER_REQUEST || '10')),
  processKYCUploads,
  validateRequest(submitKYCSchema),
  KYCController.submitKYC
);

router.put('/update', 
  kycActionLimit,
  authenticate,
  upload.array('documents', parseInt(process.env.KYC_MAX_FILES_PER_REQUEST || '10')), // Optional file uploads for updates
  (req, res, next) => {
    // Parse JSON strings in form data for updates without files
    if (req.body.bankDetails && typeof req.body.bankDetails === 'string') {
      try {
        req.body.bankDetails = JSON.parse(req.body.bankDetails);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bank details format',
          error: 'Bank details must be valid JSON'
        });
      }
    }
    
    // Only process uploads if files are present
    if (req.files && (req.files as Express.Multer.File[]).length > 0) {
      processKYCUploads(req, res, next);
    } else {
      // No files to process, continue to validation
      next();
    }
  },
  validateRequest(updateKYCSchema),
  KYCController.updateKYC
);

router.get('/documents', 
  kycActionLimit,
  authenticate, 
  KYCController.getDocuments
);

router.delete('/documents/:documentType', 
  kycActionLimit,
  authenticate, 
  KYCController.deleteDocument
);

// Admin KYC routes
router.get('/admin/pending', 
  kycActionLimit,
  authenticate,
  requireAdmin,
  KYCController.getPendingKYCApplications
);

router.post('/admin/approve/:userId', 
  kycActionLimit,
  authenticate,
  requireAdmin,
  validateRequest(approveKYCSchema),
  KYCController.approveKYC
);

router.post('/admin/reject/:userId', 
  kycActionLimit,
  authenticate,
  requireAdmin,
  validateRequest(rejectKYCSchema),
  KYCController.rejectKYC
);

// Admin Analytics routes
router.get('/admin/analytics', 
  kycActionLimit,
  authenticate,
  requireAdmin,
  KYCAnalyticsController.getAnalytics
);

router.get('/admin/submission-counts', 
  kycActionLimit,
  authenticate,
  requireAdmin,
  KYCAnalyticsController.getSubmissionCounts
);


router.post('/admin/cleanup-cache', 
  kycActionLimit,
  authenticate,
  requireAdmin,
  KYCAnalyticsController.cleanupCache
);

export { router as kycRouter };