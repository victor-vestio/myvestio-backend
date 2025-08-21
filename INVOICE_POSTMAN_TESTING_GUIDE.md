# Invoice Module Postman Testing Guide

This guide covers testing all invoice routes with Postman, including detailed explanations of Redis caching and Cloudinary document management integration.

## 🔧 Setup Prerequisites

### Environment Variables
Create a Postman environment with these variables:
```
BASE_URL = http://localhost:3000/api
SELLER_TOKEN = (JWT token for seller user)
ANCHOR_TOKEN = (JWT token for anchor user)
ADMIN_TOKEN = (JWT token for admin user)
LENDER_TOKEN = (JWT token for lender user)
INVOICE_ID = (will be set dynamically)
```

### Headers Template
For all authenticated requests, add:
```
Authorization: Bearer {{SELLER_TOKEN}}
Content-Type: application/json
```

---

## 📋 Testing Workflow (Follow This Order)

### 1. **CREATE INVOICE** (Seller Only)
**Route:** `POST {{BASE_URL}}/invoices/create`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "anchorId": "ANCHOR_USER_ID_HERE",
  "amount": 50000,
  "currency": "NGN",
  "issueDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "description": "Invoice for goods delivered to Company XYZ"
}
```

**Test Script (Add to Tests tab):**
```javascript
// Save invoice ID for subsequent tests
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("INVOICE_ID", response.data.id);
    console.log("Invoice ID set to:", response.data.id);
}
```

**Expected Response:**
- Status: `201 Created`
- Invoice created in `DRAFT` status
- **Redis Usage:** Invoice creation metrics tracked in Redis (`invoice:metrics:submissions:YYYY-MM-DD`)

---

### 2. **UPLOAD INVOICE DOCUMENT** (Seller Only)
**Route:** `POST {{BASE_URL}}/invoices/{{INVOICE_ID}}/upload-document`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
```

**Body (form-data):**
```
Key: invoiceDocument
Type: File
Value: [Select a PDF/image file]
```

**Expected Response:**
- Status: `200 OK`
- Document uploaded to Cloudinary
- **Cloudinary Usage:** 
  - File stored in `vestio/invoices/{sellerId}/` folder
  - Backup enabled for 7-year compliance
  - Access mode set to `token` for security
  - Document tagged with seller ID and invoice number

**Redis Usage:**
- Real-time update published: `invoice:{invoiceId}:updates`
- Invoice cache invalidated for the specific invoice

---

### 3. **GET INVOICE DETAILS** (Any authorized user)
**Route:** `GET {{BASE_URL}}/invoices/{{INVOICE_ID}}`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
```

**Expected Response:**
- Status: `200 OK`
- Full invoice details with document URLs
- **Redis Usage:** 
  - Response cached for 30 minutes (`invoice:details:{invoiceId}`)
  - View tracked for trending calculations (`trending:invoices`)

---

### 4. **UPDATE INVOICE** (Seller Only - Draft Status)
**Route:** `PUT {{BASE_URL}}/invoices/{{INVOICE_ID}}`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "amount": 55000,
  "description": "Updated invoice description with additional details"
}
```

**Expected Response:**
- Status: `200 OK`
- Only works if invoice is in `DRAFT` status
- **Redis Usage:** All invoice-related caches invalidated

---

