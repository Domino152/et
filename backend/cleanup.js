const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Receipt = require('./models/Receipt');

dotenv.config();

const DB_URI = process.env.MONGODB_URI;

if (!DB_URI) {
  console.error('MONGODB_URI not found in .env');
  process.exit(1);
}

console.log('Connecting to MongoDB for cleanup...');
mongoose.connect(DB_URI)
  .then(async () => {
    console.log('Connected. Deleting all receipts...');
    const result = await Receipt.deleteMany({});
    console.log(`Deleted ${result.deletedCount} documents.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error during cleanup:', err);
    process.exit(1);
  });
