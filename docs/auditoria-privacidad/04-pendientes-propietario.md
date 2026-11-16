# D. Pendientes del propietario (sección E actualizada)

Fecha: 2026-11-16. Se conservan los identificadores originales E-1 a E-14. Los añadidos van al final (E-15 en adelante) y se marcan como **nuevos**.

**Ninguna celda contiene datos inventados.** Lo que falta aparece como "pendiente".

| # | Dato | ¿Hay evidencia en el proyecto? | Qué bloquea |
|---|---|---|---|
| E-1 | Identidad legal del vendedor y del responsable: persona natural o jurídica, nombre o razón social, NIT, dirección de notificación judicial | **No.** El dominio, la marca, el autor de Git y el crédito del pie de página **no** prueban la identidad legal; no se usaron | Política de privacidad (H-01), identificación del vendedor (H-15), términos (H-17), aprobación de todos los textos de `legalTexts.js` (H-03), RNBD (H-26), pie del acuse de recibo |
| E-2 | Correo o canal oficial para derechos y PQR, y área o persona que lo atiende | Solo existe el WhatsApp comercial (`lib/whatsapp.js`). No hay correo de atención publicado | Activar PQR (`PQR_PUBLIC_ENABLED`, H-22), canal de derechos (H-11), PLACEHOLDER de las políticas de privacidad y cookies (H-01, H-10) |
| E-3 | Contratos o condiciones aceptadas con MongoDB Atlas, Resend, Cloudinary, hosting, Wompi y Nequi; región de alojamiento | Solo el uso técnico. Atlas: hosts `*.mongodb.net` en el `.env` local, sin región ni plan | Política (H-02), registro de encargados y transferencias (H-13) |
| E-4 | Proveedor de hosting del sitio y de la API; retención de sus logs | Solo la cabecera `server: LiteSpeed` | Evaluar la exposición histórica de correos en URLs (H-06), conservación (H-12), H-13 |
| E-5 | Finalidades que el negocio mantiene: newsletter, recordatorios, reseñas públicas, prellenado del registro tras la compra. **Nuevo:** ¿ofrecer el recordatorio de carrito (con casilla) también a usuarios registrados? | Las funciones existen; la decisión no consta | Aprobar los textos de `marketing_*` y `review_publication` (H-03, H-04, H-05, H-14) |
| E-6 | Plazos de conservación por tipo de dato (pedidos, facturas, cuentas, suscriptores, carritos, PQR, auditoría, evidencias de autorización) | No | Purga y conservación (H-12), supresión de cuentas y procedimiento de derechos (H-11), conservación de `AuditLog` (H-28), política (H-01) |
| E-7 | Fecha de vigencia de la política y forma de comunicar los cambios | No | H-01; criterio para subir versiones en `legalTexts.js` y `CONSENT_VERSION` |
| E-8 | Herramienta de envío de la newsletter; si el script de recordatorios corre en producción y con qué frecuencia | No hay programador en el repositorio | Integrar la baja y la supresión en la herramienta externa (H-04); programar recordatorios respetando la franja (H-05) |
| E-9 | Si se usará Google Analytics; acceso a la propiedad (Enhanced Measurement, retención, señales) | **Parcial:** GA inactivo en producción (bundle sin ID, 2026-11-16) | Activar GA y validar la CSP (H-09); controlar Enhanced Measurement (H-08) |
| E-10 | Plazos reales de fabricación y entrega por zona; qué productos son realmente personalizados; si hay cambios voluntarios | No. La página "Envíos" dice "dependen de la ciudad" | `ORDER_DELIVERY_TIME_TEXT` y plazo en el checkout (H-19, H-20, H-21); términos (H-17); retracto y excepciones (H-18) |
| E-11 | Respaldo de los testimonios de marca, de "comercio justo" y del origen artesanal; licencias de las fotos | No | H-14 (respaldo de reseñas de marca), H-23 |
| E-12 | Commit o versión desplegada del backend y del frontend; `NEXT_PUBLIC_GA_MEASUREMENT_ID` | **Parcial:** el backend de producción es anterior a `52bbcc8` (ver `02-informe-implementacion.md` §1.2); GA sin ID en el bundle | Reconciliar H-24; diseñar el despliegue (H-06, H-20 y H-05 en la versión real) |
| E-13 | Si es sociedad: activos totales | No | H-26 (umbral de 100.000 UVT, Decreto 090/2018) |
| E-14 | Venta, actual o prevista, a consumidores fuera de Colombia | El sitio solo admite departamentos de Colombia y COP | Necesidad de evaluar otras jurisdicciones |
| E-15 (nuevo) | Secreto `MARKETING_TOKEN_SECRET` (≥32 caracteres aleatorios) para los enlaces de baja, gestionado como secreto de producción | Ausente a propósito: no se crea ni se guarda en el repositorio | Sin él no se envía **ningún** recordatorio comercial (falla de forma cerrada) y la exportación no incluye `unsubscribeUrl` |
| E-16 (nuevo) | Calendario de festivos de Colombia para la franja de contacto, si el abogado confirma que aplica la Ley 2300 | No | `MARKETING_BLOCKED_DATES` (H-05) |
| E-17 (nuevo) | Decisión jurídica sobre si la evidencia de autorización debe incluir IP o user-agent (hoy no se guardan, por minimización) | No | Diseño final de `ConsentRecord` (H-03) |

## Qué bloquea qué (vista inversa)

| Funcionalidad o documento | Bloqueado por |
|---|---|
| Publicar los textos de autorización (pasar `draft` → `approved`) | E-1, E-2, E-5, E-17 y abogado |
| Publicar la Política de Privacidad sin PLACEHOLDER | E-1, E-2, E-3, E-4, E-6, E-7 y abogado |
| Publicar la Política de Cookies sin PLACEHOLDER | E-2 |
| Activar PQR | E-2 (y procedimiento interno con plazos: abogado) |
| Términos y condiciones | E-1, E-10 y abogado |
| Garantía, retracto, reversión y cambios | E-10 y abogado |
| Acuse completo (con tiempo de entrega) | E-10 |
| Recordatorios comerciales en producción | E-8, E-15, E-16 y abogado (Ley 2300) |
| Activar GA | E-9 |
| Desplegar | E-12 (versión real) y las anteriores según lo que se quiera publicar |
