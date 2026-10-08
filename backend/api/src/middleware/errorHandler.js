function errorHandler(err, req, res, next) {
  console.error(`[api] ${req.method} ${req.path}: ${err.message}`);
  if (err.name === "ValidationError")
    return res
      .status(400)
      .json({ error: "Validation error", details: err.message });
  if (err.code === 11000)
    return res
      .status(409)
      .json({ error: "A record with this unique value already exists" });
  return res
    .status(err.status || 500)
    .json({ error: err.publicMessage || "Internal server error" });
}
module.exports = { errorHandler };
