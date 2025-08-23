import Joi from 'joi';
import { UserRole, BusinessType, DocumentType } from '../interfaces/common';

// Auth validation schemas
export const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
  
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters',
      'string.pattern.base': 'First name can only contain letters and spaces',
      'any.required': 'First name is required'
    }),
  
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters',
      'string.pattern.base': 'Last name can only contain letters and spaces',
      'any.required': 'Last name is required'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[\d\s-()]{10,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'Phone number is required'
    }),
  
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      'any.only': 'Role must be one of: seller, lender, anchor',
      'any.required': 'Role is required'
    }),
  
  businessType: Joi.string()
    .when('role', [
      {
        is: UserRole.LENDER,
        then: Joi.required().valid(...Object.values(BusinessType)).messages({
          'any.required': 'Business type is required for lenders',
          'any.only': 'Lenders must choose either individual or company'
        })
      },
      {
        is: UserRole.SELLER, 
        then: Joi.required().valid(BusinessType.COMPANY).messages({
          'any.required': 'Business type is required for sellers',
          'any.only': 'Sellers must be registered as companies'
        })
      },
      {
        is: UserRole.ANCHOR,
        then: Joi.required().valid(BusinessType.COMPANY).messages({
          'any.required': 'Business type is required for anchors', 
          'any.only': 'Anchors must be registered as companies'
        })
      }
    ]),
  
  businessName: Joi.string()
    .trim()
    .max(100)
    .when('role', [
      {
        is: UserRole.SELLER,
        then: Joi.required().messages({
          'any.required': 'Business name is required for sellers'
        })
      },
      {
        is: UserRole.ANCHOR, 
        then: Joi.required().messages({
          'any.required': 'Business name is required for anchors'
        })
      },
      {
        is: UserRole.LENDER,
        then: Joi.when('businessType', {
          is: BusinessType.COMPANY,
          then: Joi.required().messages({
            'any.required': 'Business name is required for company lenders'
          }),
          otherwise: Joi.optional()
        })
      }
    ])
    .messages({
      'string.max': 'Business name cannot exceed 100 characters'
    })
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    }),
  
  twoFactorCode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .optional()
    .messages({
      'string.length': '2FA code must be 6 digits',
      'string.pattern.base': '2FA code must contain only numbers'
    })
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .optional()
    .messages({
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters',
      'string.pattern.base': 'First name can only contain letters and spaces'
    }),
  
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .optional()
    .messages({
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters',
      'string.pattern.base': 'Last name can only contain letters and spaces'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[\d\s-()]{10,}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  
  businessName: Joi.string()
    .trim()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Business name cannot exceed 100 characters'
    })
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'New password is required'
    })
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Reset token is required'
    }),
  
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    })
});

export const verifyEmailSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Verification token is required'
    })
});

export const verify2FASchema = Joi.object({
  token: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.length': '2FA code must be 6 digits',
      'string.pattern.base': '2FA code must contain only numbers',
      'any.required': '2FA code is required'
    })
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required'
    })
});

export const verifyEmailOTPSchema = Joi.object({
  loginToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Login token is required'
    }),
  
  emailOTP: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.length': 'Email OTP must be 6 digits',
      'string.pattern.base': 'Email OTP must contain only numbers',
      'any.required': 'Email OTP is required'
    })
});

export const verifyTwoFASchema = Joi.object({
  twoFAToken: Joi.string()
    .required()
    .messages({
      'any.required': '2FA token is required'
    }),
  
  twoFACode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.length': '2FA code must be 6 digits',
      'string.pattern.base': '2FA code must contain only numbers',
      'any.required': '2FA code is required'
    })
});

