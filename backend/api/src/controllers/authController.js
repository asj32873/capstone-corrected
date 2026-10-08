const authService = require('../services/authService');
async function login(req, res, next) { try { res.json(await authService.login(req.body.email, req.body.password)); } catch (e) { next(e); } }
module.exports = { login };
