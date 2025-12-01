const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function dropUniqueIndex() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('predictions');

    // List all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    // Drop the old unique index on (gameId, userId) if it exists
    try {
      await collection.dropIndex('gameId_1_userId_1');
      console.log('✅ Dropped old unique index: gameId_1_userId_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index gameId_1_userId_1 does not exist (already removed)');
      } else {
        console.error('Error dropping index:', error);
      }
    }

    // Create the new compound index (non-unique) if it doesn't exist
    try {
      await collection.createIndex(
        { gameId: 1, userId: 1, predictedCarId: 1 },
        { name: 'gameId_1_userId_1_predictedCarId_1' }
      );
      console.log('✅ Created new compound index: gameId_1_userId_1_predictedCarId_1');
    } catch (error) {
      console.log('ℹ️  Index already exists or error:', error.message);
    }

    // Verify indexes
    const finalIndexes = await collection.indexes();
    console.log('\nFinal indexes:', finalIndexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique
    })));

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dropUniqueIndex();

