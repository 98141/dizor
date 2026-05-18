const jwt = require("jsonwebtoken");

const signToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, {
    expiresIn,
    algorithm: "HS256",
  });
};

const generateAccessToken = (user) => {
  return signToken(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    process.env.JWT_EXPIRES_IN || "15m"
  );
};

const generateRefreshToken = (user) => {
  return signToken(
    {
      id: user._id,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES_IN || "7d"
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};