### 5. **SUBMIT INVOICE FOR APPROVAL** (Seller Only)
**Route:** `POST {{BASE_URL}}/invoices/{{INVOICE_ID}}/submit`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "finalNotes": "All required documents attached. Ready for review."
}
```

**Expected Response:**
- Status: `200 OK`
- Invoice status changes to `SUBMITTED`
- **Cloudinary Usage:** Document permissions updated to `submitted` status
- **Redis Usage:** 
  - Status change metrics tracked
  - Anchor notification published
  - Email notification triggered

---

### 6. **GET PENDING APPROVALS** (Anchor Only)
**Route:** `GET {{BASE_URL}}/invoices/anchor/pending`

**Headers:**
```
Authorization: Bearer {{ANCHOR_TOKEN}}
```

**Query Parameters:**
```
page=1
limit=20
sortBy=submittedAt
sortOrder=asc
```

**Expected Response:**
- Status: `200 OK`
- List of invoices pending anchor approval
- **Redis Usage:** Results cached for 10 minutes with search pattern

---

### 7. **ANCHOR APPROVAL/REJECTION** (Anchor Only)
**Route:** `POST {{BASE_URL}}/invoices/{{INVOICE_ID}}/anchor-approval`

**Headers:**
```
Authorization: Bearer {{ANCHOR_TOKEN}}
Content-Type: application/json
```

**Body (JSON) - For Approval:**
```json
{
  "action": "approve",
  "notes": "Invoice verified and approved for funding",
  "fundingTerms": {
    "maxFundingAmount": 45000,
    "recommendedInterestRate": 12.5
  }
}
```

**Body (JSON) - For Rejection:**
```json
{
  "action": "reject",
  "notes": "Insufficient documentation provided"
}
```

**Expected Response:**
- Status: `200 OK`
- Invoice status changes to `ANCHOR_APPROVED` or `REJECTED`
- **Cloudinary Usage:** Document permissions updated to `approved`
- **Redis Usage:** 
  - Status transition metrics tracked
  - Seller notification published
  - Processing time calculated and stored

---

### 8. **GET ADMIN PENDING VERIFICATIONS** (Admin Only)
**Route:** `GET {{BASE_URL}}/invoices/admin/pending`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Expected Response:**
- Status: `200 OK`
- List of anchor-approved invoices pending admin verification
- **Redis Usage:** Results cached with admin-specific pattern

---

### 9. **ADMIN VERIFICATION** (Admin Only)
**Route:** `POST {{BASE_URL}}/invoices/{{INVOICE_ID}}/admin-verification`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json
```

**Body (JSON) - For Verification:**
```json
{
  "action": "verify",
  "notes": "All compliance checks passed",
  "verificationDetails": {
    "documentsVerified": true,
    "complianceChecked": true,
    "riskAssessment": "Low risk - established anchor relationship"
  }
}
```

**Expected Response:**
- Status: `200 OK`
- Invoice status changes to `ADMIN_VERIFIED`
- **Cloudinary Usage:** Document permissions updated to `verified`

---

### 10. **LIST TO MARKETPLACE** (Admin Only)
**Route:** `POST {{BASE_URL}}/invoices/{{INVOICE_ID}}/list`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Expected Response:**
- Status: `200 OK`
- Invoice status changes to `LISTED`
- **Cloudinary Usage:** Document permissions updated to `listed` (more accessible)
- **Redis Usage:** 
  - Marketplace caches invalidated
  - Marketplace update published for real-time notifications

---

### 11. **GET MARKETPLACE INVOICES** (Lender Only)
**Route:** `GET {{BASE_URL}}/invoices/marketplace`

**Headers:**
```
Authorization: Bearer {{LENDER_TOKEN}}
```

**Query Parameters:**
```
page=1
limit=10
minAmount=10000
maxAmount=100000
currency=NGN
sortBy=listedAt
sortOrder=desc
```

**Expected Response:**
- Status: `200 OK`
- List of available invoices for funding
- **Redis Usage:** Marketplace results cached for 5 minutes
- **Cloudinary Usage:** Thumbnail URLs generated for preview

---

### 12. **GET TRENDING INVOICES** (Lender Only)
**Route:** `GET {{BASE_URL}}/invoices/marketplace/trending`

**Headers:**
```
Authorization: Bearer {{LENDER_TOKEN}}
```

**Query Parameters:**
```
limit=5
```

**Expected Response:**
- Status: `200 OK`
- Most viewed invoices in marketplace
- **Redis Usage:** View counts retrieved from sorted set (`trending:invoices`)

---

### 13. **GET USER INVOICES** (Any Role)
**Route:** `GET {{BASE_URL}}/invoices`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
```

**Query Parameters:**
```
page=1
limit=20
status=draft,submitted
sortBy=createdAt
sortOrder=desc
search=Company XYZ
```

**Expected Response:**
- Status: `200 OK`
- User's invoices based on their role
- **Redis Usage:** Search results cached based on filter parameters

---

## 🚀 Advanced Testing Scenarios

### 14. **UPLOAD SUPPORTING DOCUMENTS** (Seller Only)
**Route:** `POST {{BASE_URL}}/invoices/{{INVOICE_ID}}/supporting-documents`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
```

