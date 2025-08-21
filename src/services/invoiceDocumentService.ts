import { v2 as cloudinary } from 'cloudinary';
import { ProcessedInvoiceFile } from '../interfaces/IInvoice';

// Configure cloudinary (should already be done in config, but ensuring here)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class InvoiceDocumentService {
  
  /**
   * Upload main invoice document with security and compliance settings
   */
  static async uploadInvoiceDocument(
    sellerId: string,
    invoiceId: string,
    file: Express.Multer.File
  ): Promise<ProcessedInvoiceFile> {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `vestio/invoices/${sellerId}`,
            public_id: `invoice_${invoiceId}_${Date.now()}`,
            resource_type: 'auto', // Handles both images and PDFs
            quality: 'auto',
            // Compliance and security settings
            backup: true, // Enable backup for compliance (7-year retention)
            type: 'authenticated', // Requires authentication for access
            tags: ['invoice', 'main_document', sellerId, invoiceId],
            // Metadata for audit trails
            context: {
              seller_id: sellerId,
              invoice_id: invoiceId,
              upload_type: 'main_invoice',
              uploaded_at: new Date().toISOString()
            }
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(file.buffer);
      });

      return {
        filename: `invoice_${invoiceId}_${Date.now()}.${file.originalname.split('.').pop()}`,
        originalName: file.originalname,
        cloudinaryUrl: result.secure_url,
        cloudinaryPublicId: result.public_id,
        fileSize: result.bytes,
        mimeType: file.mimetype,
        documentType: 'main_invoice'
      };
    } catch (error) {
      console.error('Failed to upload invoice document:', error);
      throw new Error('Invoice document upload failed');
    }
  }

  /**
   * Upload supporting documents for invoices
   */
  static async uploadSupportingDocument(
    invoiceId: string,
    documentType: string,
    file: Express.Multer.File
  ): Promise<ProcessedInvoiceFile> {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `vestio/invoices/supporting/${invoiceId}`,
            public_id: `${documentType}_${Date.now()}`,
            resource_type: 'auto',
            quality: 'auto',
            format: file.originalname.split('.').pop(), // Preserve original format
            backup: true,
            type: 'authenticated',
            tags: ['supporting_doc', documentType, invoiceId],
            context: {
              invoice_id: invoiceId,
              document_type: documentType,
              upload_type: 'supporting_document',
              uploaded_at: new Date().toISOString()
            }
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(file.buffer);
      });

      return {
        filename: `${documentType}_${Date.now()}.${file.originalname.split('.').pop()}`,
        originalName: file.originalname,
        cloudinaryUrl: result.secure_url,
        cloudinaryPublicId: result.public_id,
        fileSize: result.bytes,
        mimeType: file.mimetype,
        documentType: 'supporting_document'
      };
    } catch (error) {
      console.error('Failed to upload supporting document:', error);
      throw new Error('Supporting document upload failed');
    }
  }

  /**
   * Generate preview URL for invoice documents (for marketplace and admin review)
   */
  static generatePreviewUrl(publicId: string, options: {
    width?: number;
    height?: number;
    page?: number;
    quality?: string;
  } = {}): string {
    const {
      width = 800,
      height = 1000,
      page = 1,
      quality = '80'
    } = options;

    return cloudinary.url(publicId, {
      transformation: [
        { width, height, crop: 'fit' },
        { quality, format: 'jpg' },
        { page } // First page for PDF preview
      ]
    });
  }

  /**
   * Generate thumbnail for document cards in lists
   */
  static generateThumbnailUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      transformation: [
        { width: 300, height: 400, crop: 'fit' },
        { quality: '70', format: 'jpg' },
        { page: 1 }
      ]
    });
  }

  /**
   * Generate watermarked URL for different invoice states
   */
  static generateWatermarkedUrl(
    publicId: string, 
    watermarkText: string,
    options: {
      opacity?: number;
      color?: string;
      fontSize?: number;
    } = {}
  ): string {
    const {
      opacity = 30,
      color = 'red',
      fontSize = 60
    } = options;

    return cloudinary.url(publicId, {
      transformation: [
        {
          overlay: `text:Arial_${fontSize}:${watermarkText}`,
          color,
          opacity,
          gravity: 'center'
        }
      ]
    });
  }

  /**
   * Generate secure, time-limited URL for document access
   */
  static generateSecureViewUrl(
    publicId: string, 
    expiresInMinutes: number = 60
  ): string {
    const expiresAt = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);
    
    return cloudinary.utils.private_download_url(publicId, 'jpg', {
      expires_at: expiresAt,
      attachment: false // View in browser, don't download
    });
  }

  /**
   * Generate download URL with audit trail capability
   */
  static generateSecureDownloadUrl(
    publicId: string,
    filename: string,
    expiresInMinutes: number = 30
  ): string {
    const expiresAt = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);
    
    return cloudinary.utils.private_download_url(publicId, 'auto', {
      expires_at: expiresAt,
      attachment: true
    });
  }

  /**
   * Get different URL variants for invoice preview cards in marketplace
   */
  static getInvoicePreviewVariants(publicId: string) {
    return {
      thumbnail: this.generateThumbnailUrl(publicId),
      preview: this.generatePreviewUrl(publicId),
      fullSize: this.generateSecureViewUrl(publicId),
      marketplace: cloudinary.url(publicId, {
        transformation: [
          { width: 400, height: 300, crop: 'fit' },
          { quality: '70', format: 'jpg' },
          { overlay: 'text:Arial_20:Preview', gravity: 'south_east', color: 'white', background: 'black' }
        ]
      })
    };
  }

  /**
   * Update document access permissions based on invoice status
   */
  static async updateDocumentPermissions(
    publicId: string,
    newStatus: 'draft' | 'submitted' | 'approved' | 'verified' | 'listed' | 'funded'
  ): Promise<void> {
    try {
      let accessMode = 'token'; // Default secure access
      let tags = [];

      switch (newStatus) {
        case 'draft':
          tags = ['draft', 'restricted'];
          break;
        case 'submitted':
          tags = ['submitted', 'under_review'];
          break;
        case 'approved':
          tags = ['approved', 'anchor_verified'];
          break;
        case 'verified':
          tags = ['verified', 'admin_approved'];
          break;
        case 'listed':
          accessMode = 'authenticated'; // More accessible for marketplace
          tags = ['listed', 'marketplace'];
          break;
        case 'funded':
          tags = ['funded', 'active'];
          break;
      }

      // Update context instead of metadata (doesn't require predefined fields)
      await cloudinary.uploader.explicit(publicId, {
        type: 'authenticated',
        context: `invoice_status=${newStatus}|updated_at=${new Date().toISOString()}`
      });

      // Update tags
      await cloudinary.uploader.add_tag(tags.join(','), [publicId]);

      console.log(`✅ Updated permissions for document ${publicId} to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update document permissions:', error);
      // Don't throw here as this is not critical to invoice processing
    }
  }

  /**
   * Generate secure signed URL for document access
   */
  static async generateSecureUrl(
    publicId: string,
    options: { expiresIn?: number } = {}
  ): Promise<string> {
    try {
      const { expiresIn = 3600 } = options; // Default 1 hour
      
      // Generate signed URL for authenticated documents
      const signedUrl = cloudinary.url(publicId, {
        type: 'authenticated',
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn, // Unix timestamp
        resource_type: 'auto'
      });

      return signedUrl;
    } catch (error) {
      console.error('Failed to generate secure URL:', error);
      throw new Error('Secure URL generation failed');
    }
  }

  /**
   * Delete any document by public ID
   */
  static async deleteDocument(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
      console.log(`🗑️ Deleted document: ${publicId}`);
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw new Error('Document deletion failed');
    }
  }

  /**
   * Delete invoice document and all its variants
   */
  static async deleteInvoiceDocument(publicId: string): Promise<void> {
    try {
      // Delete the original document
      await cloudinary.uploader.destroy(publicId);
      
      // Delete any generated variants (thumbnails, previews)
      const variants = [
        `${publicId}_thumbnail`,
        `${publicId}_preview`,
        `${publicId}_watermark`
      ];

      for (const variant of variants) {
        try {
          await cloudinary.uploader.destroy(variant);
        } catch (error) {
          // Variants might not exist, continue
          console.log(`Variant ${variant} not found or already deleted`);
        }
      }

      console.log(`✅ Deleted invoice document: ${publicId}`);
    } catch (error) {
      console.error('Failed to delete invoice document:', error);
      throw new Error('Document deletion failed');
    }
  }

  /**
   * Get document metadata for audit trails
   */
  static async getDocumentMetadata(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        context: true,
        tags: true,
        metadata: true
      });

      return {
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        pages: result.pages,
        createdAt: result.created_at,
        uploadedAt: result.uploaded_at,
        tags: result.tags,
        context: result.context,
        metadata: result.metadata,
        accessMode: result.access_mode,
        folder: result.folder
      };
    } catch (error) {
      console.error('Failed to get document metadata:', error);
      throw new Error('Failed to retrieve document metadata');
    }
  }

  /**
   * Generate compliance report for invoice documents
   */
  static async generateComplianceReport(invoicePublicIds: string[]): Promise<any> {
    try {
      const documents = await Promise.all(
        invoicePublicIds.map(id => this.getDocumentMetadata(id))
      );

      return {
        totalDocuments: documents.length,
        totalStorage: documents.reduce((sum, doc) => sum + doc.bytes, 0),
        formats: documents.reduce((acc, doc) => {
          acc[doc.format] = (acc[doc.format] || 0) + 1;
          return acc;
        }, {}),
        complianceStatus: {
          backupEnabled: documents.filter(doc => doc.metadata?.backup).length,
          secureAccess: documents.filter(doc => doc.accessMode === 'token').length,
          properlyTagged: documents.filter(doc => doc.tags?.includes('invoice')).length
        },
        storageBreakdown: documents.map(doc => ({
          publicId: doc.publicId,
          bytes: doc.bytes,
          format: doc.format,
          createdAt: doc.createdAt,
          tags: doc.tags
        }))
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw new Error('Compliance report generation failed');
    }
  }

  /**
   * Bulk update document tags for organization
   */
  static async bulkUpdateDocumentTags(
    publicIds: string[],
    tagsToAdd: string[],
    tagsToRemove: string[] = []
  ): Promise<void> {
    try {
      if (tagsToAdd.length > 0) {
        await cloudinary.uploader.add_tag(tagsToAdd.join(','), publicIds);
      }

      if (tagsToRemove.length > 0) {
        await cloudinary.uploader.remove_tag(tagsToRemove.join(','), publicIds);
      }

      console.log(`✅ Updated tags for ${publicIds.length} documents`);
    } catch (error) {
      console.error('Failed to bulk update document tags:', error);
      throw new Error('Bulk tag update failed');
    }
  }
}