const { body } = require("express-validator");

exports.registerRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio")
    .isLength({ max: 100 })
    .withMessage("El nombre no puede superar 100 caracteres"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio")
    .isEmail()
    .withMessage("Correo inválido")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("La contraseña es obligatoria")
    .isLength({ min: 8, max: 128 })
    .withMessage("La contraseña debe tener entre 8 y 128 caracteres")
    .matches(/[0-9]/)
    .withMessage("La contraseña debe incluir al menos un número"),
  body("phone")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 30 })
    .withMessage("El teléfono no puede superar 30 caracteres"),
];

exports.loginRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio")
    .isEmail()
    .withMessage("Correo inválido")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("La contraseña es obligatoria")
    .isLength({ max: 128 })
    .withMessage("Credenciales inválidas"),
];

exports.forgotPasswordRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio")
    .isEmail()
    .withMessage("Correo inválido")
    .normalizeEmail(),
];

exports.resetPasswordRules = [
  body("password")
    .notEmpty()
    .withMessage("La contraseña es obligatoria")
    .isLength({ min: 8, max: 128 })
    .withMessage("La contraseña debe tener entre 8 y 128 caracteres")
    .matches(/[0-9]/)
    .withMessage("La contraseña debe incluir al menos un número")
    .matches(/[^a-zA-Z0-9]/)
    .withMessage("La contraseña debe incluir al menos un símbolo especial"),
  body("passwordConfirm")
    .notEmpty()
    .withMessage("Debes confirmar la contraseña")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Las contraseñas no coinciden");
      }
      return true;
    }),
];

exports.updatePasswordRules = [
  body("currentPassword")
    .notEmpty()
    .withMessage("La contraseña actual es obligatoria"),
  body("password")
    .notEmpty()
    .withMessage("La nueva contraseña es obligatoria")
    .isLength({ min: 8, max: 128 })
    .withMessage("La contraseña debe tener entre 8 y 128 caracteres")
    .matches(/[0-9]/)
    .withMessage("La contraseña debe incluir al menos un número")
    .matches(/[^a-zA-Z0-9]/)
    .withMessage("La contraseña debe incluir al menos un símbolo especial"),
  body("passwordConfirm")
    .notEmpty()
    .withMessage("Debes confirmar la contraseña")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Las contraseñas no coinciden");
      }
      return true;
    }),
];
