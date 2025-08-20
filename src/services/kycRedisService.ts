import { redisClient } from '../config/database';
import { KYCStatus, DocumentType } from '../interfaces/common';
import { KYCStatusResponse } from '../interfaces/IKYC';


// KYC Status Update for real-time notifications
export interface KYCStatusUpdate {
  type: 'status_update' | 'document_uploaded' | 'admin_review' | 'approved' | 'rejected';
  status?: KYCStatus;
  message: string;
  timestamp: Date;
  adminNotes?: string;
}

export class KYCRedisService {
  // Cache TTL constants (in seconds) - now using environment variables
  private static readonly KYC_STATUS_TTL = parseInt(process.env.KYC_STATUS_CACHE_TTL || '3600');
  private static readonly REQUIREMENTS_TTL = parseInt(process.env.KYC_REQUIREMENTS_CACHE_TTL || '86400');
  private static readonly ADMIN_QUEUE_TTL = parseInt(process.env.KYC_ADMIN_CACHE_TTL || '1800');
  
  // ============================================
  // KYC STATUS CACHING
  // ============================================
  
  /**
   * Cache KYC status for quick retrieval
   */
  static async cacheKYCStatus(userId: string, status: KYCStatusResponse, ttl = this.KYC_STATUS_TTL): Promise<void> {
    try {
      const key = `kyc:status:${userId}`;
      await redisClient.setEx(key, ttl, JSON.stringify(status));
      console.log(`📄 KYC status cached for user: ${userId}`);
    } catch (error) {
      console.error('Failed to cache KYC status:', error);
    }
  }
  
  /**
   * Get cached KYC status
   */
  static async getCachedKYCStatus(userId: string): Promise<KYCStatusResponse | null> {
    try {
      const key = `kyc:status:${userId}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log(`📄 KYC status retrieved from cache for user: ${userId}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached KYC status:', error);
      return null;
    }
  }
  
  /**
   * Invalidate KYC status cache when status changes
   */
  static async invalidateKYCStatus(userId: string): Promise<void> {
    try {
      const key = `kyc:status:${userId}`;
      await redisClient.del(key);
      console.log(`📄 KYC status cache invalidated for user: ${userId}`);
    } catch (error) {
      console.error('Failed to invalidate KYC status cache:', error);
    }
  }
  
  // ============================================
  // DOCUMENT PROCESSING QUEUE
  // ============================================
  
  
  
  /**
   * Get live pending counts for admin dashboard
   */
  static async getSubmissionCounts(): Promise<{ readyForReview: number; inProgress: number }> {
    try {
      // Get live counts from cache or database
      const cached = await redisClient.get('kyc:live:pending_counts');
      
      if (cached && typeof cached === 'string') {
        console.log('📊 Retrieved live pending counts from cache');
        return JSON.parse(cached);
      }
      
      // If not cached, we'll return basic counts
      // The KYC service will call updateLiveCounts() to refresh
      return { 
        readyForReview: 0, 
        inProgress: 0 
      };
    } catch (error) {
      console.error('Failed to get live pending counts:', error);
      return { readyForReview: 0, inProgress: 0 };
    }
  }

  /**
   * Update live pending counts (called when KYC status changes)
   */
  static async updateLiveCounts(readyForReview: number, inProgress: number): Promise<void> {
    try {
      const counts = { readyForReview, inProgress };
      await redisClient.setEx('kyc:live:pending_counts', 3600, JSON.stringify(counts)); // 1 hour cache
      console.log(`📊 Updated live counts: ${readyForReview} ready, ${inProgress} in progress`);
    } catch (error) {
      console.error('Failed to update live counts:', error);
    }
  }

  /**
   * Track daily submissions (for historical analytics)
   */
  static async trackDailySubmissions(status: 'ready_for_review' | 'in_progress'): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `kyc:daily:${status}:${today}`;
      await redisClient.incr(key);
      // Set TTL to 90 days to prevent memory leaks
      await redisClient.expire(key, 86400 * 90);
      console.log(`📈 Daily submission tracked: ${status}`);
    } catch (error) {
      console.error('Failed to track daily submission:', error);
    }
  }
  
  // ============================================
  // REAL-TIME STATUS UPDATES
  // ============================================
  
  /**
   * Publish real-time KYC status update
   */
  static async publishStatusUpdate(userId: string, update: KYCStatusUpdate): Promise<void> {
    try {
      const channel = `kyc:updates:${userId}`;
      await redisClient.publish(channel, JSON.stringify(update));
      console.log(`🔔 Published KYC update for user: ${userId}, type: ${update.type}`);
    } catch (error) {
      console.error('Failed to publish status update:', error);
    }
  }
  
  /**
   * Publish admin notification for pending KYC
   */
  static async publishAdminNotification(type: 'new_submission' | 'resubmission', userId: string, data: any): Promise<void> {
    try {
      const notification = {
        type,
        userId,
        data,
        timestamp: new Date()
      };
      await redisClient.publish('kyc:admin:notifications', JSON.stringify(notification));
      console.log(`🔔 Published admin notification: ${type} for user: ${userId}`);
    } catch (error) {
      console.error('Failed to publish admin notification:', error);
    }
  }
  
  // ============================================
  // ADMIN DASHBOARD CACHING
  // ============================================
  
  /**
   * Cache pending KYC applications for admin dashboard
   */
  static async cachePendingApplications(applications: any[], ttl = this.ADMIN_QUEUE_TTL): Promise<void> {
    try {
      const key = 'kyc:admin:pending';
      await redisClient.setEx(key, ttl, JSON.stringify(applications));
      console.log(`📊 Cached ${applications.length} pending KYC applications`);
    } catch (error) {
      console.error('Failed to cache pending applications:', error);
    }
  }
  
  /**
   * Get cached pending applications
   */
  static async getCachedPendingApplications(): Promise<any[] | null> {
    try {
      const key = 'kyc:admin:pending';
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log('📊 Retrieved pending applications from cache');
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached pending applications:', error);
      return null;
    }
  }
  
  /**
   * Cache filtered applications with custom key
   */
  static async cacheFilteredApplications(cacheKey: string, data: any, ttl = 600): Promise<void> {
    try {
      await redisClient.setEx(cacheKey, ttl, JSON.stringify(data));
      console.log(`📊 Cached filtered applications: ${cacheKey}`);
    } catch (error) {
      console.error('Failed to cache filtered applications:', error);
    }
  }

  /**
   * Get cached filtered applications
   */
  static async getCachedFilteredApplications(cacheKey: string): Promise<any | null> {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached && typeof cached === 'string') {
        console.log(`📊 Retrieved filtered applications from cache: ${cacheKey}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached filtered applications:', error);
      return null;
    }
  }

  /**
   * Invalidate admin cache when applications change (safe version)
   */
  static async invalidateAdminCache(): Promise<void> {
    try {
      // Use SCAN instead of KEYS to avoid blocking Redis
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: 'kyc:admin:pending*',
          COUNT: 100
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== '0');
      
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`📊 Admin cache invalidated: ${keys.length} keys deleted`);
      }
    } catch (error) {
      console.error('Failed to invalidate admin cache:', error);
    }
  }
  
  // ============================================
  // KYC ANALYTICS & METRICS
  // ============================================
  
  /**
   * Track KYC submission metrics
   */
  static async trackSubmission(userId: string, documentCount: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = redisClient.multi();
      
      // Daily metrics
      pipeline.incr(`kyc:metrics:submissions:${today}`);
      pipeline.incrBy(`kyc:metrics:documents:${today}`, documentCount);
      
      // All-time metrics
      pipeline.incr('kyc:metrics:total_submissions');
      pipeline.incrBy('kyc:metrics:total_documents', documentCount);
      
      // User submission tracking
      pipeline.sAdd('kyc:metrics:submitted_users', userId);
      
      await pipeline.exec();
      console.log(`📈 KYC metrics tracked for user: ${userId}`);
    } catch (error) {
      console.error('Failed to track KYC metrics:', error);
    }
  }
  
  /**
   * Get KYC analytics data
   */
  static async getAnalytics(days = 7): Promise<any> {
    try {
      const dates = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });
      
      const pipeline = redisClient.multi();
      
      // Get daily submissions and documents
      dates.forEach(date => {
        pipeline.get(`kyc:metrics:submissions:${date}`);
        pipeline.get(`kyc:metrics:documents:${date}`);
      });
      
      // Get totals
      pipeline.get('kyc:metrics:total_submissions');
      pipeline.get('kyc:metrics:total_documents');
      pipeline.sCard('kyc:metrics:submitted_users');
      
      const results = await pipeline.exec();
      
      if (!results) {
        return null;
      }
      
      // Helper function to safely extract value from Redis result
      const extractValue = (result: any): string => {
        // node-redis returns direct values, not [error, value] arrays
        return String(result || '0');
      };
      
      const analytics = {
        daily: dates.map((date, i) => ({
          date,
          submissions: parseInt(extractValue(results[i * 2])),
          documents: parseInt(extractValue(results[i * 2 + 1]))
        })),
        totals: {
          submissions: parseInt(extractValue(results[dates.length * 2])),
          documents: parseInt(extractValue(results[dates.length * 2 + 1])),
          uniqueUsers: parseInt(extractValue(results[dates.length * 2 + 2]))
        }
      };
      
      return analytics;
    } catch (error) {
      console.error('Failed to get KYC analytics:', error);
      return null;
    }
  }
  
  // ============================================
  // DISTRIBUTED LOCKING (Cache Stampede Protection)
  // ============================================
  
  /**
   * Acquire distributed lock to prevent cache stampede
   */
  static async acquireLock(lockKey: string, lockValue: string, ttlMs: number): Promise<boolean> {
    try {
      const result = await redisClient.set(lockKey, lockValue, {
        PX: ttlMs,
        NX: true
      });
      return result === 'OK';
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      return false;
    }
  }

  /**
   * Release distributed lock safely
   */
  static async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    try {
      // Lua script to ensure atomic check-and-delete
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await redisClient.eval(luaScript, {
        keys: [lockKey],
        arguments: [lockValue]
      });
      return result === 1;
    } catch (error) {
      console.error('Failed to release lock:', error);
      return false;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  
  /**
   * Cache user's KYC requirements (rarely changes)
   */
  static async cacheUserRequirements(userId: string, requirements: any, ttl = this.REQUIREMENTS_TTL): Promise<void> {
    try {
      const key = `kyc:requirements:${userId}`;
      await redisClient.setEx(key, ttl, JSON.stringify(requirements));
    } catch (error) {
      console.error('Failed to cache user requirements:', error);
    }
  }
  
  /**
   * Get cached user requirements
   */
  static async getCachedUserRequirements(userId: string): Promise<any | null> {
    try {
      const key = `kyc:requirements:${userId}`;
      const cached = await redisClient.get(key);
      return cached && typeof cached === 'string' ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get cached user requirements:', error);
      return null;
    }
  }
  
  /**
   * Migrate old priority keys to new descriptive names
   */
  static async migratePriorityKeys(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get old values
      const [oldHigh, oldNormal] = await Promise.all([
        redisClient.get(`kyc:submissions:high:${today}`),
        redisClient.get(`kyc:submissions:normal:${today}`)
      ]);
      
      // Migrate to new keys if old data exists
      if (oldHigh && Number(oldHigh) > 0) {
        await redisClient.set(`kyc:submissions:ready_for_review:${today}`, oldHigh);
        console.log(`📦 Migrated high priority: ${oldHigh} → ready_for_review`);
      }
      
      if (oldNormal && Number(oldNormal) > 0) {
        await redisClient.set(`kyc:submissions:in_progress:${today}`, oldNormal);
        console.log(`📦 Migrated normal priority: ${oldNormal} → in_progress`);
      }
      
      // Optionally clean up old keys
      if (oldHigh || oldNormal) {
        await Promise.all([
          redisClient.del(`kyc:submissions:high:${today}`),
          redisClient.del(`kyc:submissions:normal:${today}`)
        ]);
        console.log('🧹 Cleaned up old priority keys');
      }
      
    } catch (error) {
      console.error('Failed to migrate priority keys:', error);
    }
  }

  /**
   * Clean up expired cache entries (maintenance)
   */
  static async cleanupCache(): Promise<void> {
    try {
      // First, migrate old keys
      await this.migratePriorityKeys();
      
      // Use SCAN instead of KEYS to avoid blocking Redis
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: 'kyc:*',
          COUNT: 100
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== '0');
      
      let cleaned = 0;
      for (const key of keys) {
        const ttl = await redisClient.ttl(key);
        if (ttl === -1) { // Keys without expiration
          // Set 7-day expiration for keys without TTL (except important metrics)
          if (!key.includes('metrics:total_') && !key.includes('submitted_users')) {
            await redisClient.expire(key, 86400 * 7);
            cleaned++;
          }
        }
      }
      
      console.log(`🧹 Cache cleanup completed, processed ${keys.length} keys, added TTL to ${cleaned} keys`);
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }
}