import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { upload, generateFilename, getCloudinaryFolder } from '../config/multer';
import { AuthenticatedRequest } from '../utils/types';
import { DocumentType } from '../interfaces/common';

export interface UploadedFile {
  documentType: DocumentType;
  filename: string;
  originalName: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
}

// Middleware for handling KYC document uploads
export const uploadKYCDocuments = (req: Request, res: Response, next: NextFunction) => {
  upload.array('documents', 10)(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: 'File size exceeds 5MB limit'
        });
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: 'Too many files. Maximum 10 files allowed'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'File upload failed',
        error: error.message
      });
    }
    next();
  });
};

// Middleware for handling invoice document uploads
export const uploadInvoiceDocuments = {
  single: (fieldName: string) => (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (error) => {
      if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Invoice document upload failed',
            error: 'File size exceeds 5MB limit'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Invoice document upload failed',
          error: error.message
        });
      }
      next();
    });
  },
  
  array: (fieldName: string, maxCount: number = 5) => (req: Request, res: Response, next: NextFunction) => {
    upload.array(fieldName, maxCount)(req, res, (error) => {
      if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Supporting documents upload failed',
            error: 'File size exceeds 5MB limit'
          });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Supporting documents upload failed',
            error: `Too many files. Maximum ${maxCount} files allowed`
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Supporting documents upload failed',
          error: error.message
        });
      }
      next();
    });
  }
};

// Upload files to Cloudinary
export const uploadToCloudinary = async (
  file: Express.Multer.File,
  userId: string,
  documentType: DocumentType
): Promise<UploadedFile> => {
  try {
    const filename = generateFilename(file.originalname, userId, documentType);
    const folder = getCloudinaryFolder(userId);
    
    // Upload to Cloudinary
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: filename.split('.')[0], // Remove extension for public_id
          resource_type: 'auto',
          type: 'authenticated', // Secure access for KYC documents
          format: file.originalname.split('.').pop(), // Preserve original format
          backup: true, // Enable backup for compliance
          tags: ['kyc', 'document', userId, documentType]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });

    return {
      documentType,
      filename,
      originalName: file.originalname,
      cloudinaryUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      fileSize: file.size,
      mimeType: file.mimetype
    };
  } catch (error) {
    throw new Error(`Failed to upload ${documentType}: ${error}`);
  }
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Failed to delete file from Cloudinary:', error);
    // Don't throw error here as it might be already deleted
  }
};

// Middleware to process uploaded files and upload to Cloudinary
export const processKYCUploads = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as Express.Multer.File[];
    const userId = req.user!.userId;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
        error: 'At least one document file is required'
      });
    }

    // Extract document types from form data
    const documentTypes = req.body.documentTypes;
    if (!documentTypes || !Array.isArray(documentTypes) || documentTypes.length !== files.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document types',
        error: 'Document types must match the number of uploaded files'
      });
    }

    // Parse JSON strings in form data
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

    // Upload all files to Cloudinary
    const uploadPromises = files.map((file, index) => 
      uploadToCloudinary(file, userId, documentTypes[index])
    );

    const uploadedFiles = await Promise.all(uploadPromises);
    
    // Attach uploaded files to request for controller access
    req.uploadedFiles = uploadedFiles;
    
    next();
  } catch (error: any) {
    console.error('File upload processing error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: 'Failed to process uploaded files'
    });
  }
};