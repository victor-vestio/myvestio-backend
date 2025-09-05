const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const { User } = require('../dist/models/User');
const { Invoice } = require('../dist/models/Invoice'); 
const { KYC } = require('../dist/models/KYC');
const { Offer } = require('../dist/models/Offer');

// Sample data for realistic content
const companies = [
  { name: "Tech Solutions Ltd", business: "Software Development", email: "tech.solutions" },
  { name: "Global Supply Co", business: "Manufacturing", email: "global.supply" },
  { name: "Green Energy Corp", business: "Renewable Energy", email: "green.energy" },
  { name: "Logistics Express", business: "Transportation", email: "logistics.express" },
  { name: "Medical Supplies Inc", business: "Healthcare", email: "medical.supplies" },
  { name: "Construction Partners", business: "Construction", email: "construction.partners" },
  { name: "Food Distribution Ltd", business: "Food & Beverage", email: "food.distribution" },
  { name: "Textile Industries", business: "Manufacturing", email: "textile.industries" },
  { name: "Auto Parts Nigeria", business: "Automotive", email: "auto.parts" },
  { name: "Agro Processing Co", business: "Agriculture", email: "agro.processing" }
];

const anchors = [
  { name: "FirstBank Nigeria", business: "Banking", email: "firstbank" },
  { name: "Dangote Group", business: "Conglomerate", email: "dangote" },
  { name: "MTN Nigeria", business: "Telecommunications", email: "mtn.nigeria" },
  { name: "Nigerian Breweries", business: "Manufacturing", email: "nigerian.breweries" },
  { name: "Zenith Bank Plc", business: "Banking", email: "zenith.bank" },
  { name: "Shoprite Holdings", business: "Retail", email: "shoprite" }
];

const lenders = [
  { name: "Capital Investment Fund", business: "Investment", email: "capital.investment" },
  { name: "Nigerian Pension Fund", business: "Pension", email: "pension.fund" },
  { name: "Venture Capital Partners", business: "Private Equity", email: "venture.capital" },
  { name: "Commercial Finance Ltd", business: "Finance", email: "commercial.finance" },
  { name: "Asset Management Co", business: "Asset Management", email: "asset.management" },
  { name: "Microfinance Solutions", business: "Microfinance", email: "microfinance" },
  { name: "Trade Finance Corp", business: "Trade Finance", email: "trade.finance" },
  { name: "Investment Holdings", business: "Investment", email: "investment.holdings" }
];

const invoiceDescriptions = [
  "Supply of office equipment and furniture",
  "Delivery of raw materials for production",
  "Construction services for new facility",
  "Software development and implementation",
  "Medical equipment and supplies",
  "Transportation and logistics services", 
  "Marketing and advertising services",
  "Consulting and professional services",
  "Maintenance and repair services",
  "Supply of industrial machinery",
  "Food and catering services",
  "Security and surveillance services",
  "Cleaning and facility management",
  "IT equipment and hardware supply",
  "Training and development services"
];

// Helper functions
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomAmount = () => {
  const amounts = [500000, 750000, 1000000, 1250000, 1500000, 2000000, 2500000, 3000000, 5000000];
  return amounts[randomBetween(0, amounts.length - 1)];
};

const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const createUser = async (userData, role) => {
  const hashedPassword = await bcrypt.hash('SecurePass123!', 12);
  
  const user = new User({
    email: `${userData.email}@yopmail.com`,
    password: hashedPassword,
    firstName: userData.name.split(' ')[0],
    lastName: userData.name.split(' ').slice(1).join(' '),
    phone: `+234${randomBetween(8000000000, 9999999999)}`,
    role: role,
    businessType: 'company',
    businessName: userData.name,
    status: 'active',
    isEmailVerified: true,
    isKYCApproved: true,
    createdAt: randomDate(new Date('2024-01-01'), new Date('2024-12-01'))
  });

  await user.save();
  return user;
};

