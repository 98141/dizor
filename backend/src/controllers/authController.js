const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/generateToken");

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

const sendAuthResponse = async (user, statusCode, res) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.cookie("accessToken", accessToken, {
    ...cookieOptions(),
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(statusCode).json({
    status: "success",
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
    },
  });
};

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return next(new AppError("Nombre, correo y contraseña son obligatorios", 400));
  }

  const exists = await User.findOne({ email: email.toLowerCase() });

  if (exists) {
    return next(new AppError("El correo ya está registrado", 400));
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: "cliente",
  });

  await sendAuthResponse(user, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Correo y contraseña son obligatorios", 400));
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password +refreshToken"
  );

  if (!user || !(await user.comparePassword(password, user.password))) {
    return next(new AppError("Credenciales inválidas", 401));
  }

  if (!user.isActive) {
    return next(new AppError("Usuario inactivo", 403));
  }

  await sendAuthResponse(user, 200, res);
});

exports.refreshToken = catchAsync(async (req, res, next) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return next(new AppError("Refresh token requerido", 401));
  }

  const jwt = require("jsonwebtoken");

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return next(new AppError("Refresh token inválido o expirado", 401));
  }

  const user = await User.findById(decoded.id).select("+refreshToken");

  if (!user || user.refreshToken !== token) {
    return next(new AppError("Refresh token inválido", 401));
  }

  const accessToken = generateAccessToken(user);

  res.cookie("accessToken", accessToken, {
    ...cookieOptions(),
    maxAge: 15 * 60 * 1000,
  });

  res.status(200).json({
    status: "success",
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
    },
  });
});

exports.logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    await User.findOneAndUpdate(
      { refreshToken: token },
      { refreshToken: null }
    );
  }

  res.clearCookie("accessToken", cookieOptions());
  res.clearCookie("refreshToken", cookieOptions());

  res.status(200).json({
    status: "success",
    message: "Sesión cerrada correctamente",
  });
});

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
      createdAt: user.createdAt,
    },
  });
});