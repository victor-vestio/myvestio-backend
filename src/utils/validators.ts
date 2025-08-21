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