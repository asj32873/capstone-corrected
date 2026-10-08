const mongoose = require('mongoose');
const env = require('./env');
async function connectDB() {
  if (!env.mongoUri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(env.mongoUri);
  console.log('[api] MongoDB Atlas connected');
}
module.exports = { connectDB };
