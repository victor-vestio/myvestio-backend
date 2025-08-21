import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../interfaces/common';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  submitInvoiceSchema,
  anchorApprovalSchema,
  adminVerificationSchema,
  invoiceSearchSchema,
  marketplaceFiltersSchema,
  bulkStatusUpdateSchema
} from '../utils/validators';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: 'Invalid request data',
        data: { errors }
      });
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: 'Invalid query parameters',
        data: { errors }
      });
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: 'Invalid URL parameters',
        data: { errors }
      });
    }

    req.params = value;
    next();
  };
};

// Export validation middleware functions
export const validateCreateInvoice = validateRequest(createInvoiceSchema);
export const validateUpdateInvoice = validateRequest(updateInvoiceSchema);
export const validateSubmitInvoice = validateRequest(submitInvoiceSchema);
export const validateAnchorApproval = validateRequest(anchorApprovalSchema);
export const validateAdminVerification = validateRequest(adminVerificationSchema);
export const validateInvoiceSearch = validateQuery(invoiceSearchSchema);
export const validateMarketplaceFilters = validateQuery(marketplaceFiltersSchema);
export const validateBulkStatusUpdate = validateRequest(bulkStatusUpdateSchema);