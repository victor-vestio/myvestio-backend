# Cloudinary Usage Strategy for Vestio Backend
*When, Why, and How to implement Cloudinary across modules*

## 🎯 Current Status: Connected but Unused
Cloudinary is set up and connected, but not actively used. This is **perfectly fine** for the auth module!

---

## 📋 Module-by-Module Cloudinary Implementation Plan

### 🔐 1. AUTH MODULE
**Current Status:** ✅ Complete without Cloudinary  
**Cloudinary Usage:** Not needed

#### Why No Cloudinary:
- Auth only handles text data (emails, passwords, names)
- No file uploads required
- Profile pictures are optional and can come later

#### Future Enhancement (Low Priority):
```typescript
// Optional: User avatar uploads
interface UserProfile {
  avatarUrl?: string; // Cloudinary URL
}

class ProfileImageService {
  static async uploadAvatar(userId: string, file: Express.Multer.File) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `vestio/users/${userId}`,
      transformation: [
        { width: 200, height: 200, crop: 'fill' },
        { quality: 'auto', format: 'auto' }
      ]
    });
    return result.secure_url;
  }
}
```

---

### 📋 2. KYC MODULE  
**Cloudinary Priority:** 🔥 HIGHEST - Absolutely critical

#### When to Add Cloudinary:
- **From day one of KYC module development**
- KYC is entirely about document uploads and verification

#### Cloudinary Uses:
```typescript
// Document Upload Service
class KYCDocumentService {
  static async uploadDocument(
    userId: string, 
    documentType: string, 
    file: Express.Multer.File
  ) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `vestio/kyc/${userId}`,
      resource_type: 'auto', // Handles images and PDFs
      public_id: `${documentType}_${Date.now()}`,
      transformation: [
        { quality: 'auto' },
        { format: 'auto' }
      ],
      // Security settings
      access_mode: 'authenticated', // Requires auth to view
      tags: [documentType, 'kyc', userId]
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes
    };
  }

  // Generate thumbnail for document preview
  static async generateThumbnail(publicId: string) {
    return cloudinary.url(publicId, {
      transformation: [
        { width: 300, height: 400, crop: 'fit' },
        { quality: '70', format: 'jpg' }
      ]
    });
  }

  // Secure document access
  static generateSecureUrl(publicId: string, expiresIn = 3600) {
    return cloudinary.utils.private_download_url(publicId, 'jpg', {
      expires_at: Math.floor(Date.now() / 1000) + expiresIn
    });
  }
}

// Document Types for KYC
enum KYCDocumentType {
  GOVERNMENT_ID = 'government_id',
  PROOF_OF_ADDRESS = 'proof_of_address',
  BUSINESS_CERTIFICATE = 'business_certificate',
  BANK_STATEMENT = 'bank_statement',
  TAX_CLEARANCE = 'tax_clearance',
  AUDITED_FINANCIALS = 'audited_financials'
}
```

**Why Critical:**
- Legal requirement for document retention (7 years)
- Need secure, authenticated access
- Automatic format optimization (PDF → images for preview)
- Thumbnail generation for admin review
- Virus scanning capabilities

---

### 🧾 3. INVOICE MODULE
**Cloudinary Priority:** 🔥 HIGH - Core business documents

#### When to Add Cloudinary:
- **Essential for invoice document uploads**
- Invoices are the core business documents

