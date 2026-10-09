const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuid } = require("uuid");
const Claim = require("../models/Claim");
const env = require("../config/env");
const s3 = new S3Client({
  region: env.aws.region,
  credentials: {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey,
    sessionToken: env.aws.sessionToken,
  },
});
async function saveDocument(claimId, file, user) {
  const claim = await Claim.findById(claimId);
  if (!claim) {
    const e = new Error("Claim not found");
    e.status = 404;
    throw e;
  }
  const storedName = `${uuid()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const destination = `claims/${claimId}/${storedName}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: destination,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );
  const doc = {
    originalName: file.originalname,
    storedName,
    mimeType: file.mimetype,
    size: file.size,
    path: destination,
  };
  claim.supportingDocuments.push(doc);
  claim.timeline.push({
    event: "DOCUMENT_UPLOADED",
    message: `Document uploaded: ${file.originalname}`,
    actor: { id: user.sub, name: user.name, role: user.role },
  });
  await claim.save();
  const { path: _omit, ...saved } = claim.supportingDocuments.at(-1).toObject();
  return saved;
}
// Caller must have already verified access to the claim.
async function getDownloadUrl(claim, docId) {
  const doc = claim.supportingDocuments.id(docId);
  if (!doc) {
    const e = new Error("Document not found");
    e.status = 404;
    e.publicMessage = e.message;
    throw e;
  }
  const filename = doc.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.aws.bucket,
      Key: doc.path,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: 300 },
  );
  return { url, name: doc.originalName };
}
module.exports = { saveDocument, getDownloadUrl };
