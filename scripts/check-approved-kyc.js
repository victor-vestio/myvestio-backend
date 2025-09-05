const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { KYC } = require('../dist/models/KYC');
const { User } = require('../dist/models/User');

async function checkApprovedKYC() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all approved KYC records
    const approvedKYCs = await KYC.find({ status: 'approved' });
    
    console.log(`\n📊 Found ${approvedKYCs.length} approved KYC records:\n`);
    
    let missingBankDetails = 0;
    let missingDateOfBirth = 0;
    
    for (const kyc of approvedKYCs) {
      // Get user info
      const user = await User.findById(kyc.userId);
      
      console.log(`👤 User: ${user?.email || 'Unknown'}`);
      console.log(`   Role: ${kyc.userRole}`);
      console.log(`   Business Type: ${kyc.userBusinessType || 'N/A'}`);
      console.log(`   Approved: ${kyc.reviewedAt?.toISOString()}`);
      
      // Check bank details
      const needsBankDetails = ['seller', 'anchor'].includes(kyc.userRole) || 
        (kyc.userRole === 'lender' && kyc.userBusinessType === 'company');
      
      if (needsBankDetails) {
        if (!kyc.bankDetails || !kyc.bankDetails.accountNumber) {
          console.log(`   ❌ Missing bank details (REQUIRED)`);
          missingBankDetails++;
        } else {
          console.log(`   ✅ Has bank details`);
        }
      } else {
        console.log(`   ➖ Bank details not required`);
      }
      
      // Check date of birth
      const needsDateOfBirth = kyc.userRole === 'lender' && kyc.userBusinessType === 'individual';
      
      if (needsDateOfBirth) {
        if (!kyc.dateOfBirth) {
          console.log(`   ❌ Missing date of birth (REQUIRED)`);
          missingDateOfBirth++;
        } else {
          console.log(`   ✅ Has date of birth`);
        }
      } else {
        console.log(`   ➖ Date of birth not required`);
      }
      
      console.log('   ─────────────────────────────────\n');
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total approved KYCs: ${approvedKYCs.length}`);
    console.log(`   Missing required bank details: ${missingBankDetails}`);
    console.log(`   Missing required date of birth: ${missingDateOfBirth}`);
    
    if (missingBankDetails > 0 || missingDateOfBirth > 0) {
      console.log(`\n⚠️  Some approved users are missing required data!`);
      console.log(`   Consider creating an admin endpoint to update this data.`);
    } else {
      console.log(`\n✅ All approved users have complete data!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

checkApprovedKYC();