#### Cloudinary Uses:
```typescript
// Invoice Document Service
class InvoiceDocumentService {
  static async uploadInvoice(
    sellerId: string,
    invoiceNumber: string,
    file: Express.Multer.File
  ) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `vestio/invoices/${sellerId}`,
      public_id: `invoice_${invoiceNumber}_${Date.now()}`,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto', format: 'auto' }
      ],
      // Compliance settings
      backup: true, // Enable backup for compliance
      tags: ['invoice', sellerId, invoiceNumber]
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      pages: result.pages, // For PDFs
      format: result.format,
      bytes: result.bytes
    };
  }

  // Generate invoice preview
  static generatePreviewUrl(publicId: string) {
    return cloudinary.url(publicId, {
      transformation: [
        { width: 800, height: 1000, crop: 'fit' },
        { quality: '80', format: 'jpg' },
        { page: 1 } // First page for PDF preview
      ]
    });
  }

  // Watermark for unverified invoices
  static generateWatermarkedUrl(publicId: string) {
    return cloudinary.url(publicId, {
      transformation: [
        {
          overlay: 'text:Arial_60:UNVERIFIED',
          color: 'red',
          opacity: 30,
          gravity: 'center'
        }
      ]
    });
  }
}

// Supporting Documents
class InvoiceSupportingDocsService {
  static async uploadSupportingDocument(
    invoiceId: string,
    docType: string,
    file: Express.Multer.File
  ) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `vestio/invoices/supporting/${invoiceId}`,
      public_id: `${docType}_${Date.now()}`,
      tags: ['supporting_doc', invoiceId, docType]
    });

    return result;
  }
}
```

**Why High Priority:**
- Invoice documents are core to the business
- Need secure storage and access control
- PDF preview generation for lenders
- Watermarking for different invoice states
- Compliance and audit trail requirements

---

### 🏪 4. MARKETPLACE MODULE
**Cloudinary Priority:** 🟡 MEDIUM - Enhanced UX

#### When to Add Cloudinary:
- **After core marketplace functionality works**
- Nice-to-have for better user experience

#### Cloudinary Uses:
```typescript
// Company Logo Service
class CompanyLogoService {
  static async uploadCompanyLogo(
    companyId: string,
    file: Express.Multer.File
  ) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `vestio/companies/${companyId}`,
      public_id: 'logo',
      transformation: [
        { width: 400, height: 400, crop: 'fit' },
        { quality: 'auto', format: 'auto' },
        { background: 'white' } // Ensure clean background
      ],
      overwrite: true // Replace existing logo
    });

    return result.secure_url;
  }

  // Different logo sizes for various UI contexts
  static getLogoVariants(publicId: string) {
    return {
      thumbnail: cloudinary.url(publicId, {
        transformation: [{ width: 50, height: 50, crop: 'fill' }]
      }),
      small: cloudinary.url(publicId, {
        transformation: [{ width: 100, height: 100, crop: 'fit' }]
      }),
      medium: cloudinary.url(publicId, {
        transformation: [{ width: 200, height: 200, crop: 'fit' }]
      })
    };
  }
}

// Invoice Preview Cards
class MarketplacePreviewService {
  static generateInvoicePreviewCard(invoicePublicId: string) {
    return cloudinary.url(invoicePublicId, {
      transformation: [
        { width: 400, height: 300, crop: 'fit' },
        { quality: '70', format: 'jpg' },
        { overlay: 'text:Arial_20:Invoice Preview', gravity: 'south' }
      ]
    });
  }
}
```

---

### 💳 5. PAYMENTS MODULE
**Cloudinary Priority:** 🟡 LOW - Optional receipts

#### When to Add Cloudinary:
- **Much later - when adding receipt generation**
- Not critical for core payment functionality

#### Cloudinary Uses:
```typescript
// Payment Receipt Service
class PaymentReceiptService {
  static async generateReceipt(transactionData: any) {
    // Could generate visual receipts using Cloudinary's image generation
    // But this is very low priority
  }
}
```

---

### 🛠️ 6. ADMIN MODULE
**Cloudinary Priority:** 🟡 MEDIUM - Document management

#### When to Add Cloudinary:
- **When building admin document review features**
- Useful for bulk document operations

#### Cloudinary Uses:
```typescript
// Admin Document Management
class AdminDocumentService {
  static async bulkDocumentOperation(publicIds: string[], operation: string) {
    switch (operation) {
      case 'approve':
        // Remove watermarks, move to approved folder
        break;
      case 'reject':
        // Add rejection watermark
        break;
      case 'archive':
        // Move to archive folder
        break;
    }
  }

  // Document analytics
  static async getDocumentStats() {
    const stats = await cloudinary.api.usage();
    return {
      totalStorage: stats.storage.usage,
      totalImages: stats.resources.image.usage,
      totalVideos: stats.resources.video.usage
    };
  }
}
```

