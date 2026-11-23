# Diff final atribuible al cierre

Diff exacto contra las copias iniciales: `evidencias/cierre-residuales.diff`. SHA finales: `codigo-final-sha256.json`. El diff global del árbol contiene trabajo paralelo previo y no es el diff de esta intervención.

| Archivo | Líneas relevantes | Hallazgo y alcance |
|---|---|---|
| backend/src/controllers/orderAdminController.js | 228, 237, 249, 253, 260, 283 | NR-01 recalcular al resolver fallos; NR-02 distinguir identidad; NR-03 vistas/acciones/deber de reapertura |
| backend/src/services/wompiPaymentService.js | 140, 142, 214, 222, 228 | NR-02 fecha inicial transaccional y mensajes de reconsulta |
| backend/src/models/paymentEvent.js | 18 | NR-03 metadata administrativa opcional, separada de processedAt |
| backend/src/services/paymentEventArchive.js (nuevo) | 7, 11, 17, 22, 58 | NR-03 filtros, autorización, auditoría transaccional, elegibilidad, archivo/reapertura |
| backend/src/controllers/adminAlertController.js | 42, 47 | NR-03 separar bandeja y seguimiento financiero; ambos contados |
| backend/src/routes/adminOrderRoutes.js | 19, 20 | NR-03 dos acciones protegidas por rol |
| frontend/src/components/admin/PaymentEventAlerts.jsx | 8, 17, 26, 39, 44 | NR-03 formularios mínimos, motivo/evidencia, seguimiento/reapertura, contadores |
| frontend/src/services/orderAdminService.js | 8, 10, 11 | NR-03 acceso a vistas y acciones |
| frontend/src/app/admin/alertas/page.js | 162 | NR-03 pasar grupo de seguimiento |

Ocho archivos existentes modificados y un servicio nuevo. Las pruebas específicas y la evidencia se agregan bajo cierre-residuales. Ninguna fuente/test original se sustituye por un “fix” de expectativas; la variante D vive aparte y declara sus dos inserciones de flujo.

`evidencias/preservacion.json` verifica los 4216 hashes iniciales: únicamente las ocho fuentes anteriores cambian; no hay eliminaciones ni cambios ajenos sobrescritos. El archivo nuevo y los artefactos de esta carpeta no existían en esa línea base. Se conserva el estado sucio inicial de checkout, municipios y auditoría Claude-2. No se atribuyen ni certifican esos cambios.

No se modifica wompiService, firma/checksum, consulta privada, asociación, importe, política de estados, política de stock/cupones, contraentrega ni páginas de checkout. No se modifican dependencias, colecciones, configuración productiva ni credenciales. No hubo commit, push ni despliegue.
