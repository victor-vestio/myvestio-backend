import mongoose from 'mongoose';
import { createClient } from 'redis';

export const connectMongoDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
    
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    
    redisClient.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
    });

    redisClient.on('disconnect', () => {
      console.log('⚠️ Redis disconnected');
    });

  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    process.exit(1);
  }
};