---

### 🔔 7. NOTIFICATIONS MODULE
**Cloudinary Priority:** 🟢 NONE - No file handling needed

---

## 🚀 Implementation Timeline

### Phase 1: Auth Module Complete ✅
**Cloudinary:** Not needed, skip for now

### Phase 2: KYC Module (Next Priority)
**Cloudinary:** 🔥 **CRITICAL** - Document uploads are core feature

### Phase 3: Invoice Module  
**Cloudinary:** 🔥 **HIGH** - Invoice document storage essential

### Phase 4: Marketplace Module
**Cloudinary:** 🟡 **MEDIUM** - Company logos for better UX

### Phase 5: Admin Module
**Cloudinary:** 🟡 **MEDIUM** - Document management tools

### Phase 6: Payments Module
**Cloudinary:** 🟢 **LOW** - Optional receipt generation

---

## 💡 Key Cloudinary Patterns for Vestio

### 1. Secure Document Upload
```typescript
async function uploadSecureDocument(
  userId: string,
  docType: string,
  file: Express.Multer.File
) {
  const result = await cloudinary.uploader.upload(file.path, {
    folder: `vestio/${docType}/${userId}`,
    resource_type: 'auto',
    access_mode: 'authenticated',
    backup: true,
    tags: [docType, userId, 'secure']
  });

  // Clean up temp file
  fs.unlinkSync(file.path);
  
  return result;
}
```

### 2. Transformation Pipeline
```typescript
const documentTransformations = {
  preview: [
    { width: 800, height: 1000, crop: 'fit' },
    { quality: '80', format: 'jpg' }
  ],
  thumbnail: [
    { width: 200, height: 250, crop: 'fit' },
    { quality: '60', format: 'jpg' }
  ],
  watermarked: [
    {
      overlay: 'text:Arial_40:CONFIDENTIAL',
      color: 'red',
      opacity: 20,
      gravity: 'center'
    }
  ]
};
```

### 3. Compliance & Security
```typescript
// Generate time-limited secure URLs
function generateSecureViewUrl(publicId: string, expiresInMinutes = 60) {
  return cloudinary.utils.private_download_url(publicId, 'jpg', {
    expires_at: Math.floor(Date.now() / 1000) + (expiresInMinutes * 60),
    attachment: false // View in browser, don't download
  });
}

// Audit trail
async function logDocumentAccess(publicId: string, userId: string, action: string) {
  // Log who accessed what document when
  await AuditLog.create({
    userId,
    entityType: 'document',
    entityId: publicId,
    action,
    timestamp: new Date()
  });
}
```

## 🔒 Security & Compliance Considerations

### Document Retention Policy
```typescript
// 7-year retention for KYC documents (regulatory requirement)
const retentionPolicies = {
  kyc: 7 * 365 * 24 * 60 * 60, // 7 years
  invoices: 5 * 365 * 24 * 60 * 60, // 5 years
  profiles: 2 * 365 * 24 * 60 * 60, // 2 years
};
```

### Access Control
```typescript
// Role-based document access
function canAccessDocument(userRole: string, documentType: string, ownerId: string, requesterId: string) {
  if (userRole === 'admin') return true;
  if (ownerId === requesterId) return true;
  if (documentType === 'invoice' && userRole === 'lender') return true; // Marketplace access
  return false;
}
```

## 🎯 Bottom Line

**For Auth Module:** Cloudinary not needed - totally fine!

**Priority Order for Future Modules:**
1. 🔥 **KYC** - Absolutely essential for document verification
2. 🔥 **Invoices** - Critical for core business documents  
3. 🟡 **Marketplace** - Nice UX enhancement with company logos
4. 🟡 **Admin** - Document management tools
5. 🟢 **Payments** - Very low priority for receipts

**Key Benefits When You Do Implement:**
- ✅ Automatic format optimization (PDF → JPG previews)
- ✅ Secure, authenticated document access
- ✅ Compliance-ready with backup & retention
- ✅ Real-time image transformations
- ✅ CDN delivery for fast loading

You're being smart by not over-engineering the auth module with unnecessary file handling!