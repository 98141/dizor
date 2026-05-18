const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");

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
  },
  { timestamps: true },
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
  userPassword,
) {
  return bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );

    return jwtTimestamp < changedTimestamp;
  }

  return false;
};

module.exports = mongoose.model("User", userSchema);
