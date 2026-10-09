const authService = require("../services/authService");
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};
const login = wrap(async (req, res) =>
  res.json(await authService.login(req.body.email, req.body.password)),
);
const register = wrap(async (req, res) =>
  res.status(201).json(await authService.register(req.body)),
);
const createOfficer = wrap(async (req, res) =>
  res.status(201).json(await authService.createOfficer(req.body)),
);
const listOfficers = wrap(async (req, res) =>
  res.json(await authService.listOfficers()),
);
module.exports = { login, register, createOfficer, listOfficers };
