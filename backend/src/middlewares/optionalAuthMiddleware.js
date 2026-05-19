const jwt = require("jsonwebtoken");
const User = require("../models/user");
const catchAsync = require("../utils/catchAsync");
const { isValidObjectId } = require("../utils/objectIdUtils");

exports.optionalAuth = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user =
      decoded?.id && isValidObjectId(decoded.id)
        ? await User.findById(decoded.id)
        : null;

    if (user && user.isActive) {
      req.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }
  } catch {
    // Sin sesión válida: continuar como invitado
  }

  next();
});
