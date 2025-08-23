import { Response } from 'express';
import { AuthenticatedRequest } from '../utils/types';
import { Offer } from '../models/Offer';
import { Invoice } from '../models/Invoice';
import { User } from '../models/User';
import { 
  CreateOfferRequest, 
  UpdateOfferRequest,
  AcceptOfferRequest,
  RejectOfferRequest,
  WithdrawOfferRequest,
  OfferDetailedResponse,
  OfferBasicResponse,
  OfferListResponse,
  MarketplaceOfferFilters,
  SellerOfferFilters,
  LenderPortfolioFilters,
  CompetitiveAnalysisResponse,
  OfferRealtimeUpdate,
  MarketplaceNotification,
  MarketplaceOverviewAnalytics
} from '../interfaces/IOffer';
import { InvoiceStatus, UserRole, OfferStatus } from '../interfaces/common';
import { MarketplaceRedisService } from '../services/marketplaceRedisService';
import { InvoiceRedisService } from '../services/invoiceRedisService';
import { EmailService } from '../services/emailService';

export class MarketplaceController {

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Format time until expiry in human-readable format
   */
  private static formatTimeUntilExpiry(expiresAt: Date): string {
    const now = Date.now();
    const expiryTime = new Date(expiresAt).getTime();
    const timeDiff = Math.max(0, expiryTime - now);
    
    if (timeDiff === 0) return 'Expired';
    
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const remainingHours = hours % 24;
      if (remainingHours > 0) {
        return `${days}d ${remainingHours}h`;
      }
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60;
      if (remainingMinutes > 0) {
        return `${hours}h ${remainingMinutes}m`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }

  // ============================================
  // LENDER OPERATIONS - MARKETPLACE BROWSING
  // ============================================

  /**
   * Browse marketplace for available invoices (Lender only)
   */
  static async browseMarketplace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (userRole !== UserRole.LENDER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only lenders can browse the marketplace' 
        });
        return;
      }

      const {
        page = 1,
        limit = 20,
        minAmount,
        maxAmount,
        minDaysUntilDue,
        maxDaysUntilDue,
        anchorId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      }: MarketplaceOfferFilters = req.query as any;

      // Build query for available invoices
      const query: any = { 
        status: InvoiceStatus.LISTED,
        dueDate: { $gt: new Date() } // Not overdue
      };

      if (minAmount || maxAmount) {
        query.amount = {};
        if (minAmount) query.amount.$gte = Number(minAmount);
        if (maxAmount) query.amount.$lte = Number(maxAmount);
      }

      if (anchorId) query.anchorId = anchorId;

      // Date filtering
      if (minDaysUntilDue || maxDaysUntilDue) {
        const now = new Date();
        if (minDaysUntilDue) {
          const minDate = new Date(now.getTime() + Number(minDaysUntilDue) * 24 * 60 * 60 * 1000);
          query.dueDate = { ...query.dueDate, $gte: minDate };
        }
        if (maxDaysUntilDue) {
          const maxDate = new Date(now.getTime() + Number(maxDaysUntilDue) * 24 * 60 * 60 * 1000);
          query.dueDate = { ...query.dueDate, $lte: maxDate };
        }
      }

      // Check cache first
      const cacheKey = JSON.stringify({ query, page, limit, sortBy, sortOrder });
      const cachedListings = await MarketplaceRedisService.getCachedMarketplaceListings({
        page: Number(page),
        limit: Number(limit),
        sortBy,
        sortOrder,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        minDaysUntilDue: minDaysUntilDue ? Number(minDaysUntilDue) : undefined,
        maxDaysUntilDue: maxDaysUntilDue ? Number(maxDaysUntilDue) : undefined,
        anchorId
      });

      if (cachedListings) {
        res.json({
          success: true,
          message: 'Marketplace listings retrieved successfully (cached)',
          data: cachedListings
        });
        return;
      }

      // Pagination
      const skip = (Number(page) - 1) * Number(limit);
      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Get invoices with populated data
      const [invoices, totalCount] = await Promise.all([
        Invoice.find(query)
          .populate('sellerId', 'firstName lastName businessName email')
          .populate('anchorId', 'firstName lastName businessName email')
          .sort(sortOptions)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Invoice.countDocuments(query)
      ]);

      // Get existing offers for each invoice to show competitive info
      const invoiceIds = invoices.map(inv => inv._id);
      const offerCounts = await Promise.all(
        invoiceIds.map(async (invoiceId) => {
          const count = await Offer.countDocuments({
            invoiceId,
            status: OfferStatus.PENDING,
            expiresAt: { $gt: new Date() }
          });
          const bestOffer = await Offer.findOne({
            invoiceId,
            status: OfferStatus.PENDING,
            expiresAt: { $gt: new Date() }
          }).sort({ interestRate: 1 }).lean();

          return {
            invoiceId,
            offerCount: count,
            bestRate: bestOffer?.interestRate || null
          };
        })
      );

      // Format response
      const formattedInvoices = invoices.map((invoice: any) => {
        const offerInfo = offerCounts.find(oc => oc.invoiceId === invoice._id);
        const daysUntilDue = Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        return {
          invoiceId: invoice._id,
          amount: invoice.amount,
          currency: invoice.currency,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          daysUntilDue,
          description: invoice.description,
          seller: {
            name: invoice.sellerId.businessName || `${invoice.sellerId.firstName} ${invoice.sellerId.lastName}`,
            email: invoice.sellerId.email
          },
          anchor: {
            name: invoice.anchorId.businessName || `${invoice.anchorId.firstName} ${invoice.anchorId.lastName}`,
            email: invoice.anchorId.email
          },
          fundingTerms: {
            maxFundingAmount: invoice.marketplaceFundingTerms?.maxFundingAmount || Math.floor(invoice.amount * 0.9),
            recommendedInterestRate: invoice.marketplaceFundingTerms?.recommendedInterestRate || 15,
            maxTenure: invoice.marketplaceFundingTerms?.maxTenure || Math.max(0, daysUntilDue - 14)
          },
          marketplace: {
            listedAt: invoice.listedAt,
            offerCount: offerInfo?.offerCount || 0,
            bestCompetitiveRate: offerInfo?.bestRate,
            hasMyOffer: false // Will be populated separately if needed
          }
        };
      });

      // Check if lender has existing offers on these invoices
      const lenderOffers = await Offer.find({
        lenderId: userId,
        invoiceId: { $in: invoiceIds },
        status: { $in: [OfferStatus.PENDING, OfferStatus.ACCEPTED] }
      }).lean();

      const lenderOfferMap = new Map(lenderOffers.map(offer => [offer.invoiceId, offer]));
      formattedInvoices.forEach(invoice => {
        invoice.marketplace.hasMyOffer = lenderOfferMap.has(invoice.invoiceId);
      });

      const result = {
        invoices: formattedInvoices,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / Number(limit)),
          totalInvoices: totalCount,
          hasNext: skip + Number(limit) < totalCount,
          hasPrev: Number(page) > 1
        }
      };

      // Cache the result
      await MarketplaceRedisService.cacheMarketplaceListings({
        page: Number(page),
        limit: Number(limit),
        sortBy,
        sortOrder,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        minDaysUntilDue: minDaysUntilDue ? Number(minDaysUntilDue) : undefined,
        maxDaysUntilDue: maxDaysUntilDue ? Number(maxDaysUntilDue) : undefined,
        anchorId
      }, [result]);

      // Track marketplace view for first invoice (if any)
      if (formattedInvoices.length > 0 && formattedInvoices[0].invoiceId) {
        await MarketplaceRedisService.trackInvoiceMarketplaceView(formattedInvoices[0].invoiceId, userId);
      }

      res.json({
        success: true,
        message: 'Marketplace listings retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('Failed to browse marketplace:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to browse marketplace',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Get detailed invoice information for marketplace (Lender only)
   */
  static async getMarketplaceInvoiceDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { invoiceId } = req.params;
      
      if (userRole !== UserRole.LENDER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only lenders can view marketplace invoice details' 
        });
        return;
      }

      // Get invoice details
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        status: InvoiceStatus.LISTED
      })
      .populate('sellerId', 'firstName lastName businessName email businessType')
      .populate('anchorId', 'firstName lastName businessName email businessType')
      .lean();

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found or not available in marketplace'
        });
        return;
      }

      // Get competitive analysis
      let competitiveAnalysis = await MarketplaceRedisService.getCachedCompetitiveAnalysis(invoiceId);
      
      if (!competitiveAnalysis) {
        // Generate competitive analysis
        const offers = await Offer.find({
          invoiceId,
          status: OfferStatus.PENDING,
          expiresAt: { $gt: new Date() }
        }).populate('lenderId', 'firstName lastName businessName').lean();

        const analysisData = await Offer.aggregate([
          {
            $match: {
              invoiceId,
              status: OfferStatus.PENDING,
              expiresAt: { $gt: new Date() }
            }
          },
          {
            $group: {
              _id: null,
              totalOffers: { $sum: 1 },
              avgInterestRate: { $avg: '$interestRate' },
              minInterestRate: { $min: '$interestRate' },
              maxInterestRate: { $max: '$interestRate' },
              avgAmount: { $avg: '$amount' },
              maxAmount: { $max: '$amount' },
              minAmount: { $min: '$amount' },
              avgFundingPercentage: { $avg: '$fundingPercentage' },
              maxFundingPercentage: { $max: '$fundingPercentage' }
            }
          }
        ]);
        
        const bestOffers = await Offer.find({
          invoiceId,
          status: OfferStatus.PENDING,
          expiresAt: { $gt: new Date() }
        })
        .sort({ interestRate: 1, amount: -1, createdAt: 1 })
        .limit(5)
        .populate('lenderId', 'firstName lastName businessName email');

        competitiveAnalysis = {
          totalOffers: offers.length,
          statistics: analysisData.length > 0 ? {
            interestRate: {
              min: analysisData[0].minInterestRate,
              max: analysisData[0].maxInterestRate,
              average: analysisData[0].avgInterestRate
            },
            amount: {
              min: analysisData[0].minAmount,
              max: analysisData[0].maxAmount,
              average: analysisData[0].avgAmount
            },
            fundingPercentage: {
              average: analysisData[0].avgFundingPercentage,
              max: analysisData[0].maxFundingPercentage
            }
          } : {
            interestRate: { min: 0, max: 0, average: 0 },
            amount: { min: 0, max: 0, average: 0 },
            fundingPercentage: { average: 0, max: 0 }
          },
          bestOffers: bestOffers.map((offer: any) => ({
            offerId: offer._id,
            lenderId: offer.lenderId._id,
            lenderBusinessName: offer.lenderId.businessName,
            amount: offer.amount,
            interestRate: offer.interestRate,
            fundingPercentage: offer.fundingPercentage,
            tenure: offer.tenure,
            status: offer.status,
            createdAt: offer.createdAt,
            expiresAt: offer.expiresAt,
            isExpired: new Date() > new Date(offer.expiresAt),
            timeUntilExpiry: MarketplaceController.formatTimeUntilExpiry(offer.expiresAt),
            effectiveAnnualRate: (offer.interestRate * 365) / offer.tenure
          }))
        };

        // Cache the analysis
        if (competitiveAnalysis) {
          await MarketplaceRedisService.cacheCompetitiveAnalysis(invoiceId, competitiveAnalysis);
        }
      }

      // Check if lender has existing offer
      const existingOffer = await Offer.findOne({
        invoiceId,
        lenderId: userId,
        status: { $in: [OfferStatus.PENDING, OfferStatus.ACCEPTED] }
      });

      const result = {
        invoice: {
          invoiceId: invoice._id,
          amount: invoice.amount,
          currency: invoice.currency,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          daysUntilDue: Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          description: invoice.description,
          seller: {
            name: (invoice.sellerId as any).businessName || `${(invoice.sellerId as any).firstName} ${(invoice.sellerId as any).lastName}`,
            email: (invoice.sellerId as any).email,
            businessType: (invoice.sellerId as any).businessType
          },
          anchor: {
            name: (invoice.anchorId as any).businessName || `${(invoice.anchorId as any).firstName} ${(invoice.anchorId as any).lastName}`,
            email: (invoice.anchorId as any).email,
            businessType: (invoice.anchorId as any).businessType
          },
          fundingTerms: {
            maxFundingAmount: invoice.marketplaceFundingTerms?.maxFundingAmount || Math.floor(invoice.amount * 0.9),
            recommendedInterestRate: invoice.marketplaceFundingTerms?.recommendedInterestRate || 15,
            maxTenure: invoice.marketplaceFundingTerms?.maxTenure || Math.max(0, Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) - 14)
          },
          listedAt: invoice.listedAt
        },
        competitiveAnalysis,
        myOffer: existingOffer ? {
          offerId: existingOffer._id,
          amount: existingOffer.amount,
          interestRate: existingOffer.interestRate,
          fundingPercentage: existingOffer.fundingPercentage,
          tenure: existingOffer.tenure,
          status: existingOffer.status,
          createdAt: existingOffer.createdAt,
          expiresAt: existingOffer.expiresAt,
          canWithdraw: existingOffer.canBeWithdrawn()
        } : null
      };

      // Track view for trending
      await MarketplaceRedisService.trackInvoiceMarketplaceView(invoiceId, userId);

      res.json({
        success: true,
        message: 'Invoice details retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('Failed to get marketplace invoice details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get invoice details',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ============================================
  // LENDER OPERATIONS - OFFER MANAGEMENT
  // ============================================

  /**
   * Create new offer (Lender only)
   */
  static async createOffer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (userRole !== UserRole.LENDER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only lenders can create offers' 
        });
        return;
      }

      const {
        invoiceId,
        interestRate,
        fundingPercentage,
        tenure,
        terms,
        lenderNotes,
        expiresAt
      }: CreateOfferRequest = req.body;

      // Validate invoice exists and is available
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        status: InvoiceStatus.LISTED
      });

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found or not available for offers'
        });
        return;
      }

      // BUSINESS VALIDATION RULES
      const daysUntilDue = Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const maxAllowedTenure = Math.max(0, daysUntilDue - 14); // 14-day buffer
      
      // Check if invoice has required funding terms (should be set by admin verification)
      if (!invoice.marketplaceFundingTerms?.recommendedInterestRate || !invoice.marketplaceFundingTerms?.maxFundingAmount) {
        res.status(400).json({
          success: false,
          message: 'Invoice funding terms not properly set by admin. Cannot create offers.',
          data: {
            reason: 'Admin must verify invoice with funding terms before offers can be made'
          }
        });
        return;
      }
      
      // 1. Validate Interest Rate (must be exactly the admin's fixed rate)
      if (interestRate !== invoice.marketplaceFundingTerms.recommendedInterestRate) {
        res.status(400).json({
          success: false,
          message: `Interest rate must be exactly ${invoice.marketplaceFundingTerms.recommendedInterestRate}% (admin's fixed rate)`,
          data: {
            yourRate: interestRate,
            requiredRate: invoice.marketplaceFundingTerms.recommendedInterestRate,
            reason: 'Interest rate is fixed by admin - no bidding allowed'
          }
        });
        return;
      }

      // 2. Validate Tenure (cannot exceed daysUntilDue minus 14-day buffer)
      if (tenure > maxAllowedTenure) {
        res.status(400).json({
          success: false,
          message: `Tenure cannot exceed ${maxAllowedTenure} days (${daysUntilDue} days until due minus 14-day collection buffer)`,
          data: {
            yourTenure: tenure,
            maxAllowedTenure,
            daysUntilDue,
            bufferDays: 14,
            reason: 'Lending period must end before invoice due date to allow collection time'
          }
        });
        return;
      }

      // 3. Validate Funding Amount (cannot exceed admin's max funding amount)
      const requestedFundingAmount = (invoice.amount * fundingPercentage) / 100;
      if (requestedFundingAmount > invoice.marketplaceFundingTerms.maxFundingAmount) {
        res.status(400).json({
          success: false,
          message: `Funding amount cannot exceed ₦${invoice.marketplaceFundingTerms.maxFundingAmount.toLocaleString()} (admin's maximum)`,
          data: {
            yourFundingAmount: requestedFundingAmount,
            maxAllowedAmount: invoice.marketplaceFundingTerms.maxFundingAmount,
            yourFundingPercentage: fundingPercentage,
            maxAllowedPercentage: Math.floor((invoice.marketplaceFundingTerms.maxFundingAmount / invoice.amount) * 100),
            reason: 'Admin has set a maximum funding amount for this invoice'
          }
        });
        return;
      }

      // Check if lender already has an active offer
      const existingOffer = await Offer.findOne({
        invoiceId,
        lenderId: userId,
        status: OfferStatus.PENDING,
        expiresAt: { $gt: new Date() }
      });

      if (existingOffer) {
        res.status(400).json({
          success: false,
          message: 'You already have an active offer for this invoice'
        });
        return;
      }

      // Calculate offer amount
      const offerAmount = (invoice.amount * fundingPercentage) / 100;

      // Create offer
      const offer = new Offer({
        invoiceId,
        lenderId: userId,
        amount: offerAmount,
        interestRate,
        fundingPercentage,
        tenure,
        terms,
        lenderNotes,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours default
      });

      await offer.save();

      // Track offer metrics
      await MarketplaceRedisService.trackOfferMetrics(
        offer._id,
        userId,
        invoiceId,
        offerAmount,
        interestRate
      );

      // Track competitive bidding
      await MarketplaceRedisService.trackOfferCompetition(invoiceId, offer._id, interestRate);

      // Track expiration
      await MarketplaceRedisService.trackOfferExpiration(offer._id, offer.expiresAt);

      // Publish real-time update
      const realtimeUpdate: OfferRealtimeUpdate = {
        type: 'offer_created',
        offerId: offer._id,
        invoiceId,
        lenderId: userId,
        sellerId: invoice.sellerId,
        timestamp: new Date(),
        data: {
          amount: offerAmount,
          interestRate,
          fundingPercentage,
          tenure
        }
      };

      await MarketplaceRedisService.publishOfferUpdate(realtimeUpdate);

      // Send notification to seller
      const notification: MarketplaceNotification = {
        type: 'offer_received',
        userId: invoice.sellerId,
        invoiceId,
        offerId: offer._id,
        title: 'New Offer Received',
        message: `You received a new offer of ${interestRate}% interest rate for your invoice ${invoiceId}`,
        timestamp: new Date(),
        metadata: {
          offerAmount,
          interestRate,
          fundingPercentage
        }
      };

      await MarketplaceRedisService.publishMarketplaceNotification(notification);

      // Send email notifications
      try {
        // Get seller and lender details for email
        const [seller, lender] = await Promise.all([
          User.findById(invoice.sellerId),
          User.findById(userId)
        ]);

        if (seller && lender) {
          // Send new offer alert to seller
          await EmailService.sendNewOfferNotification(seller, invoice, offer, lender);

          // Check if seller now has multiple offers and send multiple offers alert
          const totalOffers = await Offer.countDocuments({
            invoiceId,
            status: OfferStatus.PENDING,
            expiresAt: { $gt: new Date() }
          });

          if (totalOffers > 1) {
            await EmailService.sendMultipleOffersAlert(seller, invoice, totalOffers);
          }

          // Check for competitive bidding - send alerts to other lenders with higher rates
          const competingOffers = await Offer.find({
            invoiceId,
            status: OfferStatus.PENDING,
            expiresAt: { $gt: new Date() },
            lenderId: { $ne: userId },
            interestRate: { $gt: interestRate } // Lenders with higher (worse) rates
          }).populate('lenderId');

          // Send competitive alerts to outbid lenders
          for (const competingOffer of competingOffers) {
            const competingLender = competingOffer.lenderId as any;
            if (competingLender && competingLender.email) {
              await EmailService.sendCompetitiveOfferAlert(
                competingLender,
                invoice,
                competingOffer,
                offer
              );
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to send marketplace email notifications:', emailError);
        // Don't fail the offer creation if emails fail
      }

      // Invalidate caches
      await MarketplaceRedisService.invalidateOfferCaches(offer._id, invoiceId, userId);

      // Populate lender info for response
      await offer.populate('lenderId', 'firstName lastName businessName email');

      res.status(201).json({
        success: true,
        message: 'Offer created successfully',
        data: {
          offerId: offer._id,
          invoiceId: offer.invoiceId,
          amount: offer.amount,
          interestRate: offer.interestRate,
          fundingPercentage: offer.fundingPercentage,
          tenure: offer.tenure,
          status: offer.status,
          createdAt: offer.createdAt,
          expiresAt: offer.expiresAt,
          effectiveAnnualRate: offer.effectiveAnnualRate,
          canWithdraw: offer.canBeWithdrawn()
        }
      });

    } catch (error) {
      console.error('Failed to create offer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create offer',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Get lender's offers portfolio
   */
  static async getLenderOffers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (userRole !== UserRole.LENDER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only lenders can view offer portfolio' 
        });
        return;
      }

      const {
        page = 1,
        limit = 20,
        status,
        minAmount,
        maxAmount,
        dateFrom,
        dateTo,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      }: LenderPortfolioFilters = req.query as any;

      // Check cache
      const cacheKey = JSON.stringify({ userId, page, limit, status, minAmount, maxAmount, dateFrom, dateTo, sortBy, sortOrder });
      const cachedOffers = await MarketplaceRedisService.getCachedLenderOffers(userId, cacheKey);

      if (cachedOffers) {
        res.json({
          success: true,
          message: 'Lender offers retrieved successfully (cached)',
          data: cachedOffers
        });
        return;
      }

      // Build query
      const query: any = { lenderId: userId };
      
      if (status) {
        const statusArray = Array.isArray(status) ? status : [status];
        query.status = { $in: statusArray };
      }

      if (minAmount || maxAmount) {
        query.amount = {};
        if (minAmount) query.amount.$gte = Number(minAmount);
        if (maxAmount) query.amount.$lte = Number(maxAmount);
      }

      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(String(dateFrom));
        if (dateTo) query.createdAt.$lte = new Date(String(dateTo));
      }

      // Pagination
      const skip = (Number(page) - 1) * Number(limit);
      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const [offers, totalCount] = await Promise.all([
        Offer.find(query)
          .populate('invoiceId', 'amount currency dueDate description sellerId')
          .populate({
            path: 'invoiceId',
            populate: {
              path: 'sellerId',
              select: 'firstName lastName businessName'
            }
          })
          .sort(sortOptions)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Offer.countDocuments(query)
      ]);

      // Get lender info for display
      const lenderUser = req.user;

      const formattedOffers: OfferBasicResponse[] = offers.map((offer: any) => ({
        offerId: offer._id,
        lenderId: offer.lenderId,
        lenderBusinessName: lenderUser?.businessName,
        amount: offer.amount,
        interestRate: offer.interestRate,
        fundingPercentage: offer.fundingPercentage,
        tenure: offer.tenure,
        status: offer.status,
        createdAt: offer.createdAt,
        expiresAt: offer.expiresAt,
        isExpired: new Date() > new Date(offer.expiresAt),
        timeUntilExpiry: MarketplaceController.formatTimeUntilExpiry(offer.expiresAt),
        effectiveAnnualRate: (offer.interestRate * 365) / offer.tenure
      }));

      const result: OfferListResponse = {
        offers: formattedOffers,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / Number(limit)),
          totalOffers: totalCount,
          hasNext: skip + Number(limit) < totalCount,
          hasPrev: Number(page) > 1
        }
      };

      // Cache result
      await MarketplaceRedisService.cacheLenderOffers(userId, result.offers, cacheKey);

      res.json({
        success: true,
        message: 'Lender offers retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('Failed to get lender offers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get lender offers',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Withdraw offer (Lender only)
   */
  static async withdrawOffer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { offerId } = req.params;
      const { withdrawalReason }: WithdrawOfferRequest = req.body;
      
      if (userRole !== UserRole.LENDER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only lenders can withdraw offers' 
        });
        return;
      }

      const offer = await Offer.findOne({
        _id: offerId,
        lenderId: userId
      }).populate('invoiceId', 'sellerId');

      if (!offer) {
        res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
        return;
      }

      if (!offer.canBeWithdrawn()) {
        res.status(400).json({
          success: false,
          message: 'Offer cannot be withdrawn at this time'
        });
        return;
      }

      // Withdraw offer
      await offer.withdraw(withdrawalReason);

      // Remove from expiration tracking
      await MarketplaceRedisService.removeExpiredOffer(offerId);

      // Publish real-time update
      const invoiceIdString = typeof offer.invoiceId === 'string' ? offer.invoiceId : (offer.invoiceId as any)._id;
      const realtimeUpdate: OfferRealtimeUpdate = {
        type: 'offer_withdrawn',
        offerId,
        invoiceId: invoiceIdString,
        lenderId: userId,
        sellerId: (offer.invoiceId as any).sellerId,
        timestamp: new Date(),
        data: { withdrawalReason }
      };

      await MarketplaceRedisService.publishOfferUpdate(realtimeUpdate);

      // Send email notification
      try {
        // Get seller and lender details
        const [seller, lender, invoice] = await Promise.all([
          User.findById((offer.invoiceId as any).sellerId),
          User.findById(userId),
          Invoice.findById(invoiceIdString)
        ]);

        if (seller && lender && invoice) {
          // Send withdrawal notification to seller
          await EmailService.sendOfferWithdrawnNotification(seller, invoice, offer, lender, withdrawalReason);
        }
      } catch (emailError) {
        console.error('Failed to send withdrawal email notification:', emailError);
        // Don't fail the withdrawal if email fails
      }

      // Invalidate caches
      await MarketplaceRedisService.invalidateOfferCaches(offerId, invoiceIdString, userId);

      res.json({
        success: true,
        message: 'Offer withdrawn successfully',
        data: {
          offerId: offer._id,
          status: offer.status,
          withdrawnAt: offer.withdrawnAt,
          withdrawalReason: offer.withdrawalReason
        }
      });

    } catch (error) {
      console.error('Failed to withdraw offer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to withdraw offer',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ============================================
  // SELLER OPERATIONS - OFFER MANAGEMENT
  // ============================================

  /**
   * Get offers for seller's invoice
   */
  static async getInvoiceOffers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { invoiceId } = req.params;
      
      if (userRole !== UserRole.SELLER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only sellers can view invoice offers' 
        });
        return;
      }

      // Verify invoice ownership
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        sellerId: userId
      });

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found or not owned by you'
        });
        return;
      }

      // Check cache first
      const cachedOffers = await MarketplaceRedisService.getCachedInvoiceOffers(invoiceId);
      
      if (cachedOffers) {
        res.json({
          success: true,
          message: 'Invoice offers retrieved successfully (cached)',
          data: {
            invoiceId,
            offers: cachedOffers,
            totalOffers: cachedOffers.length
          }
        });
        return;
      }

      // Get offers with lender information
      const offers = await Offer.find({
        invoiceId,
        status: { $in: [OfferStatus.PENDING, OfferStatus.ACCEPTED, OfferStatus.REJECTED] }
      })
      .populate('lenderId', 'firstName lastName businessName email businessType')
      .sort({ interestRate: 1, amount: -1, createdAt: 1 }) // Best offers first
      .lean();

      const formattedOffers: OfferBasicResponse[] = offers.map((offer: any) => ({
        offerId: offer._id,
        lenderId: offer.lenderId._id,
        lenderBusinessName: offer.lenderId.businessName,
        amount: offer.amount,
        interestRate: offer.interestRate,
        fundingPercentage: offer.fundingPercentage,
        tenure: offer.tenure,
        status: offer.status,
        createdAt: offer.createdAt,
        expiresAt: offer.expiresAt,
        isExpired: new Date() > new Date(offer.expiresAt),
        timeUntilExpiry: MarketplaceController.formatTimeUntilExpiry(offer.expiresAt),
        effectiveAnnualRate: (offer.interestRate * 365) / offer.tenure
      }));

      // Cache the result
      await MarketplaceRedisService.cacheInvoiceOffers(invoiceId, formattedOffers);

      res.json({
        success: true,
        message: 'Invoice offers retrieved successfully',
        data: {
          invoiceId,
          offers: formattedOffers,
          totalOffers: formattedOffers.length,
          pendingOffers: formattedOffers.filter(o => o.status === OfferStatus.PENDING && !o.isExpired).length,
          bestOffer: formattedOffers.find(o => o.status === OfferStatus.PENDING && !o.isExpired) || null
        }
      });

    } catch (error) {
      console.error('Failed to get invoice offers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get invoice offers',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Accept offer (Seller only)
   */
  static async acceptOffer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { offerId } = req.params;
      const { acceptanceNotes }: AcceptOfferRequest = req.body;
      
      if (userRole !== UserRole.SELLER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only sellers can accept offers' 
        });
        return;
      }

      const offer = await Offer.findById(offerId)
        .populate('invoiceId')
        .populate('lenderId', 'firstName lastName businessName email');

      if (!offer) {
        res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
        return;
      }

      // Verify invoice ownership
      const invoice = offer.invoiceId as any;
      if (invoice.sellerId !== userId) {
        res.status(403).json({
          success: false,
          message: 'You can only accept offers for your own invoices'
        });
        return;
      }

      if (!offer.canBeAccepted()) {
        res.status(400).json({
          success: false,
          message: 'Offer cannot be accepted (may be expired or already processed)'
        });
        return;
      }

      // Accept the offer
      await offer.accept(acceptanceNotes);

      // Extract IDs for type safety
      const lenderIdString = typeof offer.lenderId === 'string' ? offer.lenderId : (offer.lenderId as any)._id;
      const invoiceIdStringFromOffer = typeof offer.invoiceId === 'string' ? offer.invoiceId : (offer.invoiceId as any)._id;

      // Update invoice status to FUNDED
      invoice.status = InvoiceStatus.FUNDED;
      invoice.fundingAmount = offer.amount;
      invoice.interestRate = offer.interestRate;
      invoice.fundedBy = lenderIdString;
      await invoice.save();

      // Reject all other pending offers for this invoice
      await Offer.updateMany(
        {
          invoiceId: invoiceIdStringFromOffer,
          _id: { $ne: offerId },
          status: OfferStatus.PENDING
        },
        {
          status: OfferStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: 'Another offer was accepted'
        }
      );

      // Remove from expiration tracking
      await MarketplaceRedisService.removeExpiredOffer(offerId);

      // Publish real-time updates
      const realtimeUpdate: OfferRealtimeUpdate = {
        type: 'offer_accepted',
        offerId,
        invoiceId: invoice._id,
        lenderId: lenderIdString,
        sellerId: userId,
        timestamp: new Date(),
        data: {
          amount: offer.amount,
          interestRate: offer.interestRate,
          acceptanceNotes
        }
      };

      await MarketplaceRedisService.publishOfferUpdate(realtimeUpdate);

      // Notify lender
      const lenderNotification: MarketplaceNotification = {
        type: 'offer_accepted',
        userId: lenderIdString,
        invoiceId: invoice._id,
        offerId,
        title: 'Offer Accepted!',
        message: `Your offer for invoice ${invoice._id} has been accepted`,
        timestamp: new Date(),
        metadata: {
          invoiceAmount: invoice.amount,
          offerAmount: offer.amount,
          interestRate: offer.interestRate
        }
      };

      await MarketplaceRedisService.publishMarketplaceNotification(lenderNotification);

      // Send email notifications
      try {
        // Get accepted lender details
        const acceptedLender = await User.findById(lenderIdString);
        
        // Get seller info for the email
        const seller = await User.findById(userId);
        
        if (acceptedLender && seller) {
          // Send acceptance notification to the accepted lender
          await EmailService.sendOfferAcceptedNotification(acceptedLender, invoice, offer, seller);
        }

        // Get all rejected lenders and notify them
        const rejectedOffers = await Offer.find({
          invoiceId: invoiceIdStringFromOffer,
          _id: { $ne: offerId },
          status: OfferStatus.REJECTED,
          rejectedAt: { $exists: true },
          rejectionReason: 'Another offer was accepted'
        }).populate('lenderId');

        // Send rejection emails to all auto-rejected lenders
        for (const rejectedOffer of rejectedOffers) {
          const rejectedLender = rejectedOffer.lenderId as any;
          if (rejectedLender && rejectedLender.email) {
            await EmailService.sendOfferRejectedNotification(
              rejectedLender,
              invoice,
              rejectedOffer,
              'Another offer was accepted'
            );
          }
        }
      } catch (emailError) {
        console.error('Failed to send acceptance email notifications:', emailError);
        // Don't fail the acceptance if emails fail
      }

      // Update invoice status in Redis
      await InvoiceRedisService.publishStatusUpdate(invoice._id, {
        type: 'status_update',
        invoiceId: invoice._id,
        oldStatus: InvoiceStatus.LISTED,
        newStatus: InvoiceStatus.FUNDED,
        timestamp: new Date(),
        metadata: {
          fundedBy: lenderIdString,
          fundingAmount: offer.amount,
          interestRate: offer.interestRate
        }
      });

      // Invalidate caches
      await MarketplaceRedisService.invalidateOfferCaches(offerId, invoice._id, lenderIdString);
      await InvoiceRedisService.invalidateInvoiceCaches(invoice._id, userId);

      res.json({
        success: true,
        message: 'Offer accepted successfully',
        data: {
          offer: {
            offerId: offer._id,
            status: offer.status,
            acceptedAt: offer.acceptedAt,
            acceptanceNotes: offer.acceptanceNotes
          },
          invoice: {
            invoiceId: invoice._id,
            status: invoice.status,
            fundingAmount: invoice.fundingAmount,
            interestRate: invoice.interestRate,
            fundedBy: invoice.fundedBy
          }
        }
      });

    } catch (error) {
      console.error('Failed to accept offer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to accept offer',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Reject offer (Seller only)
   */
  static async rejectOffer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { offerId } = req.params;
      const { rejectionReason }: RejectOfferRequest = req.body;
      
      if (userRole !== UserRole.SELLER) {
        res.status(403).json({ 
          success: false, 
          message: 'Only sellers can reject offers' 
        });
        return;
      }

      const offer = await Offer.findById(offerId)
        .populate('invoiceId')
        .populate('lenderId', 'firstName lastName businessName email');

      if (!offer) {
        res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
        return;
      }

      // Verify invoice ownership
      const invoice = offer.invoiceId as any;
      if (invoice.sellerId !== userId) {
        res.status(403).json({
          success: false,
          message: 'You can only reject offers for your own invoices'
        });
        return;
      }

      if (!offer.canBeRejected()) {
        res.status(400).json({
          success: false,
          message: 'Offer cannot be rejected (may be expired or already processed)'
        });
        return;
      }

      // Reject the offer
      await offer.reject(rejectionReason);

      // Remove from expiration tracking
      await MarketplaceRedisService.removeExpiredOffer(offerId);

      // Extract lender ID for type safety
      const lenderIdString = typeof offer.lenderId === 'string' ? offer.lenderId : (offer.lenderId as any)._id;

      // Publish real-time update
      const realtimeUpdate: OfferRealtimeUpdate = {
        type: 'offer_rejected',
        offerId,
        invoiceId: invoice._id,
        lenderId: lenderIdString,
        sellerId: userId,
        timestamp: new Date(),
        data: { rejectionReason }
      };

      await MarketplaceRedisService.publishOfferUpdate(realtimeUpdate);

      // Notify lender
      const lenderNotification: MarketplaceNotification = {
        type: 'offer_rejected',
        userId: lenderIdString,
        invoiceId: invoice._id,
        offerId,
        title: 'Offer Rejected',
        message: `Your offer for invoice ${invoice._id} has been rejected`,
        timestamp: new Date(),
        metadata: {
          rejectionReason
        }
      };

      await MarketplaceRedisService.publishMarketplaceNotification(lenderNotification);

      // Send email notification
      try {
        // Get lender details (already populated above)
        const lender = offer.lenderId as any;
        
        if (lender && lender.email) {
          // Send rejection notification to the lender
          await EmailService.sendOfferRejectedNotification(lender, invoice, offer, rejectionReason);
        }
      } catch (emailError) {
        console.error('Failed to send rejection email notification:', emailError);
        // Don't fail the rejection if email fails
      }

      // Invalidate caches
      await MarketplaceRedisService.invalidateOfferCaches(offerId, invoice._id, lenderIdString);

      res.json({
        success: true,
        message: 'Offer rejected successfully',
        data: {
          offerId: offer._id,
          status: offer.status,
          rejectedAt: offer.rejectedAt,
          rejectionReason: offer.rejectionReason
        }
      });

    } catch (error) {
      console.error('Failed to reject offer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject offer',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  /**
   * Get marketplace overview analytics
   */
  static async getMarketplaceOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;
      
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.LENDER) {
        res.status(403).json({ 
          success: false, 
          message: 'Access denied' 
        });
        return;
      }

      // Check cache
      const cachedAnalytics = await MarketplaceRedisService.getCachedMarketplaceAnalytics('overview');
      
      if (cachedAnalytics) {
        res.json({
          success: true,
          message: 'Marketplace overview retrieved successfully (cached)',
          data: cachedAnalytics
        });
        return;
      }

      // Get marketplace statistics
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const [
        totalActiveListings,
        totalActiveOffers,
        totalVolumeAvailable,
        offerMetrics,
        dailyOfferStats,
        timingAnalytics,
        topLendersData,
        trendingInvoicesWithStats
      ] = await Promise.all([
        // Basic counts
        Invoice.countDocuments({ status: InvoiceStatus.LISTED }),
        Offer.countDocuments({ 
          status: OfferStatus.PENDING,
          expiresAt: { $gt: new Date() }
        }),
        
        // Volume calculations  
        Invoice.aggregate([
          { $match: { status: InvoiceStatus.LISTED } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        
        // Active offer metrics
        Offer.aggregate([
          { 
            $match: { 
              status: OfferStatus.PENDING,
              expiresAt: { $gt: new Date() }
            }
          },
          {
            $group: {
              _id: null,
              totalOfferVolume: { $sum: '$amount' },
              avgInterestRate: { $avg: '$interestRate' },
              avgFundingPercentage: { $avg: '$fundingPercentage' },
              avgTenure: { $avg: '$tenure' }
            }
          }
        ]),
        
        // Daily offer statistics
        Offer.aggregate([
          {
            $facet: {
              dailyNew: [
                { 
                  $match: { 
                    createdAt: { $gte: startOfDay, $lt: endOfDay }
                  }
                },
                { $count: "count" }
              ],
              dailyAccepted: [
                {
                  $match: {
                    status: OfferStatus.ACCEPTED,
                    acceptedAt: { $gte: startOfDay, $lt: endOfDay }
                  }
                },
                { $count: "count" }
              ]
            }
          }
        ]),
        
        // Timing analytics
        Invoice.aggregate([
          {
            $match: {
              status: { $in: [InvoiceStatus.LISTED, InvoiceStatus.FUNDED] },
              listedAt: { $exists: true }
            }
          },
          {
            $lookup: {
              from: 'offers',
              localField: '_id',
              foreignField: 'invoiceId',
              as: 'offers'
            }
          },
          {
            $addFields: {
              firstOffer: { $arrayElemAt: [{ $sortArray: { input: "$offers", sortBy: { createdAt: 1 } } }, 0] },
              acceptedOffer: { $arrayElemAt: [{ $filter: { input: "$offers", cond: { $eq: ["$$this.status", "accepted"] } } }, 0] }
            }
          },
          {
            $addFields: {
              timeToFirstOffer: {
                $cond: {
                  if: "$firstOffer",
                  then: { $subtract: ["$firstOffer.createdAt", "$listedAt"] },
                  else: null
                }
              },
              timeToAcceptance: {
                $cond: {
                  if: "$acceptedOffer",
                  then: { $subtract: ["$acceptedOffer.acceptedAt", "$listedAt"] },
                  else: null
                }
              }
            }
          },
          {
            $group: {
              _id: null,
              avgTimeToFirstOffer: { $avg: "$timeToFirstOffer" },
              avgTimeToAcceptance: { $avg: "$timeToAcceptance" }
            }
          }
        ]),
        
        // Top lenders by offer volume and success rate
        Offer.aggregate([
          {
            $match: {
              createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'lenderId',
              foreignField: '_id',
              as: 'lender'
            }
          },
          { $unwind: '$lender' },
          {
            $group: {
              _id: '$lenderId',
              lenderName: { $first: { $ifNull: ['$lender.businessName', { $concat: ['$lender.firstName', ' ', '$lender.lastName'] }] } },
              totalOffers: { $sum: 1 },
              totalVolume: { $sum: '$amount' },
              acceptedOffers: {
                $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
              },
              avgInterestRate: { $avg: '$interestRate' }
            }
          },
          {
            $addFields: {
              successRate: {
                $multiply: [
                  { $divide: ['$acceptedOffers', '$totalOffers'] },
                  100
                ]
              }
            }
          },
          { $sort: { totalVolume: -1 } },
          { $limit: 5 }
        ]),
        
        // Enhanced trending invoices with offer stats
        Invoice.aggregate([
          { $match: { status: InvoiceStatus.LISTED } },
          {
            $lookup: {
              from: 'offers',
              localField: '_id',
              foreignField: 'invoiceId',
              as: 'offers'
            }
          },
          {
            $addFields: {
              offerCount: { $size: '$offers' },
              activeOffers: {
                $filter: {
                  input: '$offers',
                  cond: { 
                    $and: [
                      { $eq: ['$$this.status', 'pending'] },
                      { $gt: ['$$this.expiresAt', new Date()] }
                    ]
                  }
                }
              }
            }
          },
          {
            $addFields: {
              bestRate: { 
                $ifNull: [
                  { $min: '$activeOffers.interestRate' },
                  0
                ]
              }
            }
          },
          { $sort: { offerCount: -1, createdAt: -1 } },
          { $limit: 5 },
          {
            $project: {
              invoiceId: '$_id',
              offerCount: 1,
              bestRate: 1,
              viewCount: 1 // This would come from Redis tracking
            }
          }
        ])
      ]);

      // Helper function to convert milliseconds to hours
      const msToHours = (ms: number) => ms ? Math.round(ms / (1000 * 60 * 60) * 100) / 100 : 0;

      const analytics: MarketplaceOverviewAnalytics = {
        totalActiveListings,
        totalActiveOffers,
        totalVolumeAvailable: totalVolumeAvailable[0]?.total || 0,
        totalOfferVolume: offerMetrics[0]?.totalOfferVolume || 0,
        averageInterestRate: Math.round((offerMetrics[0]?.avgInterestRate || 0) * 100) / 100,
        averageFundingPercentage: Math.round((offerMetrics[0]?.avgFundingPercentage || 0) * 100) / 100,
        averageTenure: Math.round(offerMetrics[0]?.avgTenure || 0),
        dailyNewOffers: dailyOfferStats[0]?.dailyNew?.[0]?.count || 0,
        dailyAcceptedOffers: dailyOfferStats[0]?.dailyAccepted?.[0]?.count || 0,
        averageTimeToFirstOffer: msToHours(timingAnalytics[0]?.avgTimeToFirstOffer || 0),
        averageTimeToAcceptance: msToHours(timingAnalytics[0]?.avgTimeToAcceptance || 0),
        trendingInvoices: trendingInvoicesWithStats.map(t => ({
          invoiceId: t.invoiceId,
          viewCount: t.viewCount || 0,
          offerCount: t.offerCount || 0,
          bestRate: Math.round((t.bestRate || 0) * 100) / 100
        })),
        topLenders: topLendersData.map(lender => ({
          lenderId: lender._id,
          lenderName: lender.lenderName,
          totalOffers: lender.totalOffers,
          totalVolume: lender.totalVolume,
          successRate: Math.round((lender.successRate || 0) * 100) / 100,
          averageInterestRate: Math.round((lender.avgInterestRate || 0) * 100) / 100
        }))
      };

      // Cache the result
      await MarketplaceRedisService.cacheMarketplaceAnalytics('overview', analytics);

      res.json({
        success: true,
        message: 'Marketplace overview retrieved successfully',
        data: analytics
      });

    } catch (error) {
      console.error('Failed to get marketplace overview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get marketplace overview',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Get competitive analysis for an invoice
   */
  static async getCompetitiveAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;
      const { invoiceId } = req.params;
      
      if (userRole !== UserRole.LENDER && userRole !== UserRole.SELLER && userRole !== UserRole.ADMIN) {
        res.status(403).json({ 
          success: false, 
          message: 'Access denied' 
        });
        return;
      }

      // Check cache first
      const cachedAnalysis = await MarketplaceRedisService.getCachedCompetitiveAnalysis(invoiceId);
      
      if (cachedAnalysis) {
        res.json({
          success: true,
          message: 'Competitive analysis retrieved successfully (cached)',
          data: cachedAnalysis
        });
        return;
      }

      // Verify invoice exists and is in marketplace
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        status: InvoiceStatus.LISTED
      }).lean();

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found or not available in marketplace'
        });
        return;
      }

      // Generate competitive analysis
      const offers = await Offer.find({
        invoiceId,
        status: OfferStatus.PENDING,
        expiresAt: { $gt: new Date() }
      }).populate('lenderId', 'firstName lastName businessName').lean();

      const analysisData = await Offer.aggregate([
        {
          $match: {
            invoiceId,
            status: OfferStatus.PENDING,
            expiresAt: { $gt: new Date() }
          }
        },
        {
          $group: {
            _id: null,
            totalOffers: { $sum: 1 },
            avgInterestRate: { $avg: '$interestRate' },
            minInterestRate: { $min: '$interestRate' },
            maxInterestRate: { $max: '$interestRate' },
            avgAmount: { $avg: '$amount' },
            maxAmount: { $max: '$amount' },
            minAmount: { $min: '$amount' },
            avgFundingPercentage: { $avg: '$fundingPercentage' },
            maxFundingPercentage: { $max: '$fundingPercentage' }
          }
        }
      ]);
      
      const bestOffers = await Offer.find({
        invoiceId,
        status: OfferStatus.PENDING,
        expiresAt: { $gt: new Date() }
      })
      .sort({ interestRate: 1, amount: -1, createdAt: 1 })
      .limit(5)
      .populate('lenderId', 'firstName lastName businessName email');

      const competitiveAnalysis: CompetitiveAnalysisResponse = {
        totalOffers: offers.length,
        statistics: analysisData.length > 0 ? {
          interestRate: {
            min: analysisData[0].minInterestRate,
            max: analysisData[0].maxInterestRate,
            average: analysisData[0].avgInterestRate
          },
          amount: {
            min: analysisData[0].minAmount,
            max: analysisData[0].maxAmount,
            average: analysisData[0].avgAmount
          },
          fundingPercentage: {
            average: analysisData[0].avgFundingPercentage,
            max: analysisData[0].maxFundingPercentage
          }
        } : {
          interestRate: { min: 0, max: 0, average: 0 },
          amount: { min: 0, max: 0, average: 0 },
          fundingPercentage: { average: 0, max: 0 }
        },
        bestOffers: bestOffers.map((offer: any) => ({
          offerId: offer._id,
          lenderId: offer.lenderId._id,
          lenderBusinessName: offer.lenderId.businessName,
          amount: offer.amount,
          interestRate: offer.interestRate,
          fundingPercentage: offer.fundingPercentage,
          tenure: offer.tenure,
          status: offer.status,
          createdAt: offer.createdAt,
          expiresAt: offer.expiresAt,
          isExpired: new Date() > new Date(offer.expiresAt),
          timeUntilExpiry: MarketplaceController.formatTimeUntilExpiry(offer.expiresAt),
          effectiveAnnualRate: (offer.interestRate * 365) / offer.tenure
        }))
      };

      // Check if user has existing offer and calculate market position
      if (userRole === UserRole.LENDER) {
        const existingOffer = await Offer.findOne({
          invoiceId,
          lenderId: req.user?._id,
          status: OfferStatus.PENDING,
          expiresAt: { $gt: new Date() }
        }).lean();

        if (existingOffer) {
          // Calculate market position
          const betterOffers = await Offer.countDocuments({
            invoiceId,
            status: OfferStatus.PENDING,
            expiresAt: { $gt: new Date() },
            $or: [
              { interestRate: { $lt: existingOffer.interestRate } },
              { 
                interestRate: existingOffer.interestRate,
                amount: { $gt: existingOffer.amount }
              }
            ]
          });

          const totalOffers = competitiveAnalysis.totalOffers;
          competitiveAnalysis.marketPosition = {
            betterThanPercent: totalOffers > 1 ? Math.round(((totalOffers - betterOffers - 1) / (totalOffers - 1)) * 100) : 100,
            rank: betterOffers + 1
          };
        }
      }

      // Cache the analysis
      await MarketplaceRedisService.cacheCompetitiveAnalysis(invoiceId, competitiveAnalysis);

      res.json({
        success: true,
        message: 'Competitive analysis retrieved successfully',
        data: competitiveAnalysis
      });

    } catch (error) {
      console.error('Failed to get competitive analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get competitive analysis',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }
}