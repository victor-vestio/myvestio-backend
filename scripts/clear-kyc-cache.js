const mongoose = require('mongoose');
const Redis = require('redis');
require('dotenv').config();

// Import models
const { KYC } = require('../dist/models/KYC');

async function clearKYCCache() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Connect to Redis
    const redisClient = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    console.log('✅ Connected to Redis');

    // Find all approved KYC records
    const approvedKYCs = await KYC.find({ status: 'approved' });
    console.log(`📊 Found ${approvedKYCs.length} approved KYC records`);

    let clearedCount = 0;
    
    for (const kyc of approvedKYCs) {
      const cacheKey = `kyc:status:${kyc.userId}`;
      
      // Check if cache exists
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        // Clear the cache
        await redisClient.del(cacheKey);
        console.log(`🗑️  Cleared cache for user: ${kyc.userId}`);
        clearedCount++;
      } else {
        console.log(`ℹ️  No cache found for user: ${kyc.userId}`);
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total approved KYCs: ${approvedKYCs.length}`);
    console.log(`   Cache entries cleared: ${clearedCount}`);
    console.log(`\n✅ Cache cleared! Next API calls will return fresh data with bank details.`);
    
    await redisClient.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

clearKYCCache();