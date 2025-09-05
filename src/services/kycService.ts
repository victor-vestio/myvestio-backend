import { KYC } from '../models/KYC';
import { User } from '../models/User';
import { IKYC, SubmitKYCRequest, KYCStatusResponse, KYCAdminResponse } from '../interfaces/IKYC';
import { UserRole, BusinessType, KYCStatus, DocumentType } from '../interfaces/common';
import { UploadedFile, deleteFromCloudinary } from '../middleware/upload';
import { EmailService } from './emailService';
import { KYCRedisService } from './kycRedisService';

export class KYCService {
  
  // Get or create KYC record for user
  static async getOrCreateKYC(userId: string): Promise<IKYC> {
    let kyc = await KYC.findOne({ userId });
    
    if (!kyc) {
      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Create new KYC record
      kyc = new KYC({
        userId,
        userRole: user.role,
        userBusinessType: user.businessType,
        status: KYCStatus.NOT_SUBMITTED
      });
      
      await kyc.save();
    }
    
    return kyc;
  }
  
  // Submit KYC documents
  static async submitKYC(
    userId: string,
    uploadedFiles: UploadedFile[],
    additionalData: SubmitKYCRequest
  ): Promise<KYCStatusResponse> {
    try {
      const kyc = await this.getOrCreateKYC(userId);
      
      // Validate that user is not already approved
      if (kyc.status === KYCStatus.APPROVED) {
        throw new Error('KYC is already approved');
      }
      
      // Add new documents to existing ones (remove duplicates by type)
      const existingDocs = kyc.documents.filter(doc => 
        !uploadedFiles.find(newDoc => newDoc.documentType === doc.documentType)
      );
      
      kyc.documents = [...existingDocs, ...uploadedFiles.map(file => ({
        documentType: file.documentType,
        filename: file.filename,
        originalName: file.originalName,
        cloudinaryUrl: file.cloudinaryUrl,
        cloudinaryPublicId: file.cloudinaryPublicId,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        uploadedAt: new Date()
      }))];
      
      // Update additional data
      if (additionalData.bankDetails) {
        kyc.bankDetails = additionalData.bankDetails;
      }
      
      if (additionalData.dateOfBirth) {
        kyc.dateOfBirth = new Date(additionalData.dateOfBirth);
      }
      
      // Reset everything when user uploads after rejection - fresh start
      if (kyc.status === KYCStatus.REJECTED) {
        kyc.status = KYCStatus.INCOMPLETE; // Pre-save middleware will set to SUBMITTED if complete
        kyc.rejectionReason = undefined;
        kyc.reviewedAt = undefined;
        kyc.reviewedBy = undefined;
        kyc.submittedAt = undefined;
        kyc.approvalNotes = undefined; // Clear any old approval notes too
      }
      
      // Save and let pre-save middleware update status
      const previousStatus = kyc.status;
      await kyc.save();
      
      // Invalidate cache after status change
      await KYCRedisService.invalidateKYCStatus(userId);
      
      // Track daily submissions for historical analytics
      if (kyc.status === KYCStatus.SUBMITTED) {
        await KYCRedisService.trackDailySubmissions('ready_for_review');
      } else {
        await KYCRedisService.trackDailySubmissions('in_progress');
      }
      
      // Update live pending counts
      await this.refreshLiveCounts();
      
      // Track metrics
      await KYCRedisService.trackSubmission(userId, uploadedFiles.length);
      
      // Send real-time status update
      if (kyc.status !== previousStatus) {
        await KYCRedisService.publishStatusUpdate(userId, {
          type: kyc.status === KYCStatus.SUBMITTED ? 'status_update' : 'document_uploaded',
          status: kyc.status,
          message: kyc.status === KYCStatus.SUBMITTED 
            ? 'All required documents submitted for review'
            : 'Documents uploaded successfully',
          timestamp: new Date()
        });
        
        // Notify admins if status changed to submitted
        if (kyc.status === KYCStatus.SUBMITTED) {
          await KYCRedisService.publishAdminNotification('new_submission', userId, {
            userRole: kyc.userRole,
            documentCount: kyc.documents.length
          });
          
          // Invalidate admin cache
          await KYCRedisService.invalidateAdminCache();
        }
      }
      
      // Send email notification if status changed to submitted
      if (kyc.status === KYCStatus.SUBMITTED && previousStatus !== KYCStatus.SUBMITTED) {
        const user = await User.findById(userId);
        if (user) {
          await EmailService.sendKYCStatusUpdate(user, KYCStatus.SUBMITTED);
        }
      }
      
      const response = this.formatKYCStatusResponse(kyc);
      
      // Cache the response
      await KYCRedisService.cacheKYCStatus(userId, response);
      
      return response;
    } catch (error) {
      // Clean up uploaded files on error
      for (const file of uploadedFiles) {
        await deleteFromCloudinary(file.cloudinaryPublicId);
      }
      throw error;
    }
  }
  
