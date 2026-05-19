const User = require("../models/user");
const Order = require("../models/order");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { hashToken } = require("../utils/cryptoUtils");
const { logAuthEvent } = require("../services/auditService");
const { sendPasswordResetEmail } = require("../services/emailService");
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

const formatAddress = (addr) => ({
  id: addr._id,
  label: addr.label,
  address: addr.address,
  city: addr.city,
  department: addr.department,
  postalCode: addr.postalCode || "",
  isDefault: addr.isDefault,
});

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || "",
  shippingAddresses: (user.shippingAddresses || []).map(formatAddress),
});

const sendAuthResponse = async (user, statusCode, res) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = hashToken(refreshToken);
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
    user: formatUser(user),
  });
};

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

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

  // Vincular pedidos de invitado que usaron este mismo correo
  await Order.updateMany(
    { "buyer.email": email.toLowerCase(), user: null },
    { $set: { user: user._id } }
  );

  await logAuthEvent({
    req,
    action: "register",
    user,
    success: true,
  });

  await sendAuthResponse(user, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password +refreshToken +failedLoginAttempts +accountLockedUntil"
  );

  if (!user) {
    await logAuthEvent({
      req,
      action: "login_failed",
      success: false,
    });
    return next(new AppError("Credenciales inválidas", 401));
  }

  if (user.isAccountLocked()) {
    return next(
      new AppError(
        "Cuenta bloqueada temporalmente por intentos fallidos. Intenta en 15 minutos.",
        429
      )
    );
  }

  if (!(await user.comparePassword(password, user.password))) {
    await user.registerFailedLogin();
    await logAuthEvent({
      req,
      action: "login_failed",
      user,
      success: false,
    });
    return next(new AppError("Credenciales inválidas", 401));
  }

  if (!user.isActive) {
    return next(new AppError("Usuario inactivo", 403));
  }

  await user.resetLoginAttempts();

  // Vincular pedidos de invitado que usaron este mismo correo
  await Order.updateMany(
    { "buyer.email": user.email.toLowerCase(), user: null },
    { $set: { user: user._id } }
  );

  await logAuthEvent({
    req,
    action: "login",
    user,
    success: true,
  });

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

  if (!user || user.refreshToken !== hashToken(token)) {
    return next(new AppError("Refresh token inválido", 401));
  }

  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  user.refreshToken = hashToken(newRefreshToken);
  await user.save({ validateBeforeSave: false });

  res.cookie("accessToken", accessToken, {
    ...cookieOptions(),
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", newRefreshToken, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    status: "success",
    user: formatUser(user),
  });
});

exports.logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    const hashedToken = hashToken(token);
    const user = await User.findOne({ refreshToken: hashedToken });

    await User.findOneAndUpdate(
      { refreshToken: hashedToken },
      { refreshToken: null }
    );

    if (user) {
      await logAuthEvent({
        req,
        action: "logout",
        user,
        success: true,
      });
    }
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
      ...formatUser(user),
      createdAt: user.createdAt,
    },
  });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  const { name, phone } = req.body;

  if (name?.trim()) user.name = name.trim();
  if (phone !== undefined) user.phone = String(phone).trim();

  await user.save();

  res.status(200).json({
    status: "success",
    user: formatUser(user),
  });
});

exports.addAddress = catchAsync(async (req, res, next) => {
  const { label, address, city, department, postalCode, isDefault } = req.body;

  if (!address?.trim() || !city?.trim() || !department?.trim()) {
    return next(
      new AppError("Dirección, ciudad y departamento son obligatorios", 400)
    );
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  if (isDefault || user.shippingAddresses.length === 0) {
    user.shippingAddresses.forEach((a) => {
      a.isDefault = false;
    });
  }

  user.shippingAddresses.push({
    label: label?.trim() || "Casa",
    address: address.trim(),
    city: city.trim(),
    department: department.trim(),
    postalCode: postalCode?.trim() || "",
    isDefault: Boolean(isDefault) || user.shippingAddresses.length === 0,
  });

  await user.save();

  res.status(201).json({
    status: "success",
    addresses: user.shippingAddresses.map(formatAddress),
  });
});

exports.updateAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  const addr = user.shippingAddresses.id(req.params.addressId);

  if (!addr) {
    return next(new AppError("Dirección no encontrada", 404));
  }

  const { label, address, city, department, postalCode, isDefault } = req.body;

  if (label !== undefined) addr.label = label.trim() || addr.label;
  if (address !== undefined) addr.address = address.trim();
  if (city !== undefined) addr.city = city.trim();
  if (department !== undefined) addr.department = department.trim();
  if (postalCode !== undefined) addr.postalCode = postalCode.trim();

  if (isDefault) {
    user.shippingAddresses.forEach((a) => {
      a.isDefault = false;
    });
    addr.isDefault = true;
  }

  await user.save();

  res.status(200).json({
    status: "success",
    addresses: user.shippingAddresses.map(formatAddress),
  });
});

exports.deleteAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  const addr = user.shippingAddresses.id(req.params.addressId);

  if (!addr) {
    return next(new AppError("Dirección no encontrada", 404));
  }

  const wasDefault = addr.isDefault;
  addr.deleteOne();

  if (wasDefault && user.shippingAddresses.length > 0) {
    user.shippingAddresses[0].isDefault = true;
  }

  await user.save();

  res.status(200).json({
    status: "success",
    addresses: user.shippingAddresses.map(formatAddress),
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const resetUrl = `${clientUrl}/restablecer/${resetToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    await logAuthEvent({
      req,
      action: "password_reset_requested",
      user,
      success: true,
    });
  }

  res.status(200).json({
    status: "success",
    message:
      "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.",
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = hashToken(req.params.token);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select("+passwordResetToken +passwordResetExpires");

  if (!user) {
    return next(new AppError("Token inválido o expirado", 400));
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = null;
  await user.save();

  await logAuthEvent({
    req,
    action: "password_reset",
    user,
    success: true,
  });

  await sendAuthResponse(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select(
    "+password +refreshToken"
  );

  if (
    !(await user.comparePassword(req.body.currentPassword, user.password))
  ) {
    return next(new AppError("La contraseña actual es incorrecta", 401));
  }

  user.password = req.body.password;
  user.refreshToken = null;
  await user.save();

  await logAuthEvent({
    req,
    action: "password_updated",
    user,
    success: true,
  });

  await sendAuthResponse(user, 200, res);
});
