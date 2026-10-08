const mongoose = require('mongoose');
const documentSchema = new mongoose.Schema({
  originalName: String, storedName: String, mimeType: String, size: Number, path: String, uploadedAt: { type: Date, default: Date.now }
}, { _id: true });
const schema = new mongoose.Schema({
  claimNumber: { type: String, required: true, unique: true, index: true },
  policyNumber: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  claimType: { type: String, enum: ['HEALTH', 'MOTOR', 'TRAVEL', 'PROPERTY'], required: true, index: true },
  status: { type: String, enum: ['NEW','UNDER_REVIEW','ADDITIONAL_INFO_REQUIRED','APPROVED','REJECTED','SETTLEMENT_IN_PROGRESS','CLOSED'], default: 'NEW', index: true },
  priority: { type: String, enum: ['LOW','MEDIUM','HIGH'], default: 'MEDIUM', index: true },
  incidentDate: Date,
  incidentDescription: String,
  claimedAmount: Number,
  supportingDocuments: [documentSchema],
  assessmentSummary: String
}, { timestamps: true });
schema.index({ status: 1, priority: 1, claimType: 1 });
module.exports = mongoose.model('Claim', schema);
