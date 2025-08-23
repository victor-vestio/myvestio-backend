import express from 'express';
import { InvoiceController } from '../controllers/invoiceController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleAuth';
import { uploadInvoiceDocuments } from '../middleware/upload';
import { validateCreateInvoice, validateUpdateInvoice, validateSubmitInvoice, validateAnchorApproval, validateAdminVerification } from '../middleware/validation';
import { UserRole } from '../interfaces/common';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

// Rate limiting for invoice operations
const invoiceUploadRateLimit = rateLimit({
  windowMs: (parseInt(process.env.INVOICE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000),
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.INVOICE_UPLOAD_RATE_LIMIT_MAX_REQUESTS || '20'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many invoice uploads, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const invoiceActionRateLimit = rateLimit({
  windowMs: (parseInt(process.env.INVOICE_ACTION_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000),
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.INVOICE_ACTION_RATE_LIMIT_MAX_REQUESTS || '30'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many invoice requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// SELLER INVOICE MANAGEMENT
// ============================================

/**
 * @route POST /api/invoices/create
 * @desc Create new invoice
 * @access Seller only
 */
router.post(
  '/create',
  requireRole(UserRole.SELLER),
  invoiceActionRateLimit,
  validateCreateInvoice,
  InvoiceController.createInvoice
);

/**
 * @route PUT /api/invoices/:id
 * @desc Update invoice (draft only)
 * @access Seller only (own invoices)
 */
router.put(
  '/:id',
  requireRole(UserRole.SELLER),
  invoiceActionRateLimit,
  validateUpdateInvoice,
  InvoiceController.updateInvoice
);

/**
 * @route POST /api/invoices/:id/upload-document
 * @desc Upload main invoice document
 * @access Seller only (own invoices)
 */
router.post(
  '/:id/upload-document',
  requireRole(UserRole.SELLER),
  invoiceUploadRateLimit,
  uploadInvoiceDocuments.single('invoiceDocument'),
  InvoiceController.uploadInvoiceDocument
);

/**
 * @route POST /api/invoices/:id/submit
 * @desc Submit invoice for anchor approval
 * @access Seller only (own invoices)
 */
router.post(
  '/:id/submit',
  requireRole(UserRole.SELLER),
  invoiceActionRateLimit,
  validateSubmitInvoice,
  InvoiceController.submitInvoice
);

/**
 * @route DELETE /api/invoices/:id
 * @desc Delete invoice (draft only)
 * @access Seller only (own invoices)
 */
router.delete(
  '/:id',
  requireRole(UserRole.SELLER),
  invoiceActionRateLimit,
  InvoiceController.deleteInvoice
);

// ============================================
// ANCHOR APPROVAL WORKFLOW
// ============================================

/**
 * @route GET /api/invoices/anchor/pending
 * @desc Get pending invoices for anchor approval
 * @access Anchor only
 */
router.get(
  '/anchor/pending',
  requireRole(UserRole.ANCHOR),
  InvoiceController.getPendingApprovals
);

/**
 * @route GET /api/invoices/:id/anchor-document
 * @desc Get invoice document for anchor review (main document only)
 * @access Anchor only (assigned invoices)
 */
router.get(
  '/:id/anchor-document',
  requireRole(UserRole.ANCHOR),
  InvoiceController.getAnchorInvoiceDocument
);

/**
 * @route POST /api/invoices/:id/anchor-approval
 * @desc Approve or reject invoice
 * @access Anchor only (assigned invoices)
 */
router.post(
  '/:id/anchor-approval',
  requireRole(UserRole.ANCHOR),
  invoiceActionRateLimit,
  validateAnchorApproval,
  InvoiceController.anchorApproval
);

/**
 * @route GET /api/invoices/anchor/history
 * @desc Get anchor's invoice history
 * @access Anchor only
 */
router.get(
  '/anchor/history',
  requireRole(UserRole.ANCHOR),
  InvoiceController.getUserInvoices
);

// ============================================
// ADMIN VERIFICATION WORKFLOW
// ============================================

/**
 * @route GET /api/invoices/admin/pending
 * @desc Get invoices pending admin verification
 * @access Admin only
 */
router.get(
  '/admin/pending',
  requireRole(UserRole.ADMIN),
  InvoiceController.getAdminPendingVerifications
);

/**
 * @route POST /api/invoices/:id/admin-verification
 * @desc Verify or reject invoice
 * @access Admin only
 */
router.post(
  '/:id/admin-verification',
  requireRole(UserRole.ADMIN),
  invoiceActionRateLimit,
  validateAdminVerification,
  InvoiceController.adminVerification
);

/**
 * @route GET /api/invoices/admin/all
 * @desc Get all invoices for admin
 * @access Admin only
 */
router.get(
  '/admin/all',
  requireRole(UserRole.ADMIN),
  InvoiceController.getAllInvoicesAdmin
);

// ============================================
// MARKETPLACE ENDPOINTS
// ============================================



// ============================================
// ANALYTICS AND REPORTING (BEFORE WILDCARD ROUTES)
// ============================================

/**
 * @route GET /api/invoices/analytics/overview
 * @desc Get invoice analytics overview
 * @access Private (role-based data)
 */
router.get(
  '/analytics/overview',
  InvoiceController.getInvoiceAnalytics
);


// ============================================
// MARKETPLACE ROUTE REJECTION
// ============================================

/**
 * @route GET /api/invoices/marketplace
 * @desc Explicitly reject marketplace requests - use /api/marketplace instead
 * @access Public
 */
router.get(
  '/marketplace',
  (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Marketplace endpoints have been moved to /api/marketplace'
    });
  }
);

/**
 * @route GET /api/invoices/marketplace/trending
 * @desc Explicitly reject marketplace trending requests - use /api/marketplace instead
 * @access Public
 */
router.get(
  '/marketplace/trending',
  (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Marketplace endpoints have been moved to /api/marketplace'
    });
  }
);

// ============================================
// GENERAL INVOICE OPERATIONS
// ============================================

/**
 * @route GET /api/invoices
 * @desc Get user's invoices with filtering
 * @access Private (role-based filtering)
 */
router.get(
  '/',
  InvoiceController.getUserInvoices
);

/**
 * @route GET /api/invoices/:id
 * @desc Get specific invoice details
 * @access Private (role-based access)
 */
router.get(
  '/:id',
  InvoiceController.getInvoiceDetails
);

/**
 * @route GET /api/invoices/:id/status-history
 * @desc Get invoice status history
 * @access Private (role-based access)
 */
router.get(
  '/:id/status-history',
  InvoiceController.getInvoiceStatusHistory
);

/**
 * @route GET /api/invoices/:id/document/:type
 * @desc Get secure document URL
 * @access Private (role-based access)
 */
router.get(
  '/:id/document/:type',
  InvoiceController.getSecureDocumentUrl
);

// ============================================
// SUPPORTING DOCUMENTS
// ============================================

/**
 * @route POST /api/invoices/:id/supporting-documents
 * @desc Upload supporting documents
 * @access Seller only (own invoices)
 */
router.post(
  '/:id/supporting-documents',
  requireRole(UserRole.SELLER),
  invoiceUploadRateLimit,
  uploadInvoiceDocuments.array('supportingDocuments', 5),
  InvoiceController.uploadSupportingDocuments
);

/**
 * @route DELETE /api/invoices/:id/supporting-documents/:docId
 * @desc Delete supporting document
 * @access Seller only (own invoices)
 */
router.delete(
  '/:id/supporting-documents/:docId',
  requireRole(UserRole.SELLER),
  invoiceActionRateLimit,
  InvoiceController.deleteSupportingDocument
);


export default router;