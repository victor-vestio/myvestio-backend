import { Response } from 'express';
import { AuthenticatedRequest } from '../utils/types';
import { Invoice } from '../models/Invoice';
import { User } from '../models/User';
import { 
  CreateInvoiceRequest, 
  UpdateInvoiceRequest,
  SubmitInvoiceRequest,
  AnchorApprovalRequest,
  AdminVerificationRequest,
  InvoiceSearchFilters,
  InvoiceDetailedResponse,
  InvoiceBasicResponse,
  InvoiceListResponse,
  MarketplaceFilters,
  InvoiceMarketplaceResponse
} from '../interfaces/IInvoice';
import { InvoiceStatus, UserRole } from '../interfaces/common';
import { InvoiceDocumentService } from '../services/invoiceDocumentService';
import { InvoiceRedisService } from '../services/invoiceRedisService';
import { EmailService } from '../services/emailService';

export class InvoiceController {

  // ============================================
  // SELLER INVOICE MANAGEMENT
  // ============================================

  /**
   * Create new invoice (Seller only)
   */
  static async createInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (userRole !== UserRole.SELLER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only sellers can create invoices' 
        });
        return;
      }

      const {
        anchorId,
        amount,
        currency = 'NGN',
        issueDate,
        dueDate,
        description
      }: CreateInvoiceRequest = req.body;

      // Validate anchor exists and is actually an anchor
      const anchor = await User.findById(anchorId);
      if (!anchor || anchor.role !== UserRole.ANCHOR) {
        res.status(400).json({ 
          success: false, 
          message: 'Invalid anchor selected' 
        });
        return;
      }

      // Validate dates
      const issueDateObj = new Date(issueDate);
      const dueDateObj = new Date(dueDate);
      
      if (issueDateObj > new Date()) {
        res.status(400).json({ 
          success: false, 
          message: 'Issue date cannot be in the future' 
        });
        return;
      }

      if (dueDateObj <= issueDateObj) {
        res.status(400).json({ 
          success: false, 
          message: 'Due date must be after issue date' 
        });
        return;
      }

      // Create invoice
      const invoice = new Invoice({
        sellerId: userId,
        anchorId,
        amount,
        currency,
        issueDate: issueDateObj,
        dueDate: dueDateObj,
        description,
        status: InvoiceStatus.DRAFT
      });

      await invoice.save();

      // Store timestamp for processing time tracking
      await InvoiceRedisService.storeInvoiceTimestamp(String(invoice._id), 'created');

      // Track metrics
      await InvoiceRedisService.trackInvoiceSubmission(userId, anchorId, amount);

      const response = await InvoiceController.formatInvoiceBasicResponse(invoice);

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: response
      });

    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create invoice',
        error: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Update invoice (Seller only, draft status only)
   */
  static async updateInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
        return;
      }

      // Check permissions
      if (userRole !== UserRole.SELLER || String(invoice.sellerId) !== userId) {
        res.status(403).json({ 
          success: false, 
          message: 'Not authorized to update this invoice' 
        });
        return;
      }

      // Check if invoice can be edited
      if (!invoice.canBeEdited()) {
        res.status(400).json({ 
          success: false, 
          message: 'Invoice cannot be edited in current status' 
        });
        return;
      }

      const updateData: UpdateInvoiceRequest = req.body;

      // Validate anchor if being changed
      if (updateData.anchorId) {
        const anchor = await User.findById(updateData.anchorId);
        if (!anchor || anchor.role !== UserRole.ANCHOR) {
          res.status(400).json({ 
            success: false, 
            message: 'Invalid anchor selected' 
          });
          return;
        }
        invoice.anchorId = updateData.anchorId as any;
      }

      // Update fields
      if (updateData.amount !== undefined) invoice.amount = updateData.amount;
      if (updateData.currency) invoice.currency = updateData.currency;
      if (updateData.description) invoice.description = updateData.description;

      // Update dates with validation
      if (updateData.issueDate) {
        const issueDateObj = new Date(updateData.issueDate);
        if (issueDateObj > new Date()) {
          res.status(400).json({ 
            success: false, 
            message: 'Issue date cannot be in the future' 
          });
          return;
        }
        invoice.issueDate = issueDateObj;
      }

      if (updateData.dueDate) {
        const dueDateObj = new Date(updateData.dueDate);
        if (dueDateObj <= invoice.issueDate) {
          res.status(400).json({ 
            success: false, 
            message: 'Due date must be after issue date' 
          });
          return;
        }
        invoice.dueDate = dueDateObj;
      }

      await invoice.save();

      // Invalidate caches
      await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), userId);

      const response = await InvoiceController.formatInvoiceBasicResponse(invoice);

      res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: response
      });

    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update invoice',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Upload invoice document
   */
  static async uploadInvoiceDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
        return;
      }

      // Check permissions
      if (userRole !== UserRole.SELLER || String(invoice.sellerId) !== userId) {
        res.status(403).json({ 
          success: false, 
          message: 'Not authorized to upload document for this invoice' 
        });
        return;
      }

      // Check if invoice can be edited
      if (!invoice.canBeEdited()) {
        res.status(400).json({ 
          success: false, 
          message: 'Cannot upload document for invoice in current status' 
        });
        return;
      }

      const file = req.file as Express.Multer.File;
      if (!file) {
        res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
        return;
      }

      // Upload to Cloudinary
      const uploadedDocument = await InvoiceDocumentService.uploadInvoiceDocument(
        userId,
        String(invoice._id),
        file
      );

      // Update invoice document
      invoice.invoiceDocument = {
        filename: uploadedDocument.filename,
        originalName: uploadedDocument.originalName,
        cloudinaryUrl: uploadedDocument.cloudinaryUrl,
        cloudinaryPublicId: uploadedDocument.cloudinaryPublicId,
        fileSize: uploadedDocument.fileSize,
        mimeType: uploadedDocument.mimeType,
        uploadedAt: new Date()
      };

      await invoice.save();

      // Update document permissions
      await InvoiceDocumentService.updateDocumentPermissions(
        uploadedDocument.cloudinaryPublicId,
        'draft'
      );

      // Invalidate caches
      await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), userId);

      // Send real-time update
      await InvoiceRedisService.publishStatusUpdate(String(invoice._id), {
        type: 'document_uploaded',
        invoiceId: String(invoice._id),
        message: 'Invoice document uploaded successfully',
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Invoice document uploaded successfully',
        data: {
          document: {
            filename: uploadedDocument.filename,
            originalName: uploadedDocument.originalName,
            cloudinaryUrl: uploadedDocument.cloudinaryUrl,
            fileSize: uploadedDocument.fileSize,
            mimeType: uploadedDocument.mimeType
          }
        }
      });

    } catch (error) {
      console.error('Upload invoice document error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to upload invoice document',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Submit invoice for anchor approval
   */
  static async submitInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
        return;
      }

      // Check permissions
      if (userRole !== UserRole.SELLER || String(invoice.sellerId) !== userId) {
        res.status(403).json({ 
          success: false, 
          message: 'Not authorized to submit this invoice' 
        });
        return;
      }

      // Check if invoice can be submitted
      if (!invoice.canBeSubmitted()) {
        res.status(400).json({ 
          success: false, 
          message: 'Invoice cannot be submitted. Ensure all required documents are uploaded.' 
        });
        return;
      }

      const { finalNotes }: SubmitInvoiceRequest = req.body;

      // Update status to submitted
      const previousStatus = invoice.status;
      invoice.status = InvoiceStatus.SUBMITTED;
      invoice.submittedAt = new Date();
      
      if (finalNotes) {
        invoice.addStatusHistory(InvoiceStatus.SUBMITTED, userId, finalNotes);
      }

      await invoice.save();

      // Update document permissions
      if (invoice.invoiceDocument?.cloudinaryPublicId) {
        await InvoiceDocumentService.updateDocumentPermissions(
          invoice.invoiceDocument.cloudinaryPublicId,
          'submitted'
        );
      }

      // Track status change
      await InvoiceRedisService.trackStatusChange(previousStatus, InvoiceStatus.SUBMITTED, id);

      // Invalidate caches
      await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), userId, String(invoice.anchorId));

      // Send notifications
      const anchor = await User.findById(invoice.anchorId);
      if (anchor) {
        // Email notification to anchor
        await EmailService.sendInvoiceStatusUpdate(
          anchor,
          invoice,
          InvoiceStatus.SUBMITTED,
          'New invoice submitted for your review'
        );

        // Real-time notification to anchor
        await InvoiceRedisService.publishAnchorNotification(String(anchor._id), {
          type: 'invoice_submitted',
          invoiceId: String(invoice._id),
          message: 'New invoice submitted for approval',
          sellerId: userId,
          timestamp: new Date()
        });
      }

      // Real-time update for seller
      await InvoiceRedisService.publishStatusUpdate(String(invoice._id), {
        type: 'status_change',
        invoiceId: String(invoice._id),
        newStatus: InvoiceStatus.SUBMITTED,
        message: 'Invoice submitted for anchor approval',
        timestamp: new Date()
      });

      const response = await InvoiceController.formatInvoiceDetailedResponse(invoice);

      res.json({
        success: true,
        message: 'Invoice submitted successfully',
        data: response
      });

    } catch (error) {
      console.error('Submit invoice error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to submit invoice',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  // ============================================
  // ANCHOR APPROVAL WORKFLOW
  // ============================================

  /**
   * Get pending invoices for anchor approval
   */
  static async getPendingApprovals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (userRole !== UserRole.ANCHOR) {
        res.status(403).json({ 
          success: false, 
          message: 'Only anchors can view pending approvals' 
        });
        return;
      }

      const { page = 1, limit = 20, sortBy = 'submittedAt', sortOrder = 'asc' } = req.query;

      // Build cache key
      const cacheKey = `anchor:${userId}:pending:${page}:${limit}:${sortBy}:${sortOrder}`;
      const cached = await InvoiceRedisService.getCachedSearchResults({ 
        anchorId: userId, 
        status: InvoiceStatus.SUBMITTED 
      } as InvoiceSearchFilters);

      if (cached) {
        res.json({
          success: true,
          data: {
            invoices: cached,
            pagination: {
              currentPage: Number(page),
              totalPages: Math.ceil(cached.length / Number(limit)),
              totalItems: cached.length,
              itemsPerPage: Number(limit),
              hasNext: Number(page) * Number(limit) < cached.length,
              hasPrev: Number(page) > 1
            }
          }
        });
        return;
      }

      // Get pending invoices from database
      const skip = (Number(page) - 1) * Number(limit);
      const sortOptions: any = {};
      sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const [invoices, total] = await Promise.all([
        Invoice.find({ 
          anchorId: userId, 
          status: InvoiceStatus.SUBMITTED 
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('sellerId', 'firstName lastName businessName email'),
        
        Invoice.countDocuments({ 
          anchorId: userId, 
          status: InvoiceStatus.SUBMITTED 
        })
      ]);

      const formattedInvoices = await Promise.all(
        invoices.map(invoice => InvoiceController.formatInvoiceBasicResponse(invoice))
      );

      // Cache results
      await InvoiceRedisService.cacheSearchResults(
        { anchorId: userId, status: InvoiceStatus.SUBMITTED } as InvoiceSearchFilters,
        formattedInvoices,
        600 // 10 minutes
      );

      const response: InvoiceListResponse = {
        invoices: formattedInvoices,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNext: Number(page) * Number(limit) < total,
          hasPrev: Number(page) > 1
        }
      };

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get pending approvals',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Approve or reject invoice (Anchor only)
   */
  static async anchorApproval(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
        return;
      }

      // Check permissions
      if (userRole !== UserRole.ANCHOR || String(invoice.anchorId) !== userId) {
        res.status(403).json({ 
          success: false, 
          message: 'Not authorized to approve this invoice' 
        });
        return;
      }

      // Check if invoice can be approved
      if (!invoice.canBeApprovedByAnchor()) {
        res.status(400).json({ 
          success: false, 
          message: 'Invoice cannot be approved in current status' 
        });
        return;
      }

      const { action, notes, fundingTerms }: AnchorApprovalRequest = req.body;

      const previousStatus = invoice.status;

      if (action === 'approve') {
        invoice.status = InvoiceStatus.ANCHOR_APPROVED;
        invoice.anchorApprovalDate = new Date();
        invoice.anchorApprovalNotes = notes;
        invoice.anchorRejectionReason = undefined;

        // Store funding terms if provided
        if (fundingTerms) {
          invoice.fundingAmount = fundingTerms.maxFundingAmount;
          invoice.interestRate = fundingTerms.recommendedInterestRate;
        }

        // Update document permissions
        if (invoice.invoiceDocument?.cloudinaryPublicId) {
          await InvoiceDocumentService.updateDocumentPermissions(
            invoice.invoiceDocument.cloudinaryPublicId,
            'approved'
          );
        }

      } else if (action === 'reject') {
        invoice.status = InvoiceStatus.REJECTED;
        invoice.anchorRejectionDate = new Date();
        invoice.anchorRejectionReason = notes || 'Rejected by anchor';
        invoice.anchorApprovalNotes = undefined;
      }

      invoice.addStatusHistory(invoice.status, userId, notes);
      await invoice.save();

      // Track status change
      await InvoiceRedisService.trackStatusChange(previousStatus, invoice.status, id);

      // Invalidate caches
      await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), String(invoice.sellerId), userId);

      // Send notifications
      const seller = await User.findById(invoice.sellerId);
      if (seller) {
        // Email notification to seller
        await EmailService.sendInvoiceStatusUpdate(
          seller,
          invoice,
          invoice.status,
          action === 'approve' ? 'Your invoice has been approved by the anchor' : 'Your invoice has been rejected'
        );

        // Real-time notification to seller
        await InvoiceRedisService.publishSellerNotification(String(seller._id), {
          type: action === 'approve' ? 'invoice_approved' : 'invoice_rejected',
          invoiceId: String(invoice._id),
          message: action === 'approve' ? 'Invoice approved by anchor' : 'Invoice rejected by anchor',
          anchorId: userId,
          timestamp: new Date(),
          notes
        });
      }

      // Real-time update
      await InvoiceRedisService.publishStatusUpdate(String(invoice._id), {
        type: 'status_change',
        invoiceId: String(invoice._id),
        newStatus: invoice.status,
        message: action === 'approve' ? 'Invoice approved by anchor' : 'Invoice rejected by anchor',
        timestamp: new Date(),
        metadata: { anchorId: userId, notes }
      });

      const response = await InvoiceController.formatInvoiceDetailedResponse(invoice);

      res.json({
        success: true,
        message: `Invoice ${action}d successfully`,
        data: response
      });

    } catch (error) {
      console.error('Anchor approval error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process anchor approval',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  // ============================================
  // GENERAL INVOICE OPERATIONS
  // ============================================

  /**
   * Get invoice details
   */
  static async getInvoiceDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Try to get from cache first
      const cached = await InvoiceRedisService.getCachedInvoiceDetails(id);
      if (cached) {
        // Check permissions on cached data
        if (userId && userRole && InvoiceController.hasInvoiceAccess(cached, userId, userRole)) {
          // Track view for trending
          await InvoiceRedisService.trackInvoiceView(id);
          
          res.json({
            success: true,
            data: cached
          });
          return;
        }
      }

      const invoice = await Invoice.findById(id)
        .populate('sellerId', 'firstName lastName businessName email')
        .populate('anchorId', 'firstName lastName businessName email')
        .populate('fundedBy', 'firstName lastName businessName');

      if (!invoice) {
        res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
        return;
      }

      // Check permissions
      if (!userId || !userRole || !InvoiceController.hasInvoiceAccess(invoice, userId, userRole)) {
        res.status(403).json({ 
          success: false, 
          message: 'Not authorized to view this invoice' 
        });
        return;
      }

      // Track view for trending
      await InvoiceRedisService.trackInvoiceView(id);

      const response = await InvoiceController.formatInvoiceDetailedResponse(invoice);

      // Cache the response
      await InvoiceRedisService.cacheInvoiceDetails(id, response);

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Get invoice details error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get invoice details',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Get user's invoices with filtering and pagination
   */
  static async getUserInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const filters: InvoiceSearchFilters = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        ...req.query
      };

      // Set user-specific filters based on role
      if (userRole === UserRole.SELLER) {
        filters.sellerId = userId;
      } else if (userRole === UserRole.ANCHOR) {
        filters.anchorId = userId;
      } else if (userRole === UserRole.LENDER) {
        filters.fundedBy = userId;
      }

      // Try cache first
      const cached = await InvoiceRedisService.getCachedSearchResults(filters);
      if (cached) {
        res.json({
          success: true,
          data: {
            invoices: cached,
            pagination: InvoiceController.generatePaginationInfo(cached, filters)
          }
        });
        return;
      }

      // Build database query
      const query = InvoiceController.buildInvoiceQuery(filters);
      const sortOptions = InvoiceController.buildSortOptions(filters);

      const skip = (filters.page! - 1) * filters.limit!;

      const [invoices, total] = await Promise.all([
        Invoice.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(filters.limit!)
          .populate('sellerId', 'firstName lastName businessName')
          .populate('anchorId', 'firstName lastName businessName')
          .populate('fundedBy', 'firstName lastName businessName'),
        
        Invoice.countDocuments(query)
      ]);

      const formattedInvoices = await Promise.all(
        invoices.map(invoice => InvoiceController.formatInvoiceBasicResponse(invoice))
      );

      // Cache results
      await InvoiceRedisService.cacheSearchResults(filters, formattedInvoices);

      const response: InvoiceListResponse = {
        invoices: formattedInvoices,
        pagination: {
          currentPage: filters.page!,
          totalPages: Math.ceil(total / filters.limit!),
          totalItems: total,
          itemsPerPage: filters.limit!,
          hasNext: filters.page! * filters.limit! < total,
          hasPrev: filters.page! > 1
        },
        filters: {
          status: Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : undefined,
          dateRange: filters.dateFrom || filters.dateTo ? {
            start: filters.dateFrom || new Date('1970-01-01'),
            end: filters.dateTo || new Date()
          } : undefined,
          amountRange: filters.minAmount || filters.maxAmount ? {
            min: filters.minAmount || 0,
            max: filters.maxAmount || Number.MAX_VALUE
          } : undefined,
          currency: filters.currency,
          search: filters.search
        }
      };

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Get user invoices error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get invoices',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Delete invoice (Seller only, draft status only)
   */
  static async deleteInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
        return;
      }

      // Check permissions
      if (userRole !== UserRole.SELLER || String(invoice.sellerId) !== userId) {
        res.status(403).json({ 
          success: false, 
          message: 'Not authorized to delete this invoice' 
        });
        return;
      }

      // Check if invoice can be deleted
      if (invoice.status !== InvoiceStatus.DRAFT) {
        res.status(400).json({ 
          success: false, 
          message: 'Only draft invoices can be deleted' 
        });
        return;
      }

      // Delete documents from Cloudinary
      if (invoice.invoiceDocument?.cloudinaryPublicId) {
        await InvoiceDocumentService.deleteInvoiceDocument(invoice.invoiceDocument.cloudinaryPublicId);
      }

      for (const doc of invoice.supportingDocuments) {
        if (doc.cloudinaryPublicId) {
          await InvoiceDocumentService.deleteInvoiceDocument(doc.cloudinaryPublicId);
        }
      }

      // Delete invoice from database
      await Invoice.findByIdAndDelete(id);

      // Invalidate caches
      await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), userId, String(invoice.anchorId));

      res.json({
        success: true,
        message: 'Invoice deleted successfully'
      });

    } catch (error) {
      console.error('Delete invoice error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete invoice',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  // ============================================
  // ADMIN VERIFICATION WORKFLOW
  // ============================================

  /**
   * Get invoices pending admin verification
   */
  static async getAdminPendingVerifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== UserRole.ADMIN) {
        res.status(403).json({ 
          success: false, 
          message: 'Only admins can view pending verifications' 
        });
        return;
      }

      const { page = 1, limit = 20, sortBy = 'anchorApprovalDate', sortOrder = 'asc' } = req.query;

      // Try cache first
      const cacheKey = `admin:pending_verifications:${page}:${limit}:${sortBy}:${sortOrder}`;
      const cached = await InvoiceRedisService.getCachedSearchResults({ 
        status: InvoiceStatus.ANCHOR_APPROVED 
      } as InvoiceSearchFilters);

      if (cached) {
        res.json({
          success: true,
          data: {
            invoices: cached,
            pagination: InvoiceController.generatePaginationInfo(cached, { page: Number(page), limit: Number(limit) } as InvoiceSearchFilters)
          }
        });
        return;
      }

      // Get from database
      const skip = (Number(page) - 1) * Number(limit);
      const sortOptions: any = {};
      sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const [invoices, total] = await Promise.all([
        Invoice.find({ status: InvoiceStatus.ANCHOR_APPROVED })
          .sort(sortOptions)
          .skip(skip)
          .limit(Number(limit))
          .populate('sellerId', 'firstName lastName businessName email')
          .populate('anchorId', 'firstName lastName businessName email'),
        
        Invoice.countDocuments({ status: InvoiceStatus.ANCHOR_APPROVED })
      ]);

      const formattedInvoices = await Promise.all(
        invoices.map(invoice => InvoiceController.formatInvoiceBasicResponse(invoice))
      );

      // Cache results
      await InvoiceRedisService.cacheSearchResults(
        { status: InvoiceStatus.ANCHOR_APPROVED } as InvoiceSearchFilters,
        formattedInvoices,
        600 // 10 minutes
      );

      res.json({
        success: true,
        data: {
          invoices: formattedInvoices,
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            totalItems: total,
            itemsPerPage: Number(limit),
            hasNext: Number(page) * Number(limit) < total,
            hasPrev: Number(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Get admin pending verifications error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get pending verifications',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Admin verify or reject invoice
   */
  static async adminVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (userRole !== UserRole.ADMIN) {
        res.status(403).json({ 
          success: false, 
          message: 'Only admins can verify invoices' 
        });
        return;
      }

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
        return;
      }

      if (!invoice.canBeVerifiedByAdmin()) {
        res.status(400).json({ 
          success: false, 
          message: 'Invoice cannot be verified in current status' 
        });
        return;
      }

      const { action, notes, verificationDetails }: AdminVerificationRequest = req.body;

      const previousStatus = invoice.status;

      if (action === 'verify') {
        invoice.status = InvoiceStatus.ADMIN_VERIFIED;
        invoice.adminVerificationDate = new Date();
        invoice.adminVerificationNotes = notes;
        invoice.verifiedBy = userId as any;
        invoice.adminRejectionReason = undefined;

        // Update document permissions
        if (invoice.invoiceDocument?.cloudinaryPublicId) {
          await InvoiceDocumentService.updateDocumentPermissions(
            invoice.invoiceDocument.cloudinaryPublicId,
            'verified'
          );
        }

      } else if (action === 'reject') {
        invoice.status = InvoiceStatus.REJECTED;
        invoice.adminRejectionReason = notes || 'Rejected by admin';
        invoice.adminVerificationNotes = undefined;
      }

      invoice.addStatusHistory(invoice.status, userId, notes);
      await invoice.save();

      // Track status change
      await InvoiceRedisService.trackStatusChange(previousStatus, invoice.status, id);

      // Invalidate caches
      await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), String(invoice.sellerId), String(invoice.anchorId));

      // Send notifications
      const [seller, anchor] = await Promise.all([
        User.findById(invoice.sellerId),
        User.findById(invoice.anchorId)
      ]);

      if (seller) {
        await EmailService.sendInvoiceStatusUpdate(
          seller,
          invoice,
          invoice.status,
          action === 'verify' ? 'Your invoice has been verified and is ready for listing' : 'Your invoice has been rejected by admin'
        );

        await InvoiceRedisService.publishSellerNotification(String(seller._id), {
          type: action === 'verify' ? 'invoice_verified' : 'invoice_rejected',
          invoiceId: String(invoice._id),
          message: action === 'verify' ? 'Invoice verified by admin' : 'Invoice rejected by admin',
          adminId: userId,
          timestamp: new Date(),
          notes
        });
      }

      // Real-time update
      await InvoiceRedisService.publishStatusUpdate(String(invoice._id), {
        type: 'status_change',
        invoiceId: String(invoice._id),
        newStatus: invoice.status,
        message: action === 'verify' ? 'Invoice verified by admin' : 'Invoice rejected by admin',
        timestamp: new Date(),
        metadata: { adminId: userId, notes }
      });

      const response = await InvoiceController.formatInvoiceDetailedResponse(invoice);

      res.json({
        success: true,
        message: `Invoice ${action}d successfully`,
        data: response
      });

    } catch (error) {
      console.error('Admin verification error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process admin verification',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Get all invoices for admin with advanced filtering
   */
  static async getAllInvoicesAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== UserRole.ADMIN) {
        res.status(403).json({ 
          success: false, 
          message: 'Only admins can view all invoices' 
        });
        return;
      }

      const filters: InvoiceSearchFilters = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        ...req.query
      };

      // Try cache first
      const cached = await InvoiceRedisService.getCachedSearchResults(filters);
      if (cached) {
        res.json({
          success: true,
          data: {
            invoices: cached,
            pagination: InvoiceController.generatePaginationInfo(cached, filters)
          }
        });
        return;
      }

      // Build database query
      const query = InvoiceController.buildInvoiceQuery(filters);
      const sortOptions = InvoiceController.buildSortOptions(filters);

      const skip = (filters.page! - 1) * filters.limit!;

      const [invoices, total] = await Promise.all([
        Invoice.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(filters.limit!)
          .populate('sellerId', 'firstName lastName businessName email')
          .populate('anchorId', 'firstName lastName businessName email')
          .populate('fundedBy', 'firstName lastName businessName'),
        
        Invoice.countDocuments(query)
      ]);

      const formattedInvoices = await Promise.all(
        invoices.map(invoice => InvoiceController.formatInvoiceBasicResponse(invoice))
      );

      // Cache results
      await InvoiceRedisService.cacheSearchResults(filters, formattedInvoices);

      res.json({
        success: true,
        data: {
          invoices: formattedInvoices,
          pagination: {
            currentPage: filters.page!,
            totalPages: Math.ceil(total / filters.limit!),
            totalItems: total,
            itemsPerPage: filters.limit!,
            hasNext: filters.page! * filters.limit! < total,
            hasPrev: filters.page! > 1
          },
          filters
        }
      });

    } catch (error) {
      console.error('Get all invoices admin error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get invoices',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * List verified invoice to marketplace
   */
  static async listInvoiceToMarketplace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (userRole !== UserRole.ADMIN) {
        res.status(403).json({ 
          success: false, 
          message: 'Only admins can list invoices to marketplace' 
        });
        return;
      }

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
        return;
      }

      if (!invoice.canBeListed()) {
        res.status(400).json({ 
          success: false, 
          message: 'Invoice cannot be listed in current status' 
        });
        return;
      }

      const previousStatus = invoice.status;
      invoice.status = InvoiceStatus.LISTED;
      invoice.listedAt = new Date();

      // Update document permissions for marketplace access
      if (invoice.invoiceDocument?.cloudinaryPublicId) {
        await InvoiceDocumentService.updateDocumentPermissions(
          invoice.invoiceDocument.cloudinaryPublicId,
          'listed'
        );
      }

      invoice.addStatusHistory(invoice.status, userId, 'Listed to marketplace');
      await invoice.save();

      // Track status change
      await InvoiceRedisService.trackStatusChange(previousStatus, invoice.status, id);

      // Invalidate caches
      await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), String(invoice.sellerId), String(invoice.anchorId));
      await InvoiceRedisService.invalidateMarketplaceCaches();

      // Publish marketplace update
      await InvoiceRedisService.publishMarketplaceUpdate({
        type: 'new_listing',
        invoiceId: String(invoice._id),
        invoice: await InvoiceController.formatInvoiceBasicResponse(invoice),
        timestamp: new Date()
      });

      // Notify seller
      const seller = await User.findById(invoice.sellerId);
      if (seller) {
        await EmailService.sendInvoiceStatusUpdate(
          seller,
          invoice,
          invoice.status,
          'Your invoice is now listed in the marketplace'
        );

        await InvoiceRedisService.publishSellerNotification(String(seller._id), {
          type: 'invoice_listed',
          invoiceId: String(invoice._id),
          message: 'Invoice listed in marketplace',
          adminId: userId,
          timestamp: new Date()
        });
      }

      const response = await InvoiceController.formatInvoiceDetailedResponse(invoice);

      res.json({
        success: true,
        message: 'Invoice listed to marketplace successfully',
        data: response
      });

    } catch (error) {
      console.error('List invoice to marketplace error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to list invoice to marketplace',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  // ============================================
  // MARKETPLACE OPERATIONS
  // ============================================

  /**
   * Get marketplace invoices for lenders
   */
  static async getMarketplaceInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== UserRole.LENDER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only lenders can view marketplace invoices' 
        });
        return;
      }

      const filters: MarketplaceFilters = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        sortBy: (req.query.sortBy as any) || 'listedAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        ...req.query
      };

      // Try cache first
      const cached = await InvoiceRedisService.getCachedMarketplaceInvoices(filters);
      if (cached) {
        res.json({
          success: true,
          data: {
            invoices: cached,
            pagination: InvoiceController.generatePaginationInfo(cached, filters as any)
          }
        });
        return;
      }

      // Build query for marketplace invoices
      const query: any = { status: InvoiceStatus.LISTED };
      
      if (filters.minAmount || filters.maxAmount) {
        query.amount = {};
        if (filters.minAmount) query.amount.$gte = filters.minAmount;
        if (filters.maxAmount) query.amount.$lte = filters.maxAmount;
      }
      
      if (filters.currency) query.currency = filters.currency;
      if (filters.anchorId) query.anchorId = filters.anchorId;
      
      if (filters.maxDaysUntilDue) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + filters.maxDaysUntilDue);
        query.dueDate = { $lte: cutoffDate };
      }

      const sortOptions: any = {};
      sortOptions[filters.sortBy || 'listedAt'] = filters.sortOrder === 'asc' ? 1 : -1;

      const skip = (filters.page! - 1) * filters.limit!;

      const [invoices, total] = await Promise.all([
        Invoice.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(filters.limit!)
          .populate('sellerId', 'firstName lastName businessName')
          .populate('anchorId', 'firstName lastName businessName _id'),
        
        Invoice.countDocuments(query)
      ]);

      const marketplaceInvoices: InvoiceMarketplaceResponse[] = invoices.map(invoice => ({
        invoiceId: String(invoice._id),
        amount: invoice.amount,
        currency: invoice.currency,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        description: invoice.description,
        daysUntilDue: invoice.daysUntilDue,
        isOverdue: invoice.isOverdue,
        listedAt: invoice.listedAt!,
        seller: {
          businessName: (invoice.sellerId as any)?.businessName,
          firstName: (invoice.sellerId as any)?.firstName,
          lastName: (invoice.sellerId as any)?.lastName
        },
        anchor: {
          businessName: (invoice.anchorId as any)?.businessName,
          firstName: (invoice.anchorId as any)?.firstName,
          lastName: (invoice.anchorId as any)?.lastName,
          userId: (invoice.anchorId as any)?._id?.toString()
        },
        invoicePreview: invoice.invoiceDocument ? {
          cloudinaryUrl: invoice.invoiceDocument.cloudinaryUrl,
          thumbnailUrl: InvoiceDocumentService.generateThumbnailUrl(invoice.invoiceDocument.cloudinaryPublicId)
        } : undefined,
        timeOnMarket: Math.ceil((new Date().getTime() - invoice.listedAt!.getTime()) / (1000 * 60 * 60 * 24))
      }));

      // Cache results
      await InvoiceRedisService.cacheMarketplaceInvoices(filters, marketplaceInvoices);

      res.json({
        success: true,
        data: {
          invoices: marketplaceInvoices,
          pagination: {
            currentPage: filters.page!,
            totalPages: Math.ceil(total / filters.limit!),
            totalItems: total,
            itemsPerPage: filters.limit!,
            hasNext: filters.page! * filters.limit! < total,
            hasPrev: filters.page! > 1
          },
          filters
        }
      });

    } catch (error) {
      console.error('Get marketplace invoices error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get marketplace invoices',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  /**
   * Get trending invoices
   */
  static async getTrendingInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== UserRole.LENDER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only lenders can view trending invoices' 
        });
        return;
      }

      const limit = Number(req.query.limit) || 10;

      // Try cache first
      const cached = await InvoiceRedisService.getCachedPopularInvoices();
      if (cached) {
        res.json({
          success: true,
          data: {
            trendingInvoices: cached.slice(0, limit)
          }
        });
        return;
      }

      // Get trending invoice IDs from Redis
      const trendingData = await InvoiceRedisService.getTrendingInvoices(limit);
      
      if (trendingData.length === 0) {
        res.json({
          success: true,
          data: {
            trendingInvoices: []
          }
        });
        return;
      }

      // Get invoice details
      const invoiceIds = trendingData.map(item => item.invoiceId);
      const invoices = await Invoice.find({ 
        _id: { $in: invoiceIds }, 
        status: InvoiceStatus.LISTED 
      })
      .populate('sellerId', 'firstName lastName businessName')
      .populate('anchorId', 'firstName lastName businessName _id');

      const trendingInvoices: InvoiceMarketplaceResponse[] = invoices.map(invoice => {
        const trendingInfo = trendingData.find(item => item.invoiceId === String(invoice._id));
        return {
          invoiceId: String(invoice._id),
            amount: invoice.amount,
          currency: invoice.currency,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          description: invoice.description,
          daysUntilDue: invoice.daysUntilDue,
          isOverdue: invoice.isOverdue,
          listedAt: invoice.listedAt!,
          seller: {
            businessName: (invoice.sellerId as any)?.businessName,
            firstName: (invoice.sellerId as any)?.firstName,
            lastName: (invoice.sellerId as any)?.lastName
          },
          anchor: {
            businessName: (invoice.anchorId as any)?.businessName,
            firstName: (invoice.anchorId as any)?.firstName,
            lastName: (invoice.anchorId as any)?.lastName,
            userId: (invoice.anchorId as any)?._id?.toString()
          },
          invoicePreview: invoice.invoiceDocument ? {
            cloudinaryUrl: invoice.invoiceDocument.cloudinaryUrl,
            thumbnailUrl: InvoiceDocumentService.generateThumbnailUrl(invoice.invoiceDocument.cloudinaryPublicId)
          } : undefined,
          timeOnMarket: Math.ceil((new Date().getTime() - invoice.listedAt!.getTime()) / (1000 * 60 * 60 * 24))
        };
      });

      // Cache results
      await InvoiceRedisService.cachePopularInvoices(trendingInvoices);

      res.json({
        success: true,
        data: {
          trendingInvoices
        }
      });

    } catch (error) {
      console.error('Get trending invoices error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get trending invoices',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  }

  // ============================================
  // PLACEHOLDER METHODS (TO BE IMPLEMENTED)
  // ============================================

  /**
   * Placeholder methods for remaining functionality
   */
  static async getInvoiceStatusHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const invoice = await Invoice.findById(id)
        .populate('statusHistory.changedBy', 'firstName lastName email role', 'User');

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      // Check access permissions
      const hasAccess = InvoiceController.hasInvoiceAccess(invoice, userId!, userRole!);

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to view this invoice history'
        });
        return;
      }

      // Format status history with user details
      const formattedHistory = invoice.statusHistory.map(entry => {
        const userInfo = entry.changedBy as any;
        
        // Filter sensitive information based on user role
        let displayNotes = entry.notes;
        if (userRole === UserRole.SELLER) {
          // Hide internal admin/anchor notes from sellers
          if (entry.status === 'rejected' && entry.notes?.includes('INTERNAL:')) {
            displayNotes = 'Rejected - please check with support for details';
          }
        }

        return {
          status: entry.status,
          timestamp: entry.timestamp,
          changedBy: userInfo ? {
            userId: userInfo._id,
            name: `${userInfo.firstName} ${userInfo.lastName}`,
            email: userRole === UserRole.ADMIN ? userInfo.email : undefined, // Email only for admins
            role: userInfo.role
          } : null,
          notes: displayNotes,
          // Add status-specific metadata
          metadata: InvoiceController.getStatusMetadata(entry.status, invoice)
        };
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Add timeline summary
      const statusCounts = formattedHistory.reduce((acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const timelineMetrics = {
        totalStatusChanges: formattedHistory.length,
        statusBreakdown: statusCounts,
        firstSubmitted: formattedHistory.find(entry => entry.status === 'submitted')?.timestamp,
        lastModified: formattedHistory[0]?.timestamp,
        processingTime: invoice.submittedAt ? 
          (new Date().getTime() - new Date(invoice.submittedAt).getTime()) / (1000 * 60 * 60 * 24) // days
          : null
      };

      res.json({
        success: true,
        data: {
          invoiceId: String(invoice._id),
          currentStatus: invoice.status,
          statusHistory: formattedHistory,
          timeline: timelineMetrics
        }
      });

    } catch (error) {
      console.error('Get invoice status history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve invoice status history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async getSecureDocumentUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, type } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      // Check access permissions
      const hasAccess = InvoiceController.hasInvoiceAccess(invoice, userId!, userRole!);

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to access documents for this invoice'
        });
        return;
      }

      let documentInfo: { publicId: string; filename: string; originalName: string } | null = null;

      // Determine which document to access
      if (type === 'main') {
        if (!invoice.invoiceDocument || !invoice.invoiceDocument.cloudinaryPublicId) {
          res.status(404).json({
            success: false,
            message: 'Main invoice document not found'
          });
          return;
        }
        documentInfo = {
          publicId: invoice.invoiceDocument.cloudinaryPublicId,
          filename: invoice.invoiceDocument.filename,
          originalName: invoice.invoiceDocument.originalName
        };
      } else {
        // Supporting document by cloudinary public ID
        const supportingDoc = invoice.supportingDocuments.find(
          doc => doc.cloudinaryPublicId === type
        );
        
        if (!supportingDoc) {
          res.status(404).json({
            success: false,
            message: 'Supporting document not found'
          });
          return;
        }
        
        documentInfo = {
          publicId: supportingDoc.cloudinaryPublicId,
          filename: supportingDoc.filename,
          originalName: supportingDoc.originalName
        };
      }

      // Generate secure signed URL with 2-hour expiration
      try {
        const secureUrl = await InvoiceDocumentService.generateSecureUrl(
          documentInfo.publicId,
          { expiresIn: 7200 } // 2 hours
        );

        res.json({
          success: true,
          data: {
            documentType: type,
            filename: documentInfo.filename,
            originalName: documentInfo.originalName,
            secureUrl,
            expiresAt: new Date(Date.now() + 7200 * 1000), // 2 hours from now
            accessInfo: {
              authorizedUser: userId,
              userRole,
              invoiceId: String(invoice._id),
              accessGrantedAt: new Date()
            }
          }
        });

      } catch (urlError) {
        console.error('Failed to generate secure URL:', urlError);
        res.status(500).json({
          success: false,
          message: 'Failed to generate secure document URL',
          error: 'Document access temporarily unavailable'
        });
      }

    } catch (error) {
      console.error('Get secure document URL error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate secure document URL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async getInvoiceAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { period = '30d', startDate, endDate } = req.query as any;

      // Build date filter
      let dateFilter: any = {};
      if (startDate && endDate) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      } else {
        // Default periods
        const now = new Date();
        const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
        const startOfPeriod = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
        dateFilter = { createdAt: { $gte: startOfPeriod } };
      }

      // Build role-based filter
      let roleFilter: any = {};
      if (userRole === UserRole.SELLER) {
        roleFilter.sellerId = userId;
      } else if (userRole === UserRole.ANCHOR) {
        roleFilter.anchorId = userId;
      } else if (userRole === UserRole.LENDER) {
        roleFilter.fundedBy = userId;
      }
      // Admins can see all data (no additional filter)

      const baseQuery = { ...dateFilter, ...roleFilter };

      // Check cache first
      const cacheKey = `invoice:analytics:${userRole}:${userId}:${JSON.stringify(baseQuery)}`;
      const cachedResult = await InvoiceRedisService.getCachedData(cacheKey);
      if (cachedResult) {
        res.json({
          success: true,
          data: cachedResult,
          cached: true
        });
        return;
      }

      // Parallel analytics queries
      const [
        totalStats,
        statusBreakdown,
        monthlyTrends,
        performanceMetrics
      ] = await Promise.all([
        // Total statistics
        Invoice.aggregate([
          { $match: baseQuery },
          {
            $group: {
              _id: null,
              totalInvoices: { $sum: 1 },
              totalValue: { $sum: '$amount' },
              avgAmount: { $avg: '$amount' },
              currency: { $first: '$currency' }
            }
          }
        ]),

        // Status breakdown
        Invoice.aggregate([
          { $match: baseQuery },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalValue: { $sum: '$amount' }
            }
          },
          {
            $project: {
              status: '$_id',
              count: 1,
              totalValue: 1,
              _id: 0
            }
          }
        ]),

        // Monthly trends (last 12 months)
        Invoice.aggregate([
          {
            $match: {
              ...roleFilter,
              createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              invoicesCreated: { $sum: 1 },
              invoicesCompleted: {
                $sum: {
                  $cond: [
                    { $in: ['$status', ['funded', 'repaid', 'settled']] },
                    1,
                    0
                  ]
                }
              },
              totalValue: { $sum: '$amount' },
              avgProcessingTime: {
                $avg: {
                  $cond: [
                    { $and: ['$submittedAt', '$fundedAt'] },
                    {
                      $divide: [
                        { $subtract: ['$fundedAt', '$submittedAt'] },
                        86400000 // Convert to days
                      ]
                    },
                    null
                  ]
                }
              }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1 }
          },
          {
            $project: {
              month: {
                $dateToString: {
                  format: '%Y-%m',
                  date: {
                    $dateFromParts: {
                      year: '$_id.year',
                      month: '$_id.month'
                    }
                  }
                }
              },
              invoicesCreated: 1,
              invoicesCompleted: 1,
              totalValue: 1,
              avgProcessingTime: { $round: ['$avgProcessingTime', 1] },
              _id: 0
            }
          }
        ]),

        // Performance metrics
        Invoice.aggregate([
          { $match: { ...baseQuery, submittedAt: { $exists: true } } },
          {
            $group: {
              _id: null,
              avgApprovalTime: {
                $avg: {
                  $cond: [
                    { $and: ['$submittedAt', '$anchorApprovalDate'] },
                    {
                      $divide: [
                        { $subtract: ['$anchorApprovalDate', '$submittedAt'] },
                        86400000
                      ]
                    },
                    null
                  ]
                }
              },
              avgFundingTime: {
                $avg: {
                  $cond: [
                    { $and: ['$anchorApprovalDate', '$fundedAt'] },
                    {
                      $divide: [
                        { $subtract: ['$fundedAt', '$anchorApprovalDate'] },
                        86400000
                      ]
                    },
                    null
                  ]
                }
              },
              totalSubmitted: { $sum: 1 },
              successfullyFunded: {
                $sum: {
                  $cond: [
                    { $in: ['$status', ['funded', 'repaid', 'settled']] },
                    1,
                    0
                  ]
                }
              },
              overdueInvoices: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: [new Date(), '$dueDate'] },
                        { $ne: ['$status', 'settled'] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $project: {
              avgApprovalTime: { $round: ['$avgApprovalTime', 1] },
              avgFundingTime: { $round: ['$avgFundingTime', 1] },
              successRate: {
                $round: [
                  { $multiply: [{ $divide: ['$successfullyFunded', '$totalSubmitted'] }, 100] },
                  1
                ]
              },
              overdueRate: {
                $round: [
                  { $multiply: [{ $divide: ['$overdueInvoices', '$totalSubmitted'] }, 100] },
                  1
                ]
              }
            }
          }
        ])
      ]);

      // Format response
      const analytics = {
        summary: {
          totalInvoices: totalStats[0]?.totalInvoices || 0,
          totalValue: totalStats[0]?.totalValue || 0,
          averageAmount: totalStats[0]?.avgAmount || 0,
          currency: totalStats[0]?.currency || 'NGN'
        },
        statusBreakdown: statusBreakdown.map(item => ({
          ...item,
          percentage: totalStats[0] ? Math.round((item.count / totalStats[0].totalInvoices) * 100) : 0
        })),
        monthlyTrends: monthlyTrends,
        performance: performanceMetrics[0] || {
          avgApprovalTime: 0,
          avgFundingTime: 0,
          successRate: 0,
          overdueRate: 0
        },
        metadata: {
          period,
          userRole,
          generatedAt: new Date(),
          filterApplied: Object.keys(roleFilter).length > 0
        }
      };

      // Cache for 15 minutes
      await InvoiceRedisService.cacheData(cacheKey, analytics, 900);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Get invoice analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve invoice analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async getPerformanceMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  }

  static async getMarketTrends(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  }

  static async searchInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  }

  static async getFilterOptions(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  }

  static async bulkStatusUpdate(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  }

  static async exportInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  }

  static async uploadSupportingDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if files were uploaded
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
        return;
      }

      // Validate file count (max 5)
      if (files.length > 5) {
        res.status(400).json({
          success: false,
          message: 'Maximum 5 supporting documents allowed'
        });
        return;
      }

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      // Check permissions - only seller can upload to their invoice
      if (userRole !== UserRole.SELLER || String(invoice.sellerId) !== userId) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to upload documents for this invoice'
        });
        return;
      }

      // Check if invoice can be edited
      if (!invoice.canBeEdited()) {
        res.status(400).json({
          success: false,
          message: 'Cannot upload documents for invoice in current status'
        });
        return;
      }

      const uploadedDocuments = [];
      const errors = [];

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Get document type from fieldname (supportingDocuments[0][type], etc.)
          const fieldName = file.fieldname;
          const documentTypeMatch = fieldName.match(/\[(\w+)\]/);
          const documentType = documentTypeMatch ? documentTypeMatch[1] : 'other';

          // Validate document type
          const validTypes = ['purchase_order', 'delivery_note', 'contract', 'other'];
          const finalDocumentType = validTypes.includes(documentType) ? documentType : 'other';

          const uploadedDocument = await InvoiceDocumentService.uploadSupportingDocument(
            String(invoice._id),
            finalDocumentType,
            file
          );

          uploadedDocuments.push({
            documentType: finalDocumentType as any,
            filename: uploadedDocument.filename,
            originalName: uploadedDocument.originalName,
            cloudinaryUrl: uploadedDocument.cloudinaryUrl,
            cloudinaryPublicId: uploadedDocument.cloudinaryPublicId,
            fileSize: uploadedDocument.fileSize,
            mimeType: uploadedDocument.mimeType,
            uploadedAt: new Date()
          });

        } catch (error) {
          console.error(`Failed to upload file ${file.originalname}:`, error);
          errors.push({
            filename: file.originalname,
            error: error instanceof Error ? error.message : 'Upload failed'
          });
        }
      }

      // Add uploaded documents to invoice
      if (uploadedDocuments.length > 0) {
        invoice.supportingDocuments.push(...uploadedDocuments);
        await invoice.save();

        // Invalidate caches
        await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), userId);

        // Send real-time update
        await InvoiceRedisService.publishStatusUpdate(String(invoice._id), {
          type: 'document_uploaded',
          invoiceId: String(invoice._id),
          message: `${uploadedDocuments.length} supporting document(s) uploaded`,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: `Successfully uploaded ${uploadedDocuments.length} supporting document(s)`,
        data: {
          uploadedDocuments,
          errors: errors.length > 0 ? errors : undefined,
          totalSupportingDocuments: invoice.supportingDocuments.length
        }
      });

    } catch (error) {
      console.error('Upload supporting documents error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload supporting documents',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async deleteSupportingDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, docId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      // Check permissions - only seller can delete from their invoice
      if (userRole !== UserRole.SELLER || String(invoice.sellerId) !== userId) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to delete documents from this invoice'
        });
        return;
      }

      // Check if invoice can be edited
      if (!invoice.canBeEdited()) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete documents for invoice in current status'
        });
        return;
      }

      // Find document by cloudinaryPublicId
      const docIndex = invoice.supportingDocuments.findIndex(
        doc => doc.cloudinaryPublicId === docId
      );

      if (docIndex === -1) {
        res.status(404).json({
          success: false,
          message: 'Supporting document not found'
        });
        return;
      }

      const documentToDelete = invoice.supportingDocuments[docIndex];

      try {
        // Delete from Cloudinary
        await InvoiceDocumentService.deleteDocument(documentToDelete.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.error('Failed to delete from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }

      // Remove from database
      invoice.supportingDocuments.splice(docIndex, 1);
      await invoice.save();

      // Invalidate caches
      await InvoiceRedisService.invalidateInvoiceCaches(String(invoice._id), userId);

      // Send real-time update
      await InvoiceRedisService.publishStatusUpdate(String(invoice._id), {
        type: 'document_uploaded',
        invoiceId: String(invoice._id),
        message: 'Supporting document deleted',
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Supporting document deleted successfully',
        data: {
          deletedDocument: {
            filename: documentToDelete.filename,
            documentType: documentToDelete.documentType
          },
          remainingSupportingDocuments: invoice.supportingDocuments.length
        }
      });

    } catch (error) {
      console.error('Delete supporting document error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete supporting document',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async subscribeToInvoiceUpdates(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  }

  static async sendCustomNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static hasInvoiceAccess(invoice: any, userId: string, userRole: string): boolean {
    // Admin can see all
    if (userRole === UserRole.ADMIN) return true;
    
    // Seller can see their own invoices
    if (userRole === UserRole.SELLER && invoice.sellerId?.toString() === userId) return true;
    if (userRole === UserRole.SELLER && invoice.sellerId?._id?.toString() === userId) return true;
    
    // Anchor can see invoices assigned to them
    if (userRole === UserRole.ANCHOR && invoice.anchorId?.toString() === userId) return true;
    if (userRole === UserRole.ANCHOR && invoice.anchorId?._id?.toString() === userId) return true;
    
    // Lender can see listed invoices and those they funded
    if (userRole === UserRole.LENDER) {
      if (invoice.status === InvoiceStatus.LISTED) return true;
      if (invoice.fundedBy?.toString() === userId) return true;
      if (invoice.fundedBy?._id?.toString() === userId) return true;
    }
    
    return false;
  }

  private static buildInvoiceQuery(filters: InvoiceSearchFilters): any {
    const query: any = {};

    if (filters.status) {
      query.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;
    }
    
    if (filters.sellerId) query.sellerId = filters.sellerId;
    if (filters.anchorId) query.anchorId = filters.anchorId;
    if (filters.fundedBy) query.fundedBy = filters.fundedBy;
    
    if (filters.minAmount || filters.maxAmount) {
      query.amount = {};
      if (filters.minAmount) query.amount.$gte = filters.minAmount;
      if (filters.maxAmount) query.amount.$lte = filters.maxAmount;
    }
    
    if (filters.currency) query.currency = filters.currency;
    
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }
    
    if (filters.dueDateFrom || filters.dueDateTo) {
      query.dueDate = {};
      if (filters.dueDateFrom) query.dueDate.$gte = new Date(filters.dueDateFrom);
      if (filters.dueDateTo) query.dueDate.$lte = new Date(filters.dueDateTo);
    }
    
    if (filters.search) {
      query.$or = [
        { description: { $regex: filters.search, $options: 'i' } },
        { _id: { $regex: filters.search, $options: 'i' } }
      ];
    }

    return query;
  }

  private static buildSortOptions(filters: InvoiceSearchFilters): any {
    const sortOptions: any = {};
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    sortOptions[sortBy] = sortOrder;
    return sortOptions;
  }

  private static generatePaginationInfo(items: any[], filters: InvoiceSearchFilters | MarketplaceFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    return {
      currentPage: page,
      totalPages: Math.ceil(items.length / limit),
      totalItems: items.length,
      itemsPerPage: limit,
      hasNext: page * limit < items.length,
      hasPrev: page > 1
    };
  }

  private static async formatInvoiceBasicResponse(invoice: any): Promise<InvoiceBasicResponse> {
    return {
      invoiceId: String(invoice._id),
      sellerId: invoice.sellerId?._id?.toString() || invoice.sellerId?.toString(),
      anchorId: invoice.anchorId?._id?.toString() || invoice.anchorId?.toString(),
      amount: invoice.amount,
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      description: invoice.description,
      status: invoice.status,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      daysUntilDue: invoice.daysUntilDue,
      isOverdue: invoice.isOverdue
    };
  }

  private static async formatInvoiceDetailedResponse(invoice: any): Promise<InvoiceDetailedResponse> {
    const basic = await InvoiceController.formatInvoiceBasicResponse(invoice);
    
    // Create default document structure if no document exists
    const invoiceDocument = invoice.invoiceDocument ? {
      filename: invoice.invoiceDocument.filename,
      originalName: invoice.invoiceDocument.originalName,
      cloudinaryUrl: invoice.invoiceDocument.cloudinaryUrl,
      fileSize: invoice.invoiceDocument.fileSize,
      mimeType: invoice.invoiceDocument.mimeType,
      uploadedAt: invoice.invoiceDocument.uploadedAt
    } : {
      filename: '',
      originalName: '',
      cloudinaryUrl: '',
      fileSize: 0,
      mimeType: '',
      uploadedAt: new Date()
    };
    
    return {
      ...basic,
      invoiceDocument,
      supportingDocuments: invoice.supportingDocuments?.map((doc: any) => ({
        documentType: doc.documentType,
        filename: doc.filename,
        originalName: doc.originalName,
        cloudinaryUrl: doc.cloudinaryUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt
      })) || [],
      submittedAt: invoice.submittedAt,
      anchorApprovalDate: invoice.anchorApprovalDate,
      anchorRejectionDate: invoice.anchorRejectionDate,
      adminVerificationDate: invoice.adminVerificationDate,
      listedAt: invoice.listedAt,
      fundedAt: invoice.fundedAt,
      repaymentDate: invoice.repaymentDate,
      settlementDate: invoice.settlementDate,
      anchorApprovalNotes: invoice.anchorApprovalNotes,
      anchorRejectionReason: invoice.anchorRejectionReason,
      adminVerificationNotes: invoice.adminVerificationNotes,
      adminRejectionReason: invoice.adminRejectionReason,
      fundingAmount: invoice.fundingAmount,
      interestRate: invoice.interestRate,
      totalRepaymentAmount: invoice.totalRepaymentAmount,
      repaidAmount: invoice.repaidAmount,
      fundingPercentage: invoice.fundingPercentage,
      repaymentProgress: invoice.repaymentProgress,
      seller: invoice.sellerId && typeof invoice.sellerId === 'object' ? {
        userId: String(invoice.sellerId._id),
        firstName: invoice.sellerId.firstName,
        lastName: invoice.sellerId.lastName,
        businessName: invoice.sellerId.businessName,
        email: invoice.sellerId.email
      } : undefined,
      anchor: invoice.anchorId && typeof invoice.anchorId === 'object' ? {
        userId: String(invoice.anchorId._id),
        firstName: invoice.anchorId.firstName,
        lastName: invoice.anchorId.lastName,
        businessName: invoice.anchorId.businessName,
        email: invoice.anchorId.email
      } : undefined,
      fundedBy: invoice.fundedBy && typeof invoice.fundedBy === 'object' ? {
        userId: String(invoice.fundedBy._id),
        firstName: invoice.fundedBy.firstName,
        lastName: invoice.fundedBy.lastName,
        businessName: invoice.fundedBy.businessName
      } : undefined
    };
  }

  private static getStatusMetadata(status: string, invoice: any) {
    const metadata: any = {};
    
    switch (status) {
      case 'submitted':
        metadata.documentsIncluded = {
          mainDocument: !!invoice.invoiceDocument,
          supportingDocuments: invoice.supportingDocuments.length
        };
        break;
      case 'anchor_approved':
        if (invoice.fundingAmount) metadata.approvedFundingAmount = invoice.fundingAmount;
        if (invoice.interestRate) metadata.approvedInterestRate = invoice.interestRate;
        break;
      case 'admin_verified':
        metadata.verificationDate = invoice.adminVerificationDate;
        break;
      case 'listed':
        metadata.listedDate = invoice.listedAt;
        break;
      case 'funded':
        metadata.fundingDetails = {
          amount: invoice.fundingAmount,
          interestRate: invoice.interestRate,
          fundedDate: invoice.fundedAt,
          totalRepaymentAmount: invoice.totalRepaymentAmount
        };
        break;
      case 'repaid':
        metadata.repaymentDetails = {
          repaidAmount: invoice.repaidAmount,
          repaidDate: invoice.repaymentDate,
          repaymentProgress: invoice.repaymentProgress
        };
        break;
    }
    
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }
}