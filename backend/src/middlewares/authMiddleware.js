const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const protect = catchAsync(async (req, res, next) => {
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
    return next(new AppError("No has iniciado sesión", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded.id).select(
    "+refreshToken"
  );

  if (!currentUser) {
    return next(new AppError("El usuario ya no existe", 401));
  }

  if (!currentUser.isActive) {
    return next(new AppError("Usuario inactivo", 403));
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("La contraseña fue cambiada recientemente. Inicia sesión nuevamente.", 401)
    );
  }

  req.user = {
    id: currentUser._id,
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role,
  };

  next();
});

module.exports = {
  protect,
};