// KYC validation schemas
export const submitKYCSchema = Joi.object({
  documentTypes: Joi.array()
    .items(Joi.string().valid(...Object.values(DocumentType)))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one document is required',
      'any.required': 'Document types are required',
      'any.only': 'Invalid document type'
    }),
  
  bankDetails: Joi.object({
    accountNumber: Joi.string()
      .trim()
      .min(10)
      .max(20)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.min': 'Account number must be at least 10 digits',
        'string.max': 'Account number cannot exceed 20 digits',
        'string.pattern.base': 'Account number must contain only numbers',
        'any.required': 'Account number is required'
      }),
    
    bankName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Bank name must be at least 2 characters',
        'string.max': 'Bank name cannot exceed 100 characters',
        'any.required': 'Bank name is required'
      }),
    
    accountName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Account name must be at least 2 characters',
        'string.max': 'Account name cannot exceed 100 characters',
        'any.required': 'Account name is required'
      }),
    
    bvn: Joi.string()
      .trim()
      .length(11)
      .pattern(/^[0-9]+$/)
      .optional()
      .messages({
        'string.length': 'BVN must be exactly 11 digits',
        'string.pattern.base': 'BVN must contain only numbers'
      })
  }).optional(),
  
  dateOfBirth: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': 'Date of birth must be a valid date'
    })
});

export const updateKYCSchema = Joi.object({
  documentTypes: Joi.array()
    .items(Joi.string().valid(...Object.values(DocumentType)))
    .optional(),
  
  bankDetails: Joi.object({
    accountNumber: Joi.string()
      .trim()
      .min(10)
      .max(20)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.min': 'Account number must be at least 10 digits',
        'string.max': 'Account number cannot exceed 20 digits',
        'string.pattern.base': 'Account number must contain only numbers',
        'any.required': 'Account number is required'
      }),
    
    bankName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Bank name must be at least 2 characters',
        'string.max': 'Bank name cannot exceed 100 characters',
        'any.required': 'Bank name is required'
      }),
    
    accountName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Account name must be at least 2 characters',
        'string.max': 'Account name cannot exceed 100 characters',
        'any.required': 'Account name is required'
      }),
    
    bvn: Joi.string()
      .trim()
      .length(11)
      .pattern(/^[0-9]+$/)
      .optional()
      .messages({
        'string.length': 'BVN must be exactly 11 digits',
        'string.pattern.base': 'BVN must contain only numbers'
      })
  }).optional(),
  
  dateOfBirth: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': 'Date of birth must be a valid date'
    })
});

export const approveKYCSchema = Joi.object({
  approvalNotes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Approval notes cannot exceed 500 characters'
    })
});

export const rejectKYCSchema = Joi.object({
  rejectionReason: Joi.string()
    .trim()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'Rejection reason must be at least 10 characters',
      'string.max': 'Rejection reason cannot exceed 500 characters',
      'any.required': 'Rejection reason is required'
    })
});

// ============================================
// INVOICE VALIDATION SCHEMAS
// ============================================

export const createInvoiceSchema = Joi.object({
  anchorId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .messages({
      'string.pattern.base': 'Invalid anchor ID format - must be a valid UUID'
    }),
  
  amount: Joi.number()
    .positive()
    .precision(2)
    .max(10000000)
    .required()
    .messages({
      'number.positive': 'Amount must be positive',
      'number.max': 'Amount cannot exceed 10,000,000'
    }),
  
  currency: Joi.string()
    .valid('NGN')
    .default('NGN')
    .optional()
    .messages({
      'any.only': 'Currency must be NGN'
    }),
  
  issueDate: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.max': 'Issue date cannot be in the future'
    }),
  
  dueDate: Joi.date()
    .greater(Joi.ref('issueDate'))
    .required()
    .messages({
      'date.greater': 'Due date must be after issue date'
    }),
  
  description: Joi.string()
    .min(10)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 1000 characters'
    })
});

export const updateInvoiceSchema = Joi.object({
  anchorId: Joi.string()
    .pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .messages({
      'string.pattern.base': 'Invalid anchor ID format - must be a valid UUID'
    }),
  
  amount: Joi.number()
    .positive()
    .precision(2)
    .max(10000000)
    .messages({
      'number.positive': 'Amount must be positive',
      'number.max': 'Amount cannot exceed 10,000,000'
    }),
  
  currency: Joi.string()
    .valid('NGN', 'USD', 'EUR', 'GBP')
    .messages({
      'any.only': 'Currency must be one of NGN, USD, EUR, GBP'
    }),
  
  issueDate: Joi.date()
    .max('now')
    .messages({
      'date.max': 'Issue date cannot be in the future'
    }),
  
  dueDate: Joi.date()
    .when('issueDate', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('issueDate')),
      otherwise: Joi.date()
    })
    .messages({
      'date.greater': 'Due date must be after issue date'
    }),
  
  description: Joi.string()
    .min(10)
    .max(1000)
    .messages({
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 1000 characters'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const submitInvoiceSchema = Joi.object({
  finalNotes: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Final notes cannot exceed 500 characters'
    })
});

