const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['CLAIMS_OFFICER', 'CLAIMS_MANAGER'], default: 'CLAIMS_OFFICER' }
}, { timestamps: true });
module.exports = mongoose.model('User', schema);
