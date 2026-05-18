const User = require("../models/user");
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

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || "",
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
    user: formatUser(user),
  });
});

exports.logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    const user = await User.findOne({ refreshToken: token });

    await User.findOneAndUpdate(
      { refreshToken: token },
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
