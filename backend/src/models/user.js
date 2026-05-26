const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const { hashToken, createRandomToken } = require("../utils/cryptoUtils");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
      maxlength: [100, "El nombre no puede superar 100 caracteres"],
    },

    email: {
      type: String,
      required: [true, "El correo es obligatorio"],
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Correo inválido"],
    },

    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: [8, "La contraseña debe tener mínimo 8 caracteres"],
      select: false,
    },

    role: {
      type: String,
      enum: ["superadmin", "admin", "vendedor", "cliente"],
      default: "cliente",
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [30, "El teléfono no puede superar 30 caracteres"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    refreshToken: {
      type: String,
      select: false,
      default: null,
    },

    passwordChangedAt: Date,

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    accountLockedUntil: {
      type: Date,
      default: null,
      select: false,
    },

    shippingAddresses: {
      type: [
        {
          label: { type: String, trim: true, maxlength: 60, default: "Casa" },
          address: { type: String, required: true, trim: true, maxlength: 200 },
          city: { type: String, required: true, trim: true, maxlength: 80 },
          department: { type: String, required: true, trim: true, maxlength: 80 },
          postalCode: { type: String, trim: true, maxlength: 20, default: "" },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);

  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }
});

userSchema.methods.comparePassword = async function (
  candidatePassword,
  userPassword
) {
  return bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return jwtTimestamp < changedTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = createRandomToken();

  this.passwordResetToken = hashToken(resetToken);
  this.passwordResetExpires = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

userSchema.methods.isAccountLocked = function () {
  return this.accountLockedUntil && this.accountLockedUntil > Date.now();
};

userSchema.methods.registerFailedLogin = async function () {
  this.failedLoginAttempts += 1;

  if (this.failedLoginAttempts >= 5) {
    this.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    // No se resetea el contador: cada intento fallido tras el lockout
    // renueva el bloqueo inmediatamente hasta que se inicie sesión correctamente.
  }

  await this.save({ validateBeforeSave: false });
};

userSchema.methods.resetLoginAttempts = async function () {
  if (this.failedLoginAttempts > 0 || this.accountLockedUntil) {
    this.failedLoginAttempts = 0;
    this.accountLockedUntil = null;
    await this.save({ validateBeforeSave: false });
  }
};

module.exports = mongoose.model("User", userSchema);
