import { v2 as cloudinary } from 'cloudinary';

export const configureCloudinary = (): void => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing Cloudinary environment variables');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    console.log('✅ Cloudinary configured successfully');
  } catch (error) {
    console.error('❌ Cloudinary configuration failed:', error);
    process.exit(1);
  }
};

export { cloudinary };