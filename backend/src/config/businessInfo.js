// Datos del vendedor confirmados por el propietario (2026-11-16).
// Fuente única para correos y textos generados por el backend.
// El frontend tiene su espejo en frontend/src/lib/businessInfo.js: si cambia
// un dato, debe cambiarse en ambos (ver docs/auditoria-privacidad/07-…).
//
// - "DIZOR" es la MARCA; quien vende y factura es la sociedad.
// - La dirección es la registrada en el RUT. No se ha confirmado que sea
//   también bodega, punto de recogida ni dirección para devoluciones.
const BUSINESS = Object.freeze({
  brand: "DIZOR",
  legalName: "COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS",
  nit: "901.027.825-5",
  registeredAddress: "CR 5 02 50 BRR NARANJAL, Sandoná, Nariño, Colombia",
  email: "dizorsandona@gmail.com",
  // Número operativo ya configurado en el sitio (frontend/src/lib/whatsapp.js).
  whatsapp: "573159162520",
  attentionHours: "lunes a viernes, en horario laboral",
});

module.exports = { BUSINESS };