**Body (form-data):**
```
Key: supportingDocuments
Type: File (Multiple files allowed)
Value: [Select up to 5 files]
```

**Expected Response:**
- Status: `200 OK` (Currently returns 501 - Not Implemented)

---

### 15. **GET INVOICE STATUS HISTORY**
**Route:** `GET {{BASE_URL}}/invoices/{{INVOICE_ID}}/status-history`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
```

**Expected Response:**
- Status: `501 Not Implemented` (Placeholder)

---

### 16. **GET SECURE DOCUMENT URL**
**Route:** `GET {{BASE_URL}}/invoices/{{INVOICE_ID}}/document/main`

**Headers:**
```
Authorization: Bearer {{SELLER_TOKEN}}
```

**Expected Response:**
- Status: `501 Not Implemented` (Placeholder)
- **Cloudinary Usage:** Would generate time-limited signed URLs for secure access

---

## 🔍 Testing Error Scenarios

### **Unauthorized Access**
```
Headers: Authorization: Bearer INVALID_TOKEN
Expected: 401 Unauthorized
```

### **Wrong Role Access**
```
Route: POST /invoices/create
Headers: Authorization: Bearer {{ANCHOR_TOKEN}}
Expected: 403 Forbidden (Only sellers can create)
```

### **Invalid Invoice Status**
```
Route: PUT /invoices/{{INVOICE_ID}}
Headers: Authorization: Bearer {{SELLER_TOKEN}}
Body: {"amount": 60000}
Expected: 400 Bad Request (if invoice not in DRAFT status)
```

### **Rate Limiting Test**
Make 21+ rapid requests to any upload endpoint:
```
Expected: 429 Too Many Requests
```

---

## 📊 Redis & Cloudinary Integration Details

### **Redis Usage Patterns:**

1. **Caching Strategy:**
   - Invoice details cached for 30 minutes
   - Search results cached for 5-10 minutes
   - Marketplace data cached for 5 minutes
   - Analytics cached for 1 hour

2. **Real-time Updates:**
   - Status changes published to channels
   - User-specific notifications
   - Marketplace updates for new listings

3. **Metrics Tracking:**
   - Daily submission counts
   - Processing time calculations
   - Trending invoice views
   - Status transition analytics

4. **Distributed Locking:**
   - Prevents concurrent invoice modifications
   - Ensures data consistency during status changes

### **Cloudinary Integration:**

1. **Document Security:**
   - Token-based access control
   - Backup enabled for compliance
   - Folder organization by seller/invoice

2. **Image Processing:**
   - Automatic thumbnail generation
   - Preview URLs for marketplace
   - Watermarking for different statuses

3. **Access Control:**
   - Draft: Restricted access
   - Submitted: Under review tags
   - Listed: Marketplace accessible
   - Funded: Active status tags

4. **Compliance Features:**
   - 7-year retention policy
   - Audit trail with metadata
   - Secure signed URLs with expiration

---

## 🧪 Postman Collection Setup

### **Pre-request Scripts** (Add to Collection level):
```javascript
// Auto-refresh tokens if needed
if (!pm.environment.get("SELLER_TOKEN")) {
    console.log("Please set authentication tokens in environment");
}
```

### **Test Scripts** (Add to Collection level):
```javascript
// Log response times for performance monitoring
pm.test("Response time is acceptable", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});

// Check for proper error handling
if (pm.response.code >= 400) {
    pm.test("Error response has proper structure", function () {
        const response = pm.response.json();
        pm.expect(response).to.have.property("success", false);
        pm.expect(response).to.have.property("message");
    });
}
```

### **Environment Variables to Set:**
```
BASE_URL = http://localhost:3000/api
SELLER_TOKEN = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANCHOR_TOKEN = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_TOKEN = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
LENDER_TOKEN = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANCHOR_USER_ID = (MongoDB ObjectId of anchor user)
```

Remember to follow the testing order as invoice status flows are sequential: DRAFT → SUBMITTED → ANCHOR_APPROVED → ADMIN_VERIFIED → LISTED → (FUNDED when offers implemented).