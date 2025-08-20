import { Response } from 'express';
import { AuthenticatedRequest } from '../utils/types';
import { ApiResponse } from '../interfaces/common';
import { KYCRedisService } from '../services/kycRedisService';

export class KYCAnalyticsController {
  
  // Get KYC submission counts for today
  static async getSubmissionCounts(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const counts = await KYCRedisService.getSubmissionCounts();
      
      res.status(200).json({
        success: true,
        message: 'Submission counts retrieved successfully',
        data: {
          readyForReview: counts.readyForReview,
          inProgress: counts.inProgress,
          total: counts.readyForReview + counts.inProgress
        }
      });
      
    } catch (error: any) {
      console.error('Get submission counts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve submission counts',
        error: 'Internal server error'
      });
    }
  }
  
  // Get KYC analytics data
  static async getAnalytics(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const requestedDays = parseInt(req.query.days as string) || 7;
      
      // Validate days parameter (1 to 365 days max)
      const days = Math.min(Math.max(requestedDays, 1), 365);
      
      if (requestedDays !== days) {
        console.warn(`Analytics days clamped: ${requestedDays} → ${days}`);
      }
      
      const analytics = await KYCRedisService.getAnalytics(days);
      
      if (!analytics) {
        res.status(404).json({
          success: false,
          message: 'Analytics data not available',
          error: 'No analytics data found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: analytics
      });
      
    } catch (error: any) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics',
        error: 'Internal server error'
      });
    }
  }
  
  
  // Cache cleanup endpoint (for maintenance)
  static async cleanupCache(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      await KYCRedisService.cleanupCache();
      
      res.status(200).json({
        success: true,
        message: 'Cache cleanup completed successfully'
      });
      
    } catch (error: any) {
      console.error('Cache cleanup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup cache',
        error: 'Internal server error'
      });
    }
  }
}