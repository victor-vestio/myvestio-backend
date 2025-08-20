# Vestio Backend MVP Documentation & Structure
*TypeScript MERN Stack*

## 📁 Project Structure
```
vestio-backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── jwt.ts
│   │   ├── multer.ts
│   │   └── environment.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Invoice.ts
│   │   ├── KYC.ts
│   │   ├── Offer.ts
│   │   ├── Transaction.ts
│   │   └── AuditLog.ts
│   ├── interfaces/
│   │   ├── IUser.ts
│   │   ├── IInvoice.ts
│   │   ├── IKYC.ts
│   │   ├── IOffer.ts
│   │   ├── ITransaction.ts
│   │   └── common.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── roleAuth.ts
│   │   ├── upload.ts
│   │   ├── validation.ts
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── kyc.ts
│   │   ├── invoices.ts
│   │   ├── marketplace.ts
│   │   ├── payments.ts
│   │   ├── admin.ts
│   │   └── notifications.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── kycController.ts
│   │   ├── invoiceController.ts
│   │   ├── marketplaceController.ts
│   │   ├── paymentController.ts
│   │   ├── adminController.ts
│   │   └── notificationController.ts
│   ├── services/
│   │   ├── creditService.ts
│   │   ├── settlementService.ts
│   │   ├── emailService.ts
│   │   ├── auditService.ts
│   │   └── webhookService.ts
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── helpers.ts
│   │   ├── constants.ts
│   │   └── types.ts
│   └── app.ts
├── uploads/
│   ├── kyc-documents/
│   ├── invoices/
│   └── temp/
├── tests/
├── package.json
├── tsconfig.json
├── .env.example
└── server.ts
```

## 📦 Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "@types/express": "^4.17.17",
    "mongoose": "^7.5.0",
    "@types/mongoose": "^5.11.97",
    "bcryptjs": "^2.4.3",
    "@types/bcryptjs": "^2.4.2",
    "jsonwebtoken": "^9.0.2",
    "@types/jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "@types/multer": "^1.4.7",
    "nodemailer": "^6.9.4",
    "@types/nodemailer": "^6.4.9",
    "joi": "^17.9.2",
    "@types/joi": "^17.2.3",
    "cors": "^2.8.5",
    "@types/cors": "^2.8.13",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.8.1",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.0",
    "@types/uuid": "^9.0.2",
    "moment": "^2.29.4",
    "@types/moment": "^2.13.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1",
    "nodemon": "^3.0.1"
  }
}
```

---

## 🔐 1. AUTH MODULE

### Routes: `/api/auth`

#### Authentication Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/register` | User registration | Public |
| POST | `/login` | User login | Public |
| POST | `/logout` | User logout | Private |
| POST | `/refresh-token` | Refresh JWT token | Private |
| POST | `/forgot-password` | Password reset request | Public |
| POST | `/reset-password` | Reset password with token | Public |
| GET | `/profile` | Get user profile | Private |
| PUT | `/profile` | Update user profile | Private |
| POST | `/verify-email` | Verify email address | Public |
| POST | `/enable-2fa` | Enable 2FA | Private |
| POST | `/verify-2fa` | Verify 2FA code | Private |

#### Request/Response Schemas
```typescript
// Registration Request
interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'seller' | 'lender' | 'anchor';
  businessType?: 'individual' | 'company';
  businessName?: string;
}

// Login Request
interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
}

// Auth Response
interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isKYCApproved: boolean;
  };
  token: string;
  refreshToken: string;
}
```

---

## 📋 2. KYC MODULE

### Routes: `/api/kyc`

#### KYC Management Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/submit` | Submit KYC documents | Private |
| GET | `/status` | Get KYC status | Private |
| PUT | `/update` | Update KYC information | Private |
| GET | `/documents` | Get uploaded documents | Private |
| DELETE | `/documents/:id` | Delete a document | Private |
| GET | `/admin/pending` | Get pending KYC applications | Admin |
| PUT | `/admin/approve/:userId` | Approve KYC | Admin |
| PUT | `/admin/reject/:userId` | Reject KYC | Admin |

#### Document Types by Role
```typescript
// Seller Documents
interface SellerKYC {
  // Business Verification
  cac: File; // Certificate of Incorporation
  bankDetails: BankDetails;
  
  // Identity Verification
  governmentId: File; // National ID, Passport, Driver's License
  proofOfAddress: File; // Utility bill, bank statement, lease
}

// Lender Documents (Individual)
interface LenderIndividualKYC {
  governmentId: File;
  proofOfAddress: File;
  dateOfBirth: Date;
}

// Lender Documents (Company)
interface LenderCompanyKYC {
  cac: File;
  bankDetails: BankDetails;
  proofOfAddress: File;
  signatoryList: File;
}

// Anchor Documents
interface AnchorKYC {
  // Corporate Documents
  cac: File;
  tin: File; // Tax Identification Number
  taxClearance: File;
  
  // Legal & Compliance
  proofOfAddress: File;
  signatoryList: File;
  boardResolution: File;
  
  // Financials
  auditedFinancials: File[]; // Last 2 years
  bankStatements: File[]; // Last 2 years
}
```

