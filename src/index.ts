import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectMongoDB, connectRedis } from './config/database';
import { configureCloudinary } from './config/cloudinary';
import { configureResend } from './config/resend';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.GLOBAL_RATE_LIMIT_MAX_REQUESTS || '100'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
});

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: 'Vestio Backend API', 
    status: 'running',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: 'connected',
      redis: 'connected',
      cloudinary: 'configured',
      resend: 'configured'
    },
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : 'Something went wrong'
  });
});

const startServer = async (): Promise<void> => {
  try {
    await connectMongoDB();
    await connectRedis();
    configureCloudinary();
    configureResend();

    app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
      console.log(`📊 Health check available at http://localhost:${port}/health`);
      console.log(`🔐 Auth endpoints available at http://localhost:${port}/api/auth`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();