export const anchorApprovalSchema = Joi.object({
  action: Joi.string()
    .valid('approve', 'reject')
    .required()
    .messages({
      'any.only': 'Action must be either approve or reject'
    }),
  
  notes: Joi.string()
    .max(1000)
    .allow('')
    .when('action', {
      is: 'reject',
      then: Joi.string().min(10).required(),
      otherwise: Joi.string()
    })
    .messages({
      'string.min': 'Rejection reason must be at least 10 characters',
      'string.max': 'Notes cannot exceed 1000 characters'
    })
});

export const adminVerificationSchema = Joi.object({
  action: Joi.string()
    .valid('verify', 'reject')
    .required()
    .messages({
      'any.only': 'Action must be either verify or reject'
    }),
  
  notes: Joi.string()
    .max(1000)
    .allow('')
    .when('action', {
      is: 'reject',
      then: Joi.string().min(10).required(),
      otherwise: Joi.string()
    })
    .messages({
      'string.min': 'Rejection reason must be at least 10 characters',
      'string.max': 'Notes cannot exceed 1000 characters'
    }),
  
  verificationDetails: Joi.object({
    documentsVerified: Joi.boolean()
      .required(),
    
    complianceChecked: Joi.boolean()
      .required(),
    
    riskAssessment: Joi.string()
      .valid('low', 'medium', 'high')
      .messages({
        'any.only': 'Risk assessment must be low, medium, or high'
      })
  }).when('action', {
    is: 'verify',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),

  fundingTerms: Joi.object({
    maxFundingAmount: Joi.number()
      .positive()
      .required()
      .messages({
        'number.positive': 'Maximum funding amount must be positive'
      }),
    
    recommendedInterestRate: Joi.number()
      .min(0)
      .max(50)
      .required()
      .messages({
        'number.min': 'Interest rate must be at least 0%',
        'number.max': 'Interest rate cannot exceed 50%'
      }),
    
    maxTenure: Joi.number()
      .integer()
      .min(1)
      .max(365)
      .messages({
        'number.integer': 'Maximum tenure must be a whole number of days',
        'number.min': 'Maximum tenure must be at least 1 day',
        'number.max': 'Maximum tenure cannot exceed 365 days'
      })
  }).when('action', {
    is: 'verify',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  })
});

export const invoiceSearchSchema = Joi.object({
  status: Joi.alternatives().try(
    Joi.string().valid('draft', 'submitted', 'anchor_approved', 'admin_verified', 'listed', 'funded', 'repaid', 'settled', 'rejected'),
    Joi.array().items(Joi.string().valid('draft', 'submitted', 'anchor_approved', 'admin_verified', 'listed', 'funded', 'repaid', 'settled', 'rejected'))
  ),
  
  sellerId: Joi.string().pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  anchorId: Joi.string().pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  fundedBy: Joi.string().pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  
  minAmount: Joi.number().positive(),
  maxAmount: Joi.number().positive().greater(Joi.ref('minAmount')),
  currency: Joi.string().valid('NGN'),
  
  dateFrom: Joi.date(),
  dateTo: Joi.date().greater(Joi.ref('dateFrom')),
  dueDateFrom: Joi.date(),
  dueDateTo: Joi.date().greater(Joi.ref('dueDateFrom')),
  
  search: Joi.string().min(3).max(100),
  
  sortBy: Joi.string().valid('createdAt', 'amount', 'dueDate', 'submittedAt', 'approvedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

export const invoiceMarketplaceFiltersSchema = Joi.object({
  minAmount: Joi.number().positive(),
  maxAmount: Joi.number().positive().greater(Joi.ref('minAmount')),
  anchorId: Joi.string().pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  maxDaysUntilDue: Joi.number().integer().positive(),
  
  sortBy: Joi.string().valid('listedAt', 'amount', 'dueDate', 'offerCount').default('listedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

export const bulkStatusUpdateSchema = Joi.object({
  invoiceIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one invoice ID is required',
      'array.max': 'Cannot update more than 100 invoices at once'
    }),
  
  newStatus: Joi.string()
    .valid('admin_verified', 'listed', 'rejected')
    .required(),
  
  notes: Joi.string()
    .max(500)
    .allow('')
});

// ============================================
// MARKETPLACE VALIDATION SCHEMAS
// ============================================

export const createOfferSchema = Joi.object({
  invoiceId: Joi.string()
    .pattern(/^INV-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid invoice ID format',
      'any.required': 'Invoice ID is required'
    }),
  
  amount: Joi.number()
    .positive()
    .optional()
    .messages({
      'number.positive': 'Amount must be positive'
    }),
  
  interestRate: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .required()
    .messages({
      'number.min': 'Interest rate must be non-negative',
      'number.max': 'Interest rate cannot exceed 100%',
      'any.required': 'Interest rate is required'
    }),
  
  fundingPercentage: Joi.number()
    .min(1)
    .max(100)
    .precision(2)
    .required()
    .messages({
      'number.min': 'Funding percentage must be at least 1%',
      'number.max': 'Funding percentage cannot exceed 100%',
      'any.required': 'Funding percentage is required'
    }),
  
  tenure: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .required()
    .messages({
      'number.integer': 'Tenure must be a whole number of days',
      'number.min': 'Tenure must be at least 1 day',
      'number.max': 'Tenure cannot exceed 365 days',
      'any.required': 'Tenure is required'
    }),
  
  terms: Joi.string()
    .max(2000)
    .allow('')
    .messages({
      'string.max': 'Terms cannot exceed 2000 characters'
    }),
  
  lenderNotes: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Lender notes cannot exceed 1000 characters'
    }),
  
  expiresAt: Joi.date()
    .greater('now')
    .messages({
      'date.greater': 'Expiration date must be in the future'
    })
});

export const updateOfferSchema = Joi.object({
  interestRate: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .messages({
      'number.min': 'Interest rate must be non-negative',
      'number.max': 'Interest rate cannot exceed 100%'
    }),
  
  fundingPercentage: Joi.number()
    .min(1)
    .max(100)
    .precision(2)
    .messages({
      'number.min': 'Funding percentage must be at least 1%',
      'number.max': 'Funding percentage cannot exceed 100%'
    }),
  
  tenure: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .messages({
      'number.integer': 'Tenure must be a whole number of days',
      'number.min': 'Tenure must be at least 1 day',
      'number.max': 'Tenure cannot exceed 365 days'
    }),
  
  terms: Joi.string()
    .max(2000)
    .allow('')
    .messages({
      'string.max': 'Terms cannot exceed 2000 characters'
    }),
  
  lenderNotes: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Lender notes cannot exceed 1000 characters'
    }),
  
  expiresAt: Joi.date()
    .greater('now')
    .messages({
      'date.greater': 'Expiration date must be in the future'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const acceptOfferSchema = Joi.object({
  acceptanceNotes: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Acceptance notes cannot exceed 500 characters'
    })
});

export const rejectOfferSchema = Joi.object({
  rejectionReason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'Rejection reason must be at least 10 characters',
      'string.max': 'Rejection reason cannot exceed 500 characters',
      'any.required': 'Rejection reason is required'
    })
});