---

## 🧾 3. INVOICE MODULE

### Routes: `/api/invoices`

#### Invoice Management Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/create` | Create new invoice | Seller |
| GET | `/` | Get user's invoices | Private |
| GET | `/:id` | Get specific invoice | Private |
| PUT | `/:id` | Update invoice (draft only) | Seller |
| DELETE | `/:id` | Delete invoice (draft only) | Seller |
| POST | `/:id/submit` | Submit invoice for approval | Seller |
| POST | `/:id/anchor-approve` | Anchor approves invoice | Anchor |
| POST | `/:id/anchor-reject` | Anchor rejects invoice | Anchor |
| GET | `/anchor/pending` | Get pending approvals | Anchor |
| GET | `/anchor/history` | Get anchor's invoice history | Anchor |

#### Invoice Status Flow
```typescript
enum InvoiceStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ANCHOR_APPROVED = 'anchor_approved',
  ADMIN_VERIFIED = 'admin_verified',
  LISTED = 'listed',
  FUNDED = 'funded',
  REPAID = 'repaid',
  SETTLED = 'settled'
}
```

#### Invoice Schema
```typescript
interface Invoice {
  invoiceNumber: string;
  sellerId: string;
  anchorId: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  description: string;
  invoiceDocument: {
    filename: string;
    originalName: string;
    path: string;
  };
  status: InvoiceStatus;
  anchorApprovalDate?: Date;
  adminVerificationDate?: Date;
  verifiedBy?: string;
  fundingAmount?: number;
  interestRate?: number;
  fundedBy?: string;
  fundedAt?: Date;
  repaymentDate?: Date;
  settlementDate?: Date;
}
```

---

## 🏪 4. MARKETPLACE MODULE

### Routes: `/api/marketplace`

#### Marketplace Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/invoices` | Get available invoices | Lender |
| GET | `/invoices/:id` | Get invoice details | Lender |
| POST | `/offers` | Create financing offer | Lender |
| GET | `/offers` | Get lender's offers | Lender |
| PUT | `/offers/:id/withdraw` | Withdraw offer | Lender |
| GET | `/seller/offers/:invoiceId` | Get offers for invoice | Seller |
| POST | `/seller/accept-offer/:offerId` | Accept offer | Seller |
| POST | `/seller/reject-offer/:offerId` | Reject offer | Seller |

#### Offer Schema
```typescript
interface Offer {
  invoiceId: string;
  lenderId: string;
  amount: number; // Usually 80% of invoice amount
  interestRate: number; // Annual percentage
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expiresAt: Date;
  acceptedAt?: Date;
  terms?: string;
}
```

---

## 💳 5. PAYMENTS MODULE

### Routes: `/api/payments`

#### Payment Processing Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/disburse/:invoiceId` | Disburse funds to seller | System |
| POST | `/repay/:invoiceId` | Anchor repays invoice | Anchor |
| GET | `/transactions` | Get user transactions | Private |
| GET | `/transactions/:id` | Get transaction details | Private |
| POST | `/webhooks/psp` | Payment provider webhooks | Public |
| GET | `/settlement/:invoiceId` | Get settlement details | Private |

#### Transaction Types
```typescript
enum TransactionType {
  DISBURSEMENT = 'disbursement', // Lender → Seller
  REPAYMENT = 'repayment',       // Anchor → Platform
  SETTLEMENT = 'settlement'       // Platform → Lender/Seller
}

interface Transaction {
  invoiceId: string;
  type: TransactionType;
  fromUserId?: string;
  toUserId?: string;
  amount: number;
  currency: string;
  platformFee?: number;
  interestAmount?: number;
  paymentReference: string;
  providerTransactionId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

---

## 🛠️ 6. ADMIN MODULE

### Routes: `/api/admin`

#### Admin Management Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/dashboard` | Admin dashboard stats | Admin |
| GET | `/invoices/pending` | Pending invoice verifications | Admin |
| POST | `/invoices/:id/verify` | Verify invoice | Admin |
| POST | `/invoices/:id/reject` | Reject invoice | Admin |
| GET | `/users` | Get all users | Admin |
| PUT | `/users/:id/status` | Update user status | Admin |
| GET | `/transactions` | Get all transactions | Admin |
| GET | `/audit-logs` | Get audit logs | Admin |
| POST | `/disputes/:id/resolve` | Resolve dispute | Admin |
| GET | `/reports/revenue` | Revenue reports | Admin |
| GET | `/reports/risk` | Risk assessment reports | Admin |

---

## 🔔 7. NOTIFICATIONS MODULE

### Routes: `/api/notifications`

#### Notification Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/` | Get user notifications | Private |
| PUT | `/:id/read` | Mark as read | Private |
| PUT | `/mark-all-read` | Mark all as read | Private |
| DELETE | `/:id` | Delete notification | Private |

