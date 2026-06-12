const crypto = require("crypto");

const hashPassword = (password) =>
  crypto.createHash("sha512").update(password).digest("hex");

module.exports = { hashPassword };
