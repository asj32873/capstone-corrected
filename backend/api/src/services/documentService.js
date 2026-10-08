const fs = require('fs/promises');
const path = require('path');
const { v4: uuid } = require('uuid');
const Claim = require('../models/Claim');
const uploadRoot = path.resolve(process.cwd(), 'uploads');
async function saveDocument(claimId, file) {
  const claim = await Claim.findById(claimId);
  if (!claim) { const e = new Error('Claim not found'); e.status = 404; throw e; }
  const dir = path.join(uploadRoot, claimId.toString());
  await fs.mkdir(dir, { recursive: true });
  const storedName = `${uuid()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const destination = path.join(dir, storedName);
  await fs.writeFile(destination, file.buffer);
  const doc = { originalName: file.originalname, storedName, mimeType: file.mimetype, size: file.size, path: destination };
  claim.supportingDocuments.push(doc); await claim.save();
  return claim.supportingDocuments.at(-1).toObject();
}
module.exports = { saveDocument };
