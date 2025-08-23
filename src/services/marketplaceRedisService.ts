import { redisClient } from '../config/database';
import { OfferStatus } from '../interfaces/common';
import { 
  OfferBasicResponse, 
  OfferDetailedResponse,
  OfferRealtimeUpdate,
  MarketplaceNotification,
  MarketplaceOfferFilters,
  CompetitiveAnalysisResponse,
  LenderOfferAnalytics,
  MarketplaceOverviewAnalytics
} from '../interfaces/IOffer';

export class MarketplaceRedisService {
  // Cache TTL constants (in seconds)
  private static readonly OFFER_DETAIL_TTL = parseInt(process.env.OFFER_DETAIL_CACHE_TTL || '1800'); // 30 minutes
  private static readonly OFFER_LIST_TTL = parseInt(process.env.OFFER_LIST_CACHE_TTL || '600'); // 10 minutes
  private static readonly MARKETPLACE_TTL = parseInt(process.env.MARKETPLACE_CACHE_TTL || '300'); // 5 minutes
  private static readonly ANALYTICS_TTL = parseInt(process.env.MARKETPLACE_ANALYTICS_TTL || '3600'); // 1 hour
  private static readonly COMPETITIVE_ANALYSIS_TTL = parseInt(process.env.COMPETITIVE_ANALYSIS_TTL || '900'); // 15 minutes

  // ============================================
  // OFFER CACHING
  // ============================================

  /**
   * Cache offer details for quick retrieval
   */
  static async cacheOfferDetails(offerId: string, offer: OfferDetailedResponse, ttl = this.OFFER_DETAIL_TTL): Promise<void> {
    try {
      const key = `offer:details:${offerId}`;
      await redisClient.setEx(key, ttl, JSON.stringify(offer));
      console.log(`💰 Offer details cached: ${offerId}`);
    } catch (error) {
      console.error('Failed to cache offer details:', error);
    }
  }

  /**
   * Get cached offer details
   */
  static async getCachedOfferDetails(offerId: string): Promise<OfferDetailedResponse | null> {
    try {
      const key = `offer:details:${offerId}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log(`💰 Offer details retrieved from cache: ${offerId}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached offer details:', error);
      return null;
    }
  }

  /**
   * Cache offers for invoice
   */
  static async cacheInvoiceOffers(invoiceId: string, offers: OfferBasicResponse[], ttl = this.OFFER_LIST_TTL): Promise<void> {
    try {
      const key = `offers:invoice:${invoiceId}`;
      await redisClient.setEx(key, ttl, JSON.stringify(offers));
      console.log(`💰 Invoice offers cached: ${invoiceId}, count: ${offers.length}`);
    } catch (error) {
      console.error('Failed to cache invoice offers:', error);
    }
  }

  /**
   * Get cached offers for invoice
   */
  static async getCachedInvoiceOffers(invoiceId: string): Promise<OfferBasicResponse[] | null> {
    try {
      const key = `offers:invoice:${invoiceId}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log(`💰 Invoice offers retrieved from cache: ${invoiceId}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached invoice offers:', error);
      return null;
    }
  }

  /**
   * Cache lender offers
   */
  static async cacheLenderOffers(lenderId: string, offers: OfferBasicResponse[], filters: string, ttl = this.OFFER_LIST_TTL): Promise<void> {
    try {
      const key = `offers:lender:${lenderId}:${Buffer.from(filters).toString('base64')}`;
      await redisClient.setEx(key, ttl, JSON.stringify(offers));
      console.log(`💰 Lender offers cached: ${lenderId}, count: ${offers.length}`);
    } catch (error) {
      console.error('Failed to cache lender offers:', error);
    }
  }

  /**
   * Get cached lender offers
   */
  static async getCachedLenderOffers(lenderId: string, filters: string): Promise<OfferBasicResponse[] | null> {
    try {
      const key = `offers:lender:${lenderId}:${Buffer.from(filters).toString('base64')}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log(`💰 Lender offers retrieved from cache: ${lenderId}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached lender offers:', error);
      return null;
    }
  }

  // ============================================
  // MARKETPLACE LISTINGS CACHING
  // ============================================