#### Notification Events
```typescript
enum NotificationEvent {
  // KYC Events
  KYC_APPROVED = 'kyc_approved',
  KYC_REJECTED = 'kyc_rejected',
  
  // Invoice Events
  INVOICE_SUBMITTED = 'invoice_submitted',
  INVOICE_APPROVED = 'invoice_approved',
  INVOICE_REJECTED = 'invoice_rejected',
  INVOICE_FUNDED = 'invoice_funded',
  
  // Marketplace Events
  NEW_OFFER_RECEIVED = 'new_offer_received',
  OFFER_ACCEPTED = 'offer_accepted',
  OFFER_REJECTED = 'offer_rejected',
  
  // Payment Events
  DISBURSEMENT_COMPLETED = 'disbursement_completed',
  REPAYMENT_DUE = 'repayment_due',
  REPAYMENT_RECEIVED = 'repayment_received',
  SETTLEMENT_COMPLETED = 'settlement_completed'
}
```

---

## 🔧 8. SERVICES

### Credit Service
```typescript
interface CreditService {
  calculateCreditScore(anchorId: string): Promise<number>;
  updateCreditHistory(anchorId: string, payment: PaymentRecord): Promise<void>;
  getCreditLimit(anchorId: string): Promise<number>;
  assessRisk(invoiceId: string): Promise<RiskAssessment>;
}
```

### Settlement Service
```typescript
interface SettlementService {
  calculateFees(amount: number, interestRate: number, days: number): Promise<SettlementBreakdown>;
  processSettlement(invoiceId: string): Promise<void>;
  generateSettlementReport(invoiceId: string): Promise<SettlementReport>;
}

interface SettlementBreakdown {
  totalAmount: number;
  platformFee: number;
  lenderInterest: number;
  sellerBalance: number;
}
```

### Email Service
```typescript
interface EmailService {
  sendWelcomeEmail(user: User): Promise<void>;
  sendKYCStatusUpdate(user: User, status: string): Promise<void>;
  sendInvoiceNotification(invoice: Invoice, event: NotificationEvent): Promise<void>;
  sendPaymentNotification(transaction: Transaction): Promise<void>;
}
```

### Audit Service
```typescript
interface AuditService {
  logAction(userId: string, action: string, entityType: string, entityId: string, oldData?: any, newData?: any): Promise<void>;
  getAuditTrail(entityType: string, entityId: string): Promise<AuditLog[]>;
}
```

---

## 🔒 9. MIDDLEWARE

### Authentication Middleware
```typescript
interface AuthMiddleware {
  authenticate: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => void;
  requireKYC: (req: Request, res: Response, next: NextFunction) => void;
}
```

### Validation Middleware
```typescript
interface ValidationSchemas {
  registerUser: Joi.Schema;
  loginUser: Joi.Schema;
  createInvoice: Joi.Schema;
  createOffer: Joi.Schema;
  submitKYC: Joi.Schema;
}
```

### Upload Middleware
```typescript
interface UploadConfig {
  kycDocuments: multer.Multer;
  invoiceDocuments: multer.Multer;
  maxFileSize: 5 * 1024 * 1024; // 5MB
  allowedTypes: ['pdf', 'jpg', 'jpeg', 'png'];
}
```

---

## 🎯 10. KEY IMPLEMENTATION NOTES

### Security Requirements
- JWT tokens with 15min expiry + refresh tokens
- Role-based access control (RBAC)
- Rate limiting (100 requests/15min per IP)
- File upload validation and virus scanning
- Data encryption at rest
- SSL/TLS in transit
- 2FA for admin and high-value accounts

### Performance Targets
- API response time: <2 seconds
- Support: 10,000+ invoices/month
- Database indexing on frequently queried fields
- File compression for uploads
- CDN for static assets

### Compliance
- KYC/AML document retention (7 years)
- GDPR/NDPR data protection
- Audit trail for all financial transactions
- Data backup and disaster recovery

### Database Indexes Needed
```typescript
// Critical indexes for performance
const indexes = {
  users: ['email', 'role', 'isActive'],
  invoices: ['sellerId', 'anchorId', 'status', 'dueDate'],
  offers: ['invoiceId', 'lenderId', 'status', 'expiresAt'],
  transactions: ['invoiceId', 'fromUserId', 'toUserId', 'status'],
  auditLogs: ['userId', 'entityType', 'timestamp']
};
```

### Environment Variables
```typescript
interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  EMAIL_HOST: string;
  EMAIL_USER: string;
  EMAIL_PASS: string;
  PAYMENT_PROVIDER_KEY: string;
  PAYMENT_WEBHOOK_SECRET: string;
  FILE_UPLOAD_PATH: string;
  MAX_FILE_SIZE: number;
}
```

This documentation provides the complete structure you need to build your Vestio MVP backend with TypeScript and the MERN stack. Each module is clearly defined with its routes, schemas, and responsibilities.