const createKYC = async (user, userRole) => {
  const documents = [];
  
  if (userRole === 'seller') {
    documents.push(
      { documentType: 'cac', filename: 'cac_document.pdf' },
      { documentType: 'government_id', filename: 'government_id.pdf' },
      { documentType: 'proof_of_address', filename: 'proof_of_address.pdf' }
    );
  } else if (userRole === 'anchor') {
    documents.push(
      { documentType: 'cac', filename: 'cac_document.pdf' },
      { documentType: 'tin', filename: 'tin_certificate.pdf' },
      { documentType: 'tax_clearance', filename: 'tax_clearance.pdf' },
      { documentType: 'proof_of_address', filename: 'proof_of_address.pdf' },
      { documentType: 'signatory_list', filename: 'signatory_list.pdf' },
      { documentType: 'board_resolution', filename: 'board_resolution.pdf' },
      { documentType: 'audited_financials', filename: 'audited_financials.pdf' },
      { documentType: 'bank_statements', filename: 'bank_statements.pdf' }
    );
  } else if (userRole === 'lender') {
    documents.push(
      { documentType: 'cac', filename: 'cac_document.pdf' },
      { documentType: 'government_id', filename: 'government_id.pdf' },
      { documentType: 'proof_of_address', filename: 'proof_of_address.pdf' },
      { documentType: 'signatory_list', filename: 'signatory_list.pdf' }
    );
  }

  const kyc = new KYC({
    userId: user.userId,
    userRole: userRole,
    userBusinessType: 'company',
    status: 'approved',
    documents: documents.map(doc => ({
      ...doc,
      originalName: doc.filename,
      cloudinaryUrl: `https://res.cloudinary.com/vestio/documents/${doc.filename}`,
      cloudinaryPublicId: `vestio/kyc/${user.userId}/${doc.documentType}`,
      fileSize: randomBetween(100000, 5000000),
      mimeType: 'application/pdf',
      uploadedAt: new Date()
    })),
    bankDetails: userRole !== 'anchor' ? {
      accountNumber: `${randomBetween(1000000000, 9999999999)}`,
      bankName: ['GTBank', 'FirstBank', 'Zenith Bank', 'UBA', 'Access Bank'][randomBetween(0, 4)],
      accountName: user.businessName,
      bvn: `${randomBetween(10000000000, 99999999999)}`
    } : undefined,
    submittedAt: new Date(),
    reviewedAt: new Date(),
    reviewedBy: 'admin',
    approvalNotes: 'All documents verified and approved'
  });

  await kyc.save();
  return kyc;
};

const createInvoice = async (seller, anchor) => {
  const amount = randomAmount();
  // Generate future dates to ensure positive daysUntilDue
  const now = new Date();
  const issueDate = randomDate(new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)), now); // Up to 30 days ago
  const dueDate = new Date(now.getTime() + (randomBetween(30, 180) * 24 * 60 * 60 * 1000)); // 30-180 days in future
  
  // Calculate funding terms
  const fundingPercentage = randomBetween(70, 95);
  const maxFundingAmount = Math.floor(amount * (fundingPercentage / 100));
  const interestRate = [12, 15, 18, 20][randomBetween(0, 3)];
  const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
  
  // Ensure maxTenure is valid - must be at least 14 days and less than days until due
  const maxTenure = Math.max(14, Math.min(45, daysUntilDue - 7));

  const invoice = new Invoice({
    sellerId: seller.userId,
    anchorId: anchor.userId,
    amount: amount,
    currency: 'NGN',
    issueDate: issueDate,
    dueDate: dueDate,
    description: invoiceDescriptions[randomBetween(0, invoiceDescriptions.length - 1)],
    invoiceDocument: {
      filename: `invoice_${Date.now()}.pdf`,
      originalName: 'invoice_document.pdf',
      cloudinaryUrl: `https://res.cloudinary.com/vestio/invoices/invoice_${Date.now()}.pdf`,
      cloudinaryPublicId: `vestio/invoices/invoice_${Date.now()}`,
      fileSize: randomBetween(500000, 2000000),
      mimeType: 'application/pdf'
    },
    status: 'listed',
    
    // Anchor approval data
    anchorApprovalDate: new Date(issueDate.getTime() + (1000 * 60 * 60 * 24 * randomBetween(1, 5))),
    anchorApprovalNotes: 'Invoice verified and approved by anchor',
    
    // Admin verification data
    adminVerificationDate: new Date(),
    verifiedBy: 'admin',
    marketplaceFundingTerms: {
      maxFundingAmount: maxFundingAmount,
      recommendedInterestRate: interestRate,
      maxTenure: maxTenure
    },
    
    // Marketplace data
    listedAt: new Date(),
    createdAt: issueDate,
    updatedAt: new Date()
  });

  await invoice.save();
  return invoice;
};

const createOffer = async (invoice, lender) => {
  const fundingPercentage = randomBetween(60, 90);
  const amount = Math.floor(invoice.amount * (fundingPercentage / 100));
  
  // Ensure amount doesn't exceed max
  const finalAmount = Math.min(amount, invoice.marketplaceFundingTerms.maxFundingAmount);
  const finalFundingPercentage = Math.floor((finalAmount / invoice.amount) * 100);
  
  const tenure = randomBetween(14, Math.min(45, invoice.marketplaceFundingTerms.maxTenure));
  const createdAt = randomDate(invoice.listedAt, new Date());
  const expiresAt = new Date(createdAt.getTime() + (48 * 60 * 60 * 1000)); // 48 hours

  const offer = new Offer({
    invoiceId: invoice._id.toString(),
    lenderId: lender.userId,
    amount: finalAmount,
    interestRate: invoice.marketplaceFundingTerms.recommendedInterestRate,
    fundingPercentage: finalFundingPercentage,
    tenure: tenure,
    status: 'pending',
    terms: 'Standard lending terms apply',
    lenderNotes: [
      'Fast funding available within 24 hours',
      'Flexible terms available',
      'Experienced lender with proven track record',
      'Quick approval process',
      'Competitive funding solution'
    ][randomBetween(0, 4)],
    createdAt: createdAt,
    expiresAt: expiresAt
  });

  await offer.save();
  return offer;
};

async function generateMarketplaceData() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing invoices and offers only (keep users)
    console.log('🧹 Clearing existing invoice and offer data...');
    await Invoice.deleteMany({});
    await Offer.deleteMany({});
    console.log('✅ Existing invoice and offer data cleared');

    // Get existing users instead of creating new ones
    console.log('👥 Finding existing users...');
    const existingSellers = await User.find({ role: 'seller', email: { $regex: /@yopmail\.com$/ } });
    const existingAnchors = await User.find({ role: 'anchor', email: { $regex: /@yopmail\.com$/ } });
    const existingLenders = await User.find({ role: 'lender', email: { $regex: /@yopmail\.com$/ } });

    const createdUsers = {
      sellers: existingSellers,
      anchors: existingAnchors,
      lenders: existingLenders
    };

    console.log(`✅ Found ${existingSellers.length} sellers`);
    console.log(`✅ Found ${existingAnchors.length} anchors`);
    console.log(`✅ Found ${existingLenders.length} lenders`);

    // Create invoices
    console.log('📄 Creating invoices...');
    const createdInvoices = [];
    
    for (let i = 0; i < 25; i++) {
      const randomSeller = createdUsers.sellers[randomBetween(0, createdUsers.sellers.length - 1)];
      const randomAnchor = createdUsers.anchors[randomBetween(0, createdUsers.anchors.length - 1)];
      
      const invoice = await createInvoice(randomSeller, randomAnchor);
      createdInvoices.push(invoice);
      console.log(`✅ Created invoice: ${invoice._id} (₦${invoice.amount.toLocaleString()})`);
    }

    // Create offers for some invoices
    console.log('💼 Creating offers...');
    let totalOffers = 0;
    
    for (const invoice of createdInvoices) {
      // 70% chance an invoice has offers
      if (Math.random() > 0.3) {
        const numberOfOffers = randomBetween(1, 4);
        
        // Select random lenders for this invoice (no duplicates)
        const selectedLenders = [];
        for (let j = 0; j < numberOfOffers && selectedLenders.length < createdUsers.lenders.length; j++) {
          let randomLender;
          do {
            randomLender = createdUsers.lenders[randomBetween(0, createdUsers.lenders.length - 1)];
          } while (selectedLenders.includes(randomLender.userId));
          
          selectedLenders.push(randomLender.userId);
          
          await createOffer(invoice, randomLender);
          totalOffers++;
        }
        
        console.log(`✅ Created ${numberOfOffers} offer(s) for invoice ${invoice._id}`);
      }
    }

    console.log('\n🎉 Marketplace data generation completed!');
    console.log(`📊 Summary:`);
    console.log(`   👥 Sellers used: ${createdUsers.sellers.length}`);
    console.log(`   🏛️ Anchors used: ${createdUsers.anchors.length}`);
    console.log(`   💰 Lenders used: ${createdUsers.lenders.length}`);
    console.log(`   📄 Invoices created: ${createdInvoices.length}`);
    console.log(`   💼 Offers created: ${totalOffers}`);
    
    console.log(`\n💡 Test credentials (all use password: SecurePass123!):`);
    if (createdUsers.sellers.length > 0) console.log(`   🔑 Seller: ${createdUsers.sellers[0].email}`);
    if (createdUsers.anchors.length > 0) console.log(`   🔑 Anchor: ${createdUsers.anchors[0].email}`);
    if (createdUsers.lenders.length > 0) console.log(`   🔑 Lender: ${createdUsers.lenders[0].email}`);
    
    console.log(`\n🚀 Your marketplace is now ready with realistic data!`);
    console.log(`   - Browse marketplace as lender to see all invoices`);
    console.log(`   - Create offers and test the competitive system`);
    console.log(`   - Switch to seller accounts to manage offers`);

  } catch (error) {
    console.error('❌ Error generating marketplace data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the script
generateMarketplaceData();