  /**
   * Cache marketplace listings
   */
  static async cacheMarketplaceListings(
    filters: MarketplaceOfferFilters,
    listings: any[],
    ttl = this.MARKETPLACE_TTL
  ): Promise<void> {
    try {
      const key = `marketplace:listings:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
      await redisClient.setEx(key, ttl, JSON.stringify(listings));
      console.log(`🏪 Marketplace listings cached: ${listings.length} items`);
    } catch (error) {
      console.error('Failed to cache marketplace listings:', error);
    }
  }

  /**
   * Get cached marketplace listings
   */
  static async getCachedMarketplaceListings(filters: MarketplaceOfferFilters): Promise<any[] | null> {
    try {
      const key = `marketplace:listings:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log('🏪 Marketplace listings retrieved from cache');
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached marketplace listings:', error);
      return null;
    }
  }

  /**
   * Cache competitive analysis
   */
  static async cacheCompetitiveAnalysis(
    invoiceId: string, 
    analysis: CompetitiveAnalysisResponse, 
    ttl = this.COMPETITIVE_ANALYSIS_TTL
  ): Promise<void> {
    try {
      const key = `competitive:analysis:${invoiceId}`;
      await redisClient.setEx(key, ttl, JSON.stringify(analysis));
      console.log(`📊 Competitive analysis cached: ${invoiceId}`);
    } catch (error) {
      console.error('Failed to cache competitive analysis:', error);
    }
  }

  /**
   * Get cached competitive analysis
   */
  static async getCachedCompetitiveAnalysis(invoiceId: string): Promise<CompetitiveAnalysisResponse | null> {
    try {
      const key = `competitive:analysis:${invoiceId}`;
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        console.log(`📊 Competitive analysis retrieved from cache: ${invoiceId}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached competitive analysis:', error);
      return null;
    }
  }

  // ============================================
  // REAL-TIME OFFER MANAGEMENT
  // ============================================

  /**
   * Publish real-time offer update
   */
  static async publishOfferUpdate(update: OfferRealtimeUpdate): Promise<void> {
    try {
      // Publish to specific offer channel
      const offerChannel = `offer:${update.offerId}:updates`;
      await redisClient.publish(offerChannel, JSON.stringify(update));

      // Publish to invoice channel (for sellers)
      const invoiceChannel = `invoice:${update.invoiceId}:offers`;
      await redisClient.publish(invoiceChannel, JSON.stringify(update));

      // Publish to lender channel
      const lenderChannel = `lender:${update.lenderId}:offers`;
      await redisClient.publish(lenderChannel, JSON.stringify(update));

      // Publish to marketplace channel (for all marketplace listeners)
      await redisClient.publish('marketplace:offers', JSON.stringify(update));

      console.log(`🔔 Published offer update: ${update.type} for offer ${update.offerId}`);
    } catch (error) {
      console.error('Failed to publish offer update:', error);
    }
  }

  /**
   * Publish marketplace notification
   */
  static async publishMarketplaceNotification(notification: MarketplaceNotification): Promise<void> {
    try {
      // User-specific notification
      const userChannel = `user:${notification.userId}:marketplace`;
      await redisClient.publish(userChannel, JSON.stringify(notification));

      // Store notification in user's notification list
      const notificationKey = `notifications:marketplace:${notification.userId}`;
      await redisClient.lPush(notificationKey, JSON.stringify(notification));
      await redisClient.lTrim(notificationKey, 0, 99); // Keep last 100
      await redisClient.expire(notificationKey, 7 * 24 * 60 * 60); // 7 days

      console.log(`🔔 Published marketplace notification: ${notification.type} for user ${notification.userId}`);
    } catch (error) {
      console.error('Failed to publish marketplace notification:', error);
    }
  }

  /**
   * Publish new listing notification
   */
  static async publishNewListing(invoiceId: string, invoiceData: any): Promise<void> {
    try {
      const update = {
        type: 'new_listing' as const,
        invoiceId,
        timestamp: new Date(),
        data: invoiceData
      };

      await redisClient.publish('marketplace:new_listings', JSON.stringify(update));
      console.log(`🏪 Published new listing: ${invoiceId}`);
    } catch (error) {
      console.error('Failed to publish new listing:', error);
    }
  }

  // ============================================
  // COMPETITIVE BIDDING FEATURES
  // ============================================

  /**
   * Track offer competition for an invoice
   */
  static async trackOfferCompetition(invoiceId: string, offerId: string, interestRate: number): Promise<void> {
    try {
      // Add to competitive offers sorted set (sorted by interest rate)
      await redisClient.zAdd(`competition:${invoiceId}`, [
        { score: interestRate, value: offerId }
      ]);
      
      // Set expiration for cleanup
      await redisClient.expire(`competition:${invoiceId}`, 7 * 24 * 60 * 60); // 7 days

      // Update offer count
      await redisClient.incr(`competition:count:${invoiceId}`);
      await redisClient.expire(`competition:count:${invoiceId}`, 7 * 24 * 60 * 60);

      console.log(`🏆 Tracked competitive offer: ${offerId} for invoice ${invoiceId} at ${interestRate}%`);
    } catch (error) {
      console.error('Failed to track offer competition:', error);
    }
  }

  /**
   * Get competitive position for an offer
   */
  static async getCompetitivePosition(invoiceId: string, offerId: string): Promise<{ rank: number; total: number; betterThanPercent: number } | null> {
    try {
      const rank = await redisClient.zRevRank(`competition:${invoiceId}`, offerId);
      const total = await redisClient.zCard(`competition:${invoiceId}`);
      
      if (rank !== null && total > 0) {
        const betterThanPercent = total > 1 ? ((total - rank - 1) / (total - 1)) * 100 : 100;
        return {
          rank: rank + 1, // Convert to 1-based ranking
          total,
          betterThanPercent: Math.round(betterThanPercent)
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get competitive position:', error);
      return null;
    }
  }

  /**
   * Get best competing offers for an invoice
   */
  static async getBestCompetingOffers(invoiceId: string, limit = 5): Promise<Array<{ offerId: string; interestRate: number }>> {
    try {
      const results = await redisClient.zRangeWithScores(`competition:${invoiceId}`, 0, limit - 1);
      
      if (!Array.isArray(results)) return [];
      
      return (results as Array<{ value: string; score: number }>)
        .filter(item => item && typeof item === 'object' && 'value' in item && 'score' in item)
        .map(result => ({
          offerId: result.value,
          interestRate: result.score
        }));
    } catch (error) {
      console.error('Failed to get best competing offers:', error);
      return [];
    }
  }

  // ============================================
  // MARKETPLACE ANALYTICS & TRENDING
  // ============================================

  /**
   * Track invoice view for marketplace trending
   */
  static async trackInvoiceMarketplaceView(invoiceId: string, lenderId?: string): Promise<void> {
    try {
      // Validate required parameters
      if (!invoiceId || typeof invoiceId !== 'string') {
        console.warn('Invalid invoiceId provided to trackInvoiceMarketplaceView:', invoiceId);
        return;
      }

      // Track overall views
      await redisClient.zIncrBy('marketplace:trending:invoices', 1, invoiceId);
      await redisClient.expire('marketplace:trending:invoices', 4 * 60 * 60); // 4 hours

      // Track daily views
      const today = new Date().toISOString().split('T')[0];
      await redisClient.zIncrBy(`marketplace:trending:${today}`, 1, invoiceId);
      await redisClient.expire(`marketplace:trending:${today}`, 24 * 60 * 60);

      // Track lender interest if provided
      if (lenderId && typeof lenderId === 'string') {
        await redisClient.incr(`marketplace:interest:${invoiceId}:${lenderId}`);
        await redisClient.expire(`marketplace:interest:${invoiceId}:${lenderId}`, 7 * 24 * 60 * 60);
      }

      console.log(`📈 Tracked marketplace view for invoice: ${invoiceId}`);
    } catch (error) {
      console.error('Failed to track marketplace view:', error);
    }
  }

  /**
   * Get trending marketplace invoices
   */
  static async getTrendingMarketplaceInvoices(limit = 10): Promise<Array<{ invoiceId: string; viewCount: number }>> {
    try {
      const results = await redisClient.zRangeWithScores('marketplace:trending:invoices', 0, limit - 1, { REV: true });
      
      if (!Array.isArray(results)) return [];
      
      return (results as Array<{ value: string; score: number }>)
        .filter(item => item && typeof item === 'object' && 'value' in item && 'score' in item)
        .map(result => ({
          invoiceId: result.value,
          viewCount: result.score
        }));
    } catch (error) {
      console.error('Failed to get trending marketplace invoices:', error);
      return [];
    }
  }

  /**
   * Track offer metrics
   */
  static async trackOfferMetrics(offerId: string, lenderId: string, invoiceId: string, amount: number, interestRate: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = redisClient.multi();
      
      // Daily marketplace metrics
      pipeline.incr(`marketplace:metrics:offers:${today}`);
      pipeline.incrByFloat(`marketplace:metrics:volume:${today}`, amount);
      
      // Lender metrics
      pipeline.incr(`marketplace:lender:${lenderId}:offers:${today}`);
      pipeline.incrByFloat(`marketplace:lender:${lenderId}:volume:${today}`, amount);
      
      // Interest rate tracking
      pipeline.lPush(`marketplace:rates:${today}`, interestRate.toString());
      pipeline.lTrim(`marketplace:rates:${today}`, 0, 999); // Keep last 1000
      pipeline.expire(`marketplace:rates:${today}`, 24 * 60 * 60);
      
      // Overall metrics
      pipeline.incr('marketplace:metrics:total_offers');
      pipeline.incrByFloat('marketplace:metrics:total_volume', amount);
      
      await pipeline.exec();
      console.log(`📊 Offer metrics tracked: ${offerId}, lender: ${lenderId}, amount: ${amount}`);
    } catch (error) {
      console.error('Failed to track offer metrics:', error);
    }
  }

  // ============================================
  // OFFER EXPIRATION MANAGEMENT
  // ============================================

  /**
   * Track offer expiration
   */
  static async trackOfferExpiration(offerId: string, expiresAt: Date): Promise<void> {
    try {
      const timestamp = Math.floor(expiresAt.getTime() / 1000);
      await redisClient.zAdd('offers:expiring', [{ score: timestamp, value: offerId }]);
      console.log(`⏰ Tracked offer expiration: ${offerId} expires at ${expiresAt.toISOString()}`);
    } catch (error) {
      console.error('Failed to track offer expiration:', error);
    }
  }

  /**
   * Get offers expiring soon
   */
  static async getOffersExpiringSoon(withinMinutes = 60): Promise<string[]> {
    try {
      const now = Date.now();
      const futureTime = now + (withinMinutes * 60 * 1000);
      
      const results = await redisClient.zRangeByScore('offers:expiring', 
        Math.floor(now / 1000), 
        Math.floor(futureTime / 1000)
      );
      
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.error('Failed to get offers expiring soon:', error);
      return [];
    }
  }

  /**
   * Remove expired offer from tracking
   */
  static async removeExpiredOffer(offerId: string): Promise<void> {
    try {
      await redisClient.zRem('offers:expiring', offerId);
      console.log(`⏰ Removed expired offer from tracking: ${offerId}`);
    } catch (error) {
      console.error('Failed to remove expired offer:', error);
    }
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  /**
   * Invalidate all caches related to an offer
   */
  static async invalidateOfferCaches(offerId: string, invoiceId?: string, lenderId?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];
      
      // Offer detail cache
      keysToDelete.push(`offer:details:${offerId}`);
      
      // Invoice offers cache
      if (invoiceId) {
        keysToDelete.push(`offers:invoice:${invoiceId}`);
        keysToDelete.push(`competitive:analysis:${invoiceId}`);
      }
      
      // Lender offers cache
      if (lenderId) {
        const lenderKeys = await this.findCacheKeys(`offers:lender:${lenderId}:*`);
        keysToDelete.push(...lenderKeys);
      }
      
      // Marketplace listings cache
      const marketplaceKeys = await this.findCacheKeys('marketplace:listings:*');
      keysToDelete.push(...marketplaceKeys);
      
      if (keysToDelete.length > 0) {
        await redisClient.del(keysToDelete);
        console.log(`🧹 Invalidated ${keysToDelete.length} cache keys for offer: ${offerId}`);
      }
    } catch (error) {
      console.error('Failed to invalidate offer caches:', error);
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

  // ============================================
  // ANALYTICS CACHING
  // ============================================

  /**
   * Cache marketplace analytics
   */
  static async cacheMarketplaceAnalytics(key: string, data: any, ttl = this.ANALYTICS_TTL): Promise<void> {
    try {
      await redisClient.setEx(`marketplace:analytics:${key}`, ttl, JSON.stringify(data));
      console.log(`📊 Marketplace analytics cached: ${key}`);
    } catch (error) {
      console.error('Failed to cache marketplace analytics:', error);
    }
  }

  /**
   * Get cached marketplace analytics
   */
  static async getCachedMarketplaceAnalytics(key: string): Promise<any | null> {
    try {
      const cached = await redisClient.get(`marketplace:analytics:${key}`);
      if (cached && typeof cached === 'string') {
        console.log(`📊 Marketplace analytics retrieved from cache: ${key}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached marketplace analytics:', error);
      return null;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Find cache keys by pattern
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
   * Generic cache methods
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
      console.log(`📦 Cached marketplace data with key: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      console.error('Failed to cache marketplace data:', error);
    }
  }
}