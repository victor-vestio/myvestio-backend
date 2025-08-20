import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// File validation configuration from environment variables
export const fileConfig = {
  maxFileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '5') * 1024 * 1024), // Convert MB to bytes
  allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png'
  ],
  allowedExtensions: process.env.ALLOWED_FILE_EXTENSIONS?.split(',') || ['.pdf', '.jpg', '.jpeg', '.png']
};

// Memory storage for Cloudinary upload
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check mime type
  if (fileConfig.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${fileConfig.allowedExtensions.join(', ')}`));
  }
};

// Base multer configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: fileConfig.maxFileSize,
    files: parseInt(process.env.MAX_FILES_PER_REQUEST || '10') // Maximum files per request from env
  }
});

// Generate unique filename
export const generateFilename = (originalName: string, userId: string, documentType: string): string => {
  const timestamp = new Date().toISOString().split('T')[0];
  const uuid = uuidv4().split('-')[0];
  const extension = originalName.split('.').pop();
  return `kyc_${documentType}_${userId}_${timestamp}_${uuid}.${extension}`;
};

// Get Cloudinary folder path
export const getCloudinaryFolder = (userId: string): string => {
  return `vestio/kyc/${userId}`;
};