import { Resend } from 'resend';

let resendClient: Resend;

export const configureResend = (): void => {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not defined in environment variables');
    }

    resendClient = new Resend(apiKey);
    console.log('✅ Resend configured successfully');
  } catch (error) {
    console.error('❌ Resend configuration failed:', error);
    process.exit(1);
  }
};

export const getResendClient = (): Resend => {
  if (!resendClient) {
    throw new Error('Resend client not initialized. Call configureResend() first.');
  }
  return resendClient;
};