export const withdrawOfferSchema = Joi.object({
  withdrawalReason: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Withdrawal reason cannot exceed 500 characters'
    })
});

export const createCounterOfferSchema = Joi.object({
  originalOfferId: Joi.string()
    .pattern(/^OFF-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid offer ID format',
      'any.required': 'Original offer ID is required'
    }),
  
  interestRate: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .required()
    .messages({
      'number.min': 'Interest rate must be non-negative',
      'number.max': 'Interest rate cannot exceed 100%',
      'any.required': 'Interest rate is required'
    }),
  
  fundingPercentage: Joi.number()
    .min(1)
    .max(100)
    .precision(2)
    .required()
    .messages({
      'number.min': 'Funding percentage must be at least 1%',
      'number.max': 'Funding percentage cannot exceed 100%',
      'any.required': 'Funding percentage is required'
    }),
  
  tenure: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .required()
    .messages({
      'number.integer': 'Tenure must be a whole number of days',
      'number.min': 'Tenure must be at least 1 day',
      'number.max': 'Tenure cannot exceed 365 days',
      'any.required': 'Tenure is required'
    }),
  
  terms: Joi.string()
    .max(2000)
    .allow('')
    .messages({
      'string.max': 'Terms cannot exceed 2000 characters'
    }),
  
  lenderNotes: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Lender notes cannot exceed 1000 characters'
    })
});

