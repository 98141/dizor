const express = require("express");
const controller = require("../controllers/customerRequestController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

// Incluye solicitudes de titulares de datos: solo administradores.
router.use(protect);
router.use(authorizeRoles("superadmin", "admin"));

router.get("/", controller.adminList);
router.get("/:id", controller.adminGet);
router.patch("/:id/status", controller.adminUpdateStatus);

module.exports = router;
