// Drop old invoiceNumber index after schema migration
// Run with: node scripts/drop-old-invoice-indexes.js

const { MongoClient } = require('mongodb');

async function dropOldIndexes() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/vestio');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const invoicesCollection = db.collection('invoices');
    
    // Get all indexes
    const indexes = await invoicesCollection.indexes();
    console.log('Current indexes:', indexes.map(idx => idx.name));
    
    // Drop the old invoiceNumber_1 index if it exists
    try {
      await invoicesCollection.dropIndex('invoiceNumber_1');
      console.log('✅ Dropped invoiceNumber_1 index');
    } catch (error) {
      if (error.message.includes('index not found')) {
        console.log('ℹ️  invoiceNumber_1 index not found (already dropped)');
      } else {
        console.error('❌ Error dropping invoiceNumber_1 index:', error.message);
      }
    }
    
    // List remaining indexes
    const remainingIndexes = await invoicesCollection.indexes();
    console.log('Remaining indexes:', remainingIndexes.map(idx => idx.name));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

dropOldIndexes().catch(console.error);