  // Get KYC status with cache stampede protection
  static async getKYCStatus(userId: string): Promise<KYCStatusResponse> {
    // Try to get from cache first
    const cached = await KYCRedisService.getCachedKYCStatus(userId);
    if (cached) {
      return cached;
    }
    
    // Distributed lock to prevent cache stampede
    const lockKey = `kyc:lock:${userId}`;
    const lockValue = Date.now().toString();
    const lockAcquired = await KYCRedisService.acquireLock(lockKey, lockValue, 5000);
    
    try {
      // Double-check cache after acquiring lock
      const cachedAfterLock = await KYCRedisService.getCachedKYCStatus(userId);
      if (cachedAfterLock) {
        return cachedAfterLock;
      }
      
      // Only one request will reach here
      const kyc = await this.getOrCreateKYC(userId);
      const response = this.formatKYCStatusResponse(kyc);
      
      // Cache the response
      await KYCRedisService.cacheKYCStatus(userId, response);
      
      return response;
    } finally {
      if (lockAcquired) {
        await KYCRedisService.releaseLock(lockKey, lockValue);
      }
    }
  }
  
  // Update KYC information
  static async updateKYC(userId: string, updateData: SubmitKYCRequest): Promise<KYCStatusResponse> {
    const kyc = await this.getOrCreateKYC(userId);
    
    // Validate that user is not already approved
    if (kyc.status === KYCStatus.APPROVED) {
      throw new Error('Cannot update approved KYC');
    }
    
    // Update data
    if (updateData.bankDetails) {
      kyc.bankDetails = updateData.bankDetails;
    }
    
    if (updateData.dateOfBirth) {
      kyc.dateOfBirth = new Date(updateData.dateOfBirth);
    }
    
    await kyc.save();
    return this.formatKYCStatusResponse(kyc);
  }
  
  // Admin: Get pending KYC applications with pagination and filtering
  static async getPendingKYCApplications(options: {
    page?: number;
    limit?: number;
    status?: KYCStatus[];
    userRole?: string;
    businessType?: string;
    sortBy?: 'submittedAt' | 'userEmail' | 'userRole';
    sortOrder?: 'asc' | 'desc';
    search?: string;
  } = {}): Promise<{
    applications: KYCAdminResponse[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      status = [KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW],
      userRole,
      businessType,
      sortBy = 'submittedAt',
      sortOrder = 'asc',
      search
    } = options;

    // Create cache key based on filters
    const cacheKey = `kyc:admin:pending:${JSON.stringify(options)}`;
    const cached = await KYCRedisService.getCachedFilteredApplications(cacheKey);
    if (cached) {
      return cached;
    }

    // Build query filters
    const query: any = {
      status: { $in: status }
    };

    if (userRole) {
      query.userRole = userRole;
    }

    if (businessType) {
      query.userBusinessType = businessType;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build sort object
    const sortOptions: any = {};
    if (sortBy === 'submittedAt') {
      sortOptions.submittedAt = sortOrder === 'desc' ? -1 : 1;
    } else {
      // For user-related sorting, we'll handle this after joining with users
      sortOptions.submittedAt = 1; // Default sort
    }

    // Get total count for pagination
    const totalItems = await KYC.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    // Get KYC records with pagination
    const pendingKYCs = await KYC.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Get user details
    const userIds = pendingKYCs.map(kyc => kyc.userId);
    const users = await User.find({ _id: { $in: userIds } });

    // Format applications
    let applications = pendingKYCs.map(kyc => {
      const user = users.find(u => u._id === kyc.userId);
      return this.formatKYCAdminResponse(kyc, user);
    });

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      applications = applications.filter(app => 
        app.userEmail.toLowerCase().includes(searchLower) ||
        app.userName.toLowerCase().includes(searchLower) ||
        app.userRole.toLowerCase().includes(searchLower) ||
        app.status.toLowerCase().includes(searchLower)
      );
    }

    // Apply user-based sorting if needed
    if (sortBy === 'userEmail') {
      applications.sort((a, b) => {
        const comparison = a.userEmail.localeCompare(b.userEmail);
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    } else if (sortBy === 'userRole') {
      applications.sort((a, b) => {
        const comparison = a.userRole.localeCompare(b.userRole);
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    const result = {
      applications,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };

    // Cache the result for 10 minutes (shorter than regular cache due to filtering)
    await KYCRedisService.cacheFilteredApplications(cacheKey, result, 600);

    return result;
  }
  
  // Admin: Approve KYC
  static async approveKYC(userId: string, adminId: string, approvalNotes?: string): Promise<void> {
    const kyc = await KYC.findOne({ userId });
    if (!kyc) {
      throw new Error('KYC record not found');
    }
    
    if (kyc.status === KYCStatus.APPROVED) {
      throw new Error('KYC is already approved');
    }
    
    // Update KYC status
    kyc.status = KYCStatus.APPROVED;
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = adminId;
    kyc.approvalNotes = approvalNotes;
    kyc.rejectionReason = undefined; // Clear any previous rejection reason
    
    await kyc.save();
    
    // Update user's KYC approval status
    await User.findByIdAndUpdate(userId, { isKYCApproved: true });
    
    // Invalidate caches
    await KYCRedisService.invalidateKYCStatus(userId);
    await KYCRedisService.invalidateAdminCache();
    
    // Send real-time notification
    await KYCRedisService.publishStatusUpdate(userId, {
      type: 'approved',
      status: KYCStatus.APPROVED,
      message: 'KYC application approved successfully',
      timestamp: new Date(),
      adminNotes: approvalNotes
    });
    
    // Send approval email
    const user = await User.findById(userId);
    if (user) {
      await EmailService.sendKYCStatusUpdate(user, KYCStatus.APPROVED, approvalNotes);
    }
    
    // Update live pending counts
    await this.refreshLiveCounts();
  }
  
  // Admin: Reject KYC
  static async rejectKYC(userId: string, adminId: string, rejectionReason: string): Promise<void> {
    const kyc = await KYC.findOne({ userId });
    if (!kyc) {
      throw new Error('KYC record not found');
    }
    
    if (kyc.status === KYCStatus.APPROVED) {
      throw new Error('Cannot reject approved KYC');
    }
    
    // Update KYC status
    kyc.status = KYCStatus.REJECTED;
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = adminId;
    kyc.rejectionReason = rejectionReason;
    kyc.approvalNotes = undefined; // Clear any previous approval notes
    
    await kyc.save();
    
    // Invalidate caches
    await KYCRedisService.invalidateKYCStatus(userId);
    await KYCRedisService.invalidateAdminCache();
    
    // Send real-time notification
    await KYCRedisService.publishStatusUpdate(userId, {
      type: 'rejected',
      status: KYCStatus.REJECTED,
      message: 'KYC application rejected',
      timestamp: new Date(),
      adminNotes: rejectionReason
    });
    
    // Send rejection email
    const user = await User.findById(userId);
    if (user) {
      await EmailService.sendKYCStatusUpdate(user, KYCStatus.REJECTED, rejectionReason);
    }
    
    // Update live pending counts
    await this.refreshLiveCounts();
  }
  
  // Format KYC status response
  private static formatKYCStatusResponse(kyc: IKYC): KYCStatusResponse {
    return {
      userId: kyc.userId,
      status: kyc.status,
      requiredDocuments: kyc.getRequiredDocuments(),
      uploadedDocuments: kyc.documents.map(doc => doc.documentType),
      missingDocuments: kyc.getMissingDocuments(),
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      approvalNotes: kyc.approvalNotes,
      rejectionReason: kyc.rejectionReason,
      bankDetails: kyc.bankDetails,
      dateOfBirth: kyc.dateOfBirth
    };
  }
  
  // Refresh live pending counts
  private static async refreshLiveCounts(): Promise<void> {
    try {
      // Count current pending applications
      const readyForReview = await KYC.countDocuments({
        status: { $in: [KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW] }
      });
      
      const inProgress = await KYC.countDocuments({
        status: { $in: [KYCStatus.INCOMPLETE, KYCStatus.NOT_SUBMITTED] }
      });
      
      // Update Redis cache
      await KYCRedisService.updateLiveCounts(readyForReview, inProgress);
    } catch (error) {
      console.error('Failed to refresh live counts:', error);
    }
  }

  // Format KYC admin response
  private static formatKYCAdminResponse(kyc: IKYC, user: any): KYCAdminResponse {
    return {
      userId: kyc.userId,
      userEmail: user?.email || '',
      userName: user ? `${user.firstName} ${user.lastName}` : '',
      userRole: kyc.userRole,
      userBusinessType: kyc.userBusinessType,
      status: kyc.status,
      submittedAt: kyc.submittedAt!,
      documents: kyc.documents.map(doc => ({
        documentType: doc.documentType,
        filename: doc.filename,
        cloudinaryUrl: doc.cloudinaryUrl,
        uploadedAt: doc.uploadedAt
      })),
      bankDetails: kyc.bankDetails,
      dateOfBirth: kyc.dateOfBirth
    };
  }
}