export const marketplaceFiltersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  
  // Invoice filters
  minAmount: Joi.number().positive(),
  maxAmount: Joi.number().positive().greater(Joi.ref('minAmount')),
  minDaysUntilDue: Joi.number().integer().positive(),
  maxDaysUntilDue: Joi.number().integer().positive().greater(Joi.ref('minDaysUntilDue')),
  anchorId: Joi.string().pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  
  // Offer filters
  minInterestRate: Joi.number().min(0).max(100),
  maxInterestRate: Joi.number().min(0).max(100).greater(Joi.ref('minInterestRate')),
  minFundingPercentage: Joi.number().min(1).max(100),
  maxFundingPercentage: Joi.number().min(1).max(100).greater(Joi.ref('minFundingPercentage')),
  minTenure: Joi.number().integer().min(1).max(365),
  maxTenure: Joi.number().integer().min(1).max(365).greater(Joi.ref('minTenure')),
  
  // Status filters
  status: Joi.alternatives().try(
    Joi.string().valid('pending', 'accepted', 'rejected', 'withdrawn', 'expired'),
    Joi.array().items(Joi.string().valid('pending', 'accepted', 'rejected', 'withdrawn', 'expired'))
  ),
  excludeMyOffers: Joi.boolean().default(false),
  
  // Sorting
  sortBy: Joi.string().valid('createdAt', 'interestRate', 'amount', 'expiresAt', 'effectiveAnnualRate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

export const sellerOfferFiltersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  
  invoiceId: Joi.string().pattern(/^INV-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  status: Joi.alternatives().try(
    Joi.string().valid('pending', 'accepted', 'rejected', 'withdrawn', 'expired'),
    Joi.array().items(Joi.string().valid('pending', 'accepted', 'rejected', 'withdrawn', 'expired'))
  ),
  
  minInterestRate: Joi.number().min(0).max(100),
  maxInterestRate: Joi.number().min(0).max(100).greater(Joi.ref('minInterestRate')),
  minAmount: Joi.number().positive(),
  maxAmount: Joi.number().positive().greater(Joi.ref('minAmount')),
  
  sortBy: Joi.string().valid('createdAt', 'interestRate', 'amount', 'expiresAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

export const lenderPortfolioFiltersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  
  status: Joi.alternatives().try(
    Joi.string().valid('pending', 'accepted', 'rejected', 'withdrawn', 'expired'),
    Joi.array().items(Joi.string().valid('pending', 'accepted', 'rejected', 'withdrawn', 'expired'))
  ),
  invoiceStatus: Joi.alternatives().try(
    Joi.string().valid('listed', 'funded', 'repaid', 'settled'),
    Joi.array().items(Joi.string().valid('listed', 'funded', 'repaid', 'settled'))
  ),
  
  minAmount: Joi.number().positive(),
  maxAmount: Joi.number().positive().greater(Joi.ref('minAmount')),
  
  dateFrom: Joi.date(),
  dateTo: Joi.date().greater(Joi.ref('dateFrom')),
  
  sortBy: Joi.string().valid('createdAt', 'interestRate', 'amount', 'status', 'expiresAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});