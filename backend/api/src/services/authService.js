const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  e.publicMessage = message;
  return e;
};
const publicUser = (u) => ({
  id: u._id,
  email: u.email,
  name: u.name,
  role: u.role,
});
const sign = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

function validateNewUser({ name, email, password }) {
  if (!String(name || "").trim()) throw fail(400, "name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "")))
    throw fail(400, "A valid email is required");
  if (String(password || "").length < 8)
    throw fail(400, "Password must be at least 8 characters");
}

async function createUser(body, role) {
  validateNewUser(body);
  const email = String(body.email).toLowerCase().trim();
  if (await User.exists({ email }))
    throw fail(409, "An account with this email already exists");
  return User.create({
    email,
    name: String(body.name).trim(),
    role,
    passwordHash: await bcrypt.hash(String(body.password), 12),
  });
}

async function login(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (
    !user ||
    !user.active ||
    !(await bcrypt.compare(String(password), user.passwordHash))
  )
    throw fail(401, "Invalid email or password");
  return { token: sign(user), user: publicUser(user) };
}

// Self-registration only ever creates customers.
async function register(body) {
  const user = await createUser(body, "CUSTOMER");
  return { token: sign(user), user: publicUser(user) };
}

async function createOfficer(body) {
  return publicUser(await createUser(body, "CLAIMS_OFFICER"));
}

async function listOfficers() {
  const officers = await User.find({ role: "CLAIMS_OFFICER" })
    .select("name email active lastAssignedAt createdAt")
    .sort({ createdAt: 1 })
    .lean();
  return { items: officers };
}

module.exports = { login, register, createOfficer, listOfficers };
