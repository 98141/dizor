const validator = require("validator");
const User = require("../models/user");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { logAuditEvent, safeLog } = require("../services/auditService");

const allowedRolesToCreate = ["admin", "vendedor"];

exports.createAdminUser = catchAsync(async (req, res, next) => {
  const { name, email, password, phone, role } = req.body;

  if (!name || !email || !password || !role) {
    return next(
      new AppError("Nombre, correo, contraseña y rol son obligatorios", 400)
    );
  }

  if (!allowedRolesToCreate.includes(role)) {
    return next(
      new AppError("Solo puedes crear usuarios con rol admin o vendedor", 400)
    );
  }

  if (!validator.isEmail(email)) {
    return next(new AppError("Correo inválido", 400));
  }

  if (password.length > 128) {
    return next(new AppError("La contraseña no puede superar 128 caracteres", 400));
  }

  if (
    !validator.isStrongPassword(password, {
      minLength: 8,
      minNumbers: 1,
      minSymbols: 1,
    })
  ) {
    return next(
      new AppError(
        "Contraseña débil. Usa mínimo 8 caracteres, un número y un símbolo.",
        400
      )
    );
  }

  const exists = await User.findOne({ email: email.toLowerCase() });

  if (exists) {
    return next(new AppError("El correo ya está registrado", 400));
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    phone,
    role,
  });

  safeLog(
    logAuditEvent({
      req,
      action: "staff_user_created",
      module: "users",
      user: req.user,
      entityId: user._id,
      entityType: "user",
      summary: `Usuario ${role} creado · ${user.email}`,
      newData: { email: user.email, role: user.role },
    })
  );

  res.status(201).json({
    status: "success",
    message: "Usuario administrativo creado correctamente",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
});

exports.getAdminUsers = catchAsync(async (req, res) => {
  const users = await User.find({
    role: { $in: ["admin", "vendedor"] },
  })
    .select("name email phone role isActive lastLoginAt createdAt")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: users.length,
    users,
  });
});

exports.updateAdminUserStatus = catchAsync(async (req, res, next) => {
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    return next(new AppError("El estado isActive debe ser true o false", 400));
  }

  const user = await User.findOne({
    _id: req.params.id,
    role: { $in: ["admin", "vendedor"] },
  });

  if (!user) {
    return next(new AppError("Usuario administrativo no encontrado", 404));
  }

  const wasActive = user.isActive;
  user.isActive = isActive;
  await user.save({ validateBeforeSave: false });

  safeLog(
    logAuditEvent({
      req,
      action: "staff_user_status_changed",
      module: "users",
      user: req.user,
      entityId: user._id,
      entityType: "user",
      summary: `${user.email} · ${isActive ? "activado" : "desactivado"}`,
      previousData: { isActive: wasActive },
      newData: { isActive },
    })
  );

  res.status(200).json({
    status: "success",
    message: isActive ? "Usuario activado" : "Usuario desactivado",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
});