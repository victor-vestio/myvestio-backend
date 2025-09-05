import { Response } from 'express';
import { KYCService } from '../services/kycService';
import { AuthenticatedRequest } from '../utils/types';
import { ApiResponse, DocumentType, KYCStatus } from '../interfaces/common';
import { 
  SubmitKYCRequest, 
  KYCStatusResponse, 
  UploadDocumentResponse,
  KYCAdminResponse,
  ApproveKYCRequest,
  RejectKYCRequest,
  UpdateKYCRequest
} from '../interfaces/IKYC';

export class KYCController {
  
  // Submit KYC documents
  static async submitKYC(req: AuthenticatedRequest, res: Response<ApiResponse<KYCStatusResponse>>): Promise<void> {
    try {
      const userId = req.user!.userId;
      const uploadedFiles = req.uploadedFiles || [];
      const additionalData: SubmitKYCRequest = req.body;
      
      if (uploadedFiles.length === 0) {
        res.status(400).json({
          success: false,
          message: 'KYC submission failed',
          error: 'At least one document is required'
        });
        return;
      }
      
      const kycStatus = await KYCService.submitKYC(userId, uploadedFiles, additionalData);
      
      const message = kycStatus.status === 'submitted' 
        ? 'KYC documents submitted successfully for review'
        : 'KYC documents uploaded. Please complete all required documents to submit for review';
      
      res.status(200).json({
        success: true,
        message,
        data: kycStatus
      });
      
    } catch (error: any) {
      console.error('Submit KYC error:', error);
      res.status(500).json({
        success: false,
        message: 'KYC submission failed',
        error: error.message || 'Internal server error'
      });
    }
  }
  
  // Get KYC status
  static async getKYCStatus(req: AuthenticatedRequest, res: Response<ApiResponse<KYCStatusResponse>>): Promise<void> {
    try {
      const userId = req.user!.userId;
      const kycStatus = await KYCService.getKYCStatus(userId);
      
      res.status(200).json({
        success: true,
        message: 'KYC status retrieved successfully',
        data: kycStatus
      });
      
    } catch (error: any) {
      console.error('Get KYC status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve KYC status',
        error: 'Internal server error'
      });
    }
  }
  
  // Update KYC information
  static async updateKYC(req: AuthenticatedRequest, res: Response<ApiResponse<KYCStatusResponse>>): Promise<void> {
    try {
      const userId = req.user!.userId;
      const updateData: UpdateKYCRequest = req.body;
      const uploadedFiles = req.uploadedFiles || [];
      
      let kycStatus;
      
      // If files were uploaded, treat as document submission
      if (uploadedFiles.length > 0) {
        kycStatus = await KYCService.submitKYC(userId, uploadedFiles, updateData);
      } else {
        // Otherwise, just update additional data
        kycStatus = await KYCService.updateKYC(userId, updateData);
      }
      
      res.status(200).json({
        success: true,
        message: 'KYC information updated successfully',
        data: kycStatus
      });
      
    } catch (error: any) {
      console.error('Update KYC error:', error);
      res.status(500).json({
        success: false,
        message: 'KYC update failed',
        error: error.message || 'Internal server error'
      });
    }
  }
  
  // Admin: Get pending KYC applications with pagination and filtering
  static async getPendingKYCApplications(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      // Extract query parameters
      const {
        page = '1',
        limit = '20',
        status,
        userRole,
        businessType,
        sortBy = 'submittedAt',
        sortOrder = 'asc',
        search
      } = req.query;

      // Parse and validate parameters
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      
      // Validate pagination
      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters',
          error: 'Page must be >= 1, limit must be between 1 and 100'
        });
        return;
      }

      // Parse status array if provided
      let statusArray: KYCStatus[] | undefined;
      if (status) {
        try {
          const statusItems = Array.isArray(status) ? status : [status];
          statusArray = statusItems.map(s => s as KYCStatus);
        } catch (error) {
          res.status(400).json({
            success: false,
            message: 'Invalid status parameter',
            error: 'Status must be a valid KYC status'
          });
          return;
        }
      }

      const options = {
        page: pageNum,
        limit: limitNum,
        status: statusArray,
        userRole: userRole as string,
        businessType: businessType as string,
        sortBy: sortBy as 'submittedAt' | 'userEmail' | 'userRole',
        sortOrder: sortOrder as 'asc' | 'desc',
        search: search as string
      };

      const result = await KYCService.getPendingKYCApplications(options);
      
      res.status(200).json({
        success: true,
        message: 'Pending KYC applications retrieved successfully',
        data: {
          applications: result.applications,
          pagination: result.pagination,
          filters: {
            status: statusArray,
            userRole,
            businessType,
            search,
            sortBy,
            sortOrder
          }
        }
      });
      
    } catch (error: any) {
      console.error('Get pending KYC applications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve pending KYC applications',
        error: 'Internal server error'
      });
    }
  }
  
  // Admin: Approve KYC
  static async approveKYC(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = req.user!.userId;
      const { approvalNotes }: ApproveKYCRequest = req.body;
      
      await KYCService.approveKYC(userId, adminId, approvalNotes);
      
      res.status(200).json({
        success: true,
        message: 'KYC approved successfully'
      });
      
    } catch (error: any) {
      console.error('Approve KYC error:', error);
      res.status(500).json({
        success: false,
        message: 'KYC approval failed',
        error: error.message || 'Internal server error'
      });
    }
  }
  
  // Admin: Reject KYC
  static async rejectKYC(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = req.user!.userId;
      const { rejectionReason }: RejectKYCRequest = req.body;
      
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'KYC rejection failed',
          error: 'Rejection reason is required'
        });
        return;
      }
      
      await KYCService.rejectKYC(userId, adminId, rejectionReason);
      
      res.status(200).json({
        success: true,
        message: 'KYC rejected successfully'
      });
      
    } catch (error: any) {
      console.error('Reject KYC error:', error);
      res.status(500).json({
        success: false,
        message: 'KYC rejection failed',
        error: error.message || 'Internal server error'
      });
    }
  }
  
  // Get KYC requirements for current user
  static async getKYCRequirements(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const userId = req.user!.userId;
      const kycStatus = await KYCService.getKYCStatus(userId);
      
      const requirements = {
        userRole: req.user!.role,
        userBusinessType: req.user!.businessType,
        requiredDocuments: kycStatus.requiredDocuments,
        bankDetailsRequired: req.user!.role === 'seller' || 
          (req.user!.role === 'lender' && req.user!.businessType === 'company'),
        dateOfBirthRequired: req.user!.role === 'lender' && req.user!.businessType === 'individual'
      };
      
      res.status(200).json({
        success: true,
        message: 'KYC requirements retrieved successfully',
        data: requirements
      });
      
    } catch (error: any) {
      console.error('Get KYC requirements error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve KYC requirements',
        error: 'Internal server error'
      });
    }
  }
}