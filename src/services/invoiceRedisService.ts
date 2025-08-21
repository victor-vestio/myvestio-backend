import { redisClient } from '../config/database';
import { InvoiceStatus } from '../interfaces/common';
import { 
  InvoiceBasicResponse, 
  InvoiceDetailedResponse, 
  InvoiceMarketplaceResponse,
  InvoiceStatusUpdate,
  InvoiceSearchFilters,
  MarketplaceFilters 
} from '../interfaces/IInvoice';

export class InvoiceRedisService {
  // Cache TTL constants (in seconds)
  private static readonly INVOICE_DETAIL_TTL = parseInt(process.env.INVOICE_DETAIL_CACHE_TTL || '1800'); // 30 minutes
  private static readonly INVOICE_LIST_TTL = parseInt(process.env.INVOICE_LIST_CACHE_TTL || '600'); // 10 minutes
  private static readonly MARKETPLACE_TTL = parseInt(process.env.MARKETPLACE_CACHE_TTL || '300'); // 5 minutes
  private static readonly SEARCH_RESULTS_TTL = parseInt(process.env.SEARCH_CACHE_TTL || '300'); // 5 minutes
  private static readonly ANALYTICS_TTL = parseInt(process.env.ANALYTICS_CACHE_TTL || '3600'); // 1 hour

  // ============================================
  // INVOICE DETAIL CACHING
  // ============================================

  /**
   * Cache invoice details for quick retrieval
   */
  static async cacheInvoiceDetails(invoiceId: string, invoice: InvoiceDetailedResponse, ttl = this.INVOICE_DETAIL_TTL): Promise<void> {
    try {
      const key = `invoice:details:${invoiceId}`;
      await redisClient.setEx(key, ttl, JSON.stringify(invoice));
      console.log(`📄 Invoice details cached: ${invoiceId}`);
    } catch (error) {
      console.error('Failed to cache invoice details:', error);
    }
  }

  /**
   * Get cached invoice details
   */
  static async getCachedInvoiceDetails(invoiceId: string): Promise<InvoiceDetailedResponse | null> {
    try {
      const key = `invoice:details:${invoiceId}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log(`📄 Invoice details retrieved from cache: ${invoiceId}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached invoice details:', error);
      return null;
    }
  }

  /**
   * Invalidate invoice details cache
   */
  static async invalidateInvoiceDetails(invoiceId: string): Promise<void> {
    try {
      const key = `invoice:details:${invoiceId}`;
      await redisClient.del(key);
      console.log(`📄 Invoice details cache invalidated: ${invoiceId}`);
    } catch (error) {
      console.error('Failed to invalidate invoice details cache:', error);
    }
  }

  // ============================================
  // INVOICE SEARCH CACHING
  // ============================================

  /**
   * Cache invoice search results
   */
  static async cacheSearchResults(
    searchQuery: InvoiceSearchFilters, 
    results: InvoiceBasicResponse[], 
    ttl = this.SEARCH_RESULTS_TTL
  ): Promise<void> {
    try {
      const key = `invoice:search:${Buffer.from(JSON.stringify(searchQuery)).toString('base64')}`;
      await redisClient.setEx(key, ttl, JSON.stringify(results));
      console.log(`🔍 Invoice search results cached: ${results.length} results`);
    } catch (error) {
      console.error('Failed to cache search results:', error);
    }
  }

  /**
   * Get cached search results
   */
  static async getCachedSearchResults(searchQuery: InvoiceSearchFilters): Promise<InvoiceBasicResponse[] | null> {
    try {
      const key = `invoice:search:${Buffer.from(JSON.stringify(searchQuery)).toString('base64')}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log('🔍 Search results retrieved from cache');
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached search results:', error);
      return null;
    }
  }

  // ============================================
  // MARKETPLACE CACHING
  // ============================================

  /**
   * Cache marketplace invoices
   */
  static async cacheMarketplaceInvoices(
    filters: MarketplaceFilters,
    invoices: InvoiceMarketplaceResponse[],
    ttl = this.MARKETPLACE_TTL
  ): Promise<void> {
    try {
      const key = `marketplace:invoices:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
      await redisClient.setEx(key, ttl, JSON.stringify(invoices));
      console.log(`🏪 Marketplace invoices cached: ${invoices.length} invoices`);
    } catch (error) {
      console.error('Failed to cache marketplace invoices:', error);
    }
  }

  /**
   * Get cached marketplace invoices
   */
  static async getCachedMarketplaceInvoices(filters: MarketplaceFilters): Promise<InvoiceMarketplaceResponse[] | null> {
    try {
      const key = `marketplace:invoices:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log('🏪 Marketplace invoices retrieved from cache');
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached marketplace invoices:', error);
      return null;
    }
  }

  /**
   * Cache popular/trending invoices
   */
  static async cachePopularInvoices(invoices: InvoiceMarketplaceResponse[], ttl = 600): Promise<void> {
    try {
      await redisClient.setEx('marketplace:popular', ttl, JSON.stringify(invoices));
      console.log(`🔥 Popular invoices cached: ${invoices.length} invoices`);
    } catch (error) {
      console.error('Failed to cache popular invoices:', error);
    }
  }

  /**
   * Get cached popular invoices
   */
  static async getCachedPopularInvoices(): Promise<InvoiceMarketplaceResponse[] | null> {
    try {
      const cached = await redisClient.get('marketplace:popular');
      if (cached && typeof cached === 'string') {
        console.log('🔥 Popular invoices retrieved from cache');
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached popular invoices:', error);
      return null;
    }
  }

  // ============================================
  // REAL-TIME STATUS UPDATES
  // ============================================

  /**
   * Publish real-time invoice status update
   */
  static async publishStatusUpdate(invoiceId: string, update: InvoiceStatusUpdate): Promise<void> {
    try {
      const channel = `invoice:${invoiceId}:updates`;
      await redisClient.publish(channel, JSON.stringify(update));
      console.log(`🔔 Published invoice update: ${invoiceId}, type: ${update.type}`);
    } catch (error) {
      console.error('Failed to publish status update:', error);
    }
  }

  /**
   * Publish seller notification
   */
  static async publishSellerNotification(sellerId: string, notification: any): Promise<void> {
    try {
      const channel = `seller:${sellerId}:notifications`;
      await redisClient.publish(channel, JSON.stringify(notification));
      console.log(`🔔 Published seller notification: ${sellerId}`);
    } catch (error) {
      console.error('Failed to publish seller notification:', error);
    }
  }

  /**
   * Publish anchor notification
   */
  static async publishAnchorNotification(anchorId: string, notification: any): Promise<void> {
    try {
      const channel = `anchor:${anchorId}:notifications`;
      await redisClient.publish(channel, JSON.stringify(notification));
      console.log(`🔔 Published anchor notification: ${anchorId}`);
    } catch (error) {
      console.error('Failed to publish anchor notification:', error);
    }
  }

  /**
   * Publish marketplace update (new listing, offer, etc.)
   */
  static async publishMarketplaceUpdate(update: any): Promise<void> {
    try {
      await redisClient.publish('marketplace:updates', JSON.stringify(update));
      console.log(`🏪 Published marketplace update: ${update.type}`);
    } catch (error) {
      console.error('Failed to publish marketplace update:', error);
    }
  }

  // ============================================
  // TRENDING & ANALYTICS
  // ============================================

  /**
   * Track invoice view for trending calculations
   */
  static async trackInvoiceView(invoiceId: string): Promise<void> {
    try {
      await redisClient.zIncrBy('trending:invoices', 1, invoiceId);
      await redisClient.expire('trending:invoices', 3600); // 1 hour TTL
      console.log(`📈 Tracked view for invoice: ${invoiceId}`);
    } catch (error) {
      console.error('Failed to track invoice view:', error);
    }
  }

  /**
   * Get trending invoices
   */
  static async getTrendingInvoices(limit = 10): Promise<Array<{ invoiceId: string; viewCount: number }>> {
    try {
      const results = await redisClient.zRangeWithScores('trending:invoices', 0, limit - 1, { REV: true });
      
      // Type guard and cast to expected format
      if (!Array.isArray(results) || results.length === 0) {
        console.log('No trending invoices found');
        return [];
      }
      
      // Cast to the expected Redis response format
      const trendingResults = results as Array<{ value: string; score: number }>;
      
      return trendingResults
        .filter(item => item && typeof item === 'object' && 'value' in item && 'score' in item)
        .map(result => ({
          invoiceId: result.value,
          viewCount: result.score
        }));
    } catch (error) {
      console.error('Failed to get trending invoices:', error);
      return [];
    }
  }

  /**
   * Track invoice metrics for analytics
   */
  static async trackInvoiceSubmission(sellerId: string, anchorId: string, amount: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = redisClient.multi();
      
      // Daily metrics
      pipeline.incr(`invoice:metrics:submissions:${today}`);
      pipeline.incrByFloat(`invoice:metrics:volume:${today}`, amount);
      
      // Seller metrics
      pipeline.incr(`invoice:metrics:seller:${sellerId}:submissions:${today}`);
      pipeline.incrByFloat(`invoice:metrics:seller:${sellerId}:volume:${today}`, amount);
      
      // Anchor metrics
      pipeline.incr(`invoice:metrics:anchor:${anchorId}:submissions:${today}`);
      pipeline.incrByFloat(`invoice:metrics:anchor:${anchorId}:volume:${today}`, amount);
      
      // All-time metrics
      pipeline.incr('invoice:metrics:total_submissions');
      pipeline.incrByFloat('invoice:metrics:total_volume', amount);
      
      await pipeline.exec();
      console.log(`📊 Invoice metrics tracked: ${sellerId} → ${anchorId}, amount: ${amount}`);
    } catch (error) {
      console.error('Failed to track invoice metrics:', error);
    }
  }

  /**
   * Track invoice status change metrics
   */
  static async trackStatusChange(fromStatus: InvoiceStatus, toStatus: InvoiceStatus, invoiceId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = redisClient.multi();
      
      // Status transition tracking
      pipeline.incr(`invoice:metrics:transitions:${fromStatus}_to_${toStatus}:${today}`);
      pipeline.incr(`invoice:metrics:status:${toStatus}:${today}`);
      
      // Processing time tracking (if moving to completed states)
      if (toStatus === InvoiceStatus.ANCHOR_APPROVED || 
          toStatus === InvoiceStatus.ADMIN_VERIFIED || 
          toStatus === InvoiceStatus.FUNDED) {
        const createdTime = await redisClient.hGet(`invoice:timestamps:${invoiceId}`, 'created');
        if (createdTime) {
          const processingTime = Date.now() - parseInt(createdTime);
          pipeline.hSet(`invoice:processing_times:${toStatus}`, invoiceId, processingTime.toString());
        }
      }
      
      await pipeline.exec();
      console.log(`📊 Status change tracked: ${fromStatus} → ${toStatus}`);
    } catch (error) {
      console.error('Failed to track status change:', error);
    }
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  /**
   * Invalidate all caches related to an invoice
   */
  static async invalidateInvoiceCaches(invoiceId: string, sellerId?: string, anchorId?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];
      
      // Invoice detail cache
      keysToDelete.push(`invoice:details:${invoiceId}`);
      
      // Find and delete search caches
      const searchKeys = await this.findCacheKeys('invoice:search:*');
      keysToDelete.push(...searchKeys);
      
      // Find and delete marketplace caches
      const marketplaceKeys = await this.findCacheKeys('marketplace:*');
      keysToDelete.push(...marketplaceKeys);
      
      // User-specific caches
      if (sellerId) {
        const sellerKeys = await this.findCacheKeys(`invoice:seller:${sellerId}:*`);
        keysToDelete.push(...sellerKeys);
      }
      
      if (anchorId) {
        const anchorKeys = await this.findCacheKeys(`invoice:anchor:${anchorId}:*`);
        keysToDelete.push(...anchorKeys);
      }
      
      if (keysToDelete.length > 0) {
        await redisClient.del(keysToDelete);
        console.log(`🧹 Invalidated ${keysToDelete.length} cache keys for invoice: ${invoiceId}`);
      }
    } catch (error) {
      console.error('Failed to invalidate invoice caches:', error);
    }
  }

  /**
   * Invalidate marketplace caches
   */
  static async invalidateMarketplaceCaches(): Promise<void> {
    try {
      const keys = await this.findCacheKeys('marketplace:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`🏪 Invalidated ${keys.length} marketplace cache keys`);
      }
    } catch (error) {
      console.error('Failed to invalidate marketplace caches:', error);
    }
  }

  /**
   * Cache invoice analytics data
   */
  static async cacheAnalytics(key: string, data: any, ttl = this.ANALYTICS_TTL): Promise<void> {
    try {
      await redisClient.setEx(`invoice:analytics:${key}`, ttl, JSON.stringify(data));
      console.log(`📊 Analytics cached: ${key}`);
    } catch (error) {
      console.error('Failed to cache analytics:', error);
    }
  }

  /**
   * Get cached analytics data
   */
  static async getCachedAnalytics(key: string): Promise<any | null> {
    try {
      const cached = await redisClient.get(`invoice:analytics:${key}`);
      if (cached && typeof cached === 'string') {
        console.log(`📊 Analytics retrieved from cache: ${key}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached analytics:', error);
      return null;
    }
  }

  // ============================================
  // DISTRIBUTED LOCKING
  // ============================================

  /**
   * Acquire distributed lock for invoice operations
   */
  static async acquireInvoiceLock(invoiceId: string, operation: string, ttlMs = 5000): Promise<boolean> {
    try {
      const lockKey = `invoice:lock:${invoiceId}:${operation}`;
      const lockValue = Date.now().toString();
      
      const result = await redisClient.set(lockKey, lockValue, {
        PX: ttlMs,
        NX: true
      });
      
      return result === 'OK';
    } catch (error) {
      console.error('Failed to acquire invoice lock:', error);
      return false;
    }
  }

  /**
   * Release distributed lock for invoice operations
   */
  static async releaseInvoiceLock(invoiceId: string, operation: string, lockValue: string): Promise<boolean> {
    try {
      const lockKey = `invoice:lock:${invoiceId}:${operation}`;
      
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
      console.error('Failed to release invoice lock:', error);
      return false;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Find cache keys by pattern (using SCAN for production safety)
   */
  private static async findCacheKeys(pattern: string): Promise<string[]> {
    try {
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== '0');
      
      return keys;
    } catch (error) {
      console.error('Failed to find cache keys:', error);
      return [];
    }
  }

  /**
   * Store invoice timestamps for processing time calculation
   */
  static async storeInvoiceTimestamp(invoiceId: string, event: string): Promise<void> {
    try {
      await redisClient.hSet(`invoice:timestamps:${invoiceId}`, event, Date.now().toString());
    } catch (error) {
      console.error('Failed to store invoice timestamp:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCaches(): Promise<void> {
    try {
      const patterns = [
        'invoice:search:*',
        'marketplace:*',
        'invoice:metrics:*',
        'trending:*'
      ];
      
      let totalCleaned = 0;
      
      for (const pattern of patterns) {
        const keys = await this.findCacheKeys(pattern);
        
        for (const key of keys) {
          const ttl = await redisClient.ttl(key);
          if (ttl === -1) { // No expiration set
            await redisClient.expire(key, 86400); // Set 24-hour expiration
            totalCleaned++;
          }
        }
      }
      
      console.log(`🧹 Cache cleanup completed: ${totalCleaned} keys processed`);
    } catch (error) {
      console.error('Failed to cleanup expired caches:', error);
    }
  }

  /**
   * Generic cache methods for analytics
   */
  static async getCachedData(key: string): Promise<any> {
    try {
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  static async cacheData(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
      console.log(`📦 Cached data with key: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }
}