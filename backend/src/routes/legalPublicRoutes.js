const express = require("express");
const { getPublicNotices } = require("../config/legalTexts");

const router = express.Router();

// Textos de aviso/autorización que muestran los formularios. El frontend
// muestra exactamente este texto y el servidor registra esta misma versión.
router.get("/notices", (req, res) => {
  res.status(200).json({ status: "success", notices: getPublicNotices() });
});

module.exports = router;
