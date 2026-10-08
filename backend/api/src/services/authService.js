const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
async function login(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const e = new Error('Invalid credentials'); e.status = 401; e.publicMessage = 'Invalid email or password'; throw e;
  }
  const token = jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role, name: user.name }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  return { token, user: { id: user._id, email: user.email, name: user.name, role: user.role } };
}
module.exports = { login };
