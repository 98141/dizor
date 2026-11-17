# D. Pendientes del propietario (sección E consolidada)

Actualizado: 2026-11-16 (fase 3). Se conservan los identificadores E-1 a E-18 y se añaden E-19 a E-26.

**Ninguna celda contiene datos inventados.** Los datos recibidos en la fase 3 vienen de la instrucción escrita del propietario (detalle y procedencia en `07-guia-revision-juridica.md` §1).

## Estado de los pendientes

| # | Dato requerido | Estado (fase 3) | Qué falta | Qué bloquea |
|---|---|---|---|---|
| E-1 | Identidad legal del vendedor y responsable | **Recibido**: COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS, NIT 901.027.825-5, dirección del RUT | Confirmar que la sociedad decide las finalidades (07 J-1) y la dirección de notificación judicial (J-2) | Revisión jurídica de los textos |
| E-2 | Canal oficial y quién lo atiende | **Recibido**: dizorsandona@gmail.com, WhatsApp operativo, Roger Parra (lunes a viernes, horario laboral) | Probar el buzón; autorizar (o no) el acceso de Roger al panel; definir `ADMIN_NOTIFY_EMAIL` | Activar PQR |
| E-3 | Contratos y regiones de los proveedores | **Parcial**: continúan HostingLabs/cPanel y MongoDB Atlas | Regiones, contratos; confirmar si se usan Resend y Cloudinary | Política de datos (J-6), registro de encargados |
| E-4 | Hosting y retención de sus logs | **Parcial**: HostingLabs (cPanel) | Retención de logs del hosting; evaluación de la exposición histórica (H-06) | H-06, H-12 |
| E-5 | Finalidades que se mantienen | **Recibido**: newsletter voluntaria sí; recordatorios preparados pero desactivados; reseñas con autorización, sin fotos | — | — |
| E-6 | Plazos de conservación | **Situación informada**: hoy no se elimina nada | Plazos por categoría (07 §5) con abogado y contador | H-11, H-12 |
| E-7 | Vigencia de los textos | Pendiente | Fecha de entrada en vigor al publicar (`NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE`) | Mostrar "Vigente desde" |
| E-8 | Herramienta de envío de la newsletter | Pendiente | Cuál se usa y si respeta la lista de supresión | Envíos de newsletter |
| E-9 | ¿Google Analytics? | **Decidido**: apagado | — | — |
| E-10 | Plazos de entrega, personalizados, cambios | **Parcial**: referencias 4–6 y ~15 días hábiles; personalización por producto; regla de cambios voluntarios | Definir qué cubre el plazo, su inicio (Wompi vs. contraentrega) y si es total (07 J-8) | **Publicar el plazo; acuse completo** |
| E-11 | Respaldo de testimonios y afirmaciones | **Parcial**: reseñas con autorización | Respaldo de la reseña publicada como "Dizor" y de afirmaciones del CMS | H-14, H-23 |
| E-12 | Versión desplegada | Pendiente (acotada en `02-…` §5.2) | Commit exacto o copia del código desplegado | Despliegue |
| E-13 | Activos totales | Pendiente | Valor | RNBD (J-12) |
| E-14 | Ventas fuera de Colombia | **Recibido**: solo Colombia | — | — |
| E-15 | `MARKETING_TOKEN_SECRET` de producción | Pendiente (guía abajo) | Generarlo en el servidor | Enlaces de baja en exportaciones |
| E-16 | Festivos (Ley 2300) | Pendiente | Solo si se reactivan recordatorios | — |
| E-17 | ¿IP o user-agent en la evidencia? | Pendiente | Decisión jurídica | Diseño de `ConsentRecord` |
| E-18 | `NEQUI_ENV` en producción | **Decidido**: desactivar Nequi | Ejecutar la contención de `06-…` §7.1 (autorización aparte) y verificarla | **V-01 sigue abierto en producción** |
| **E-19** | ¿La transportadora ofrece contraentrega en todos los destinos? | Nuevo | Cobertura de contraentrega de Inter Rapidísimo y Servientrega por destino | El checkout ofrece contraentrega en todo el país (riesgo de prometer algo no disponible) |
| **E-20** | Dirección de devoluciones / recogida | Nuevo | Dirección o procedimiento (los textos dicen "te indicaremos la dirección") | Operación de retracto y garantía |
| **E-21** | Comparación del WhatsApp operativo con el teléfono del RUT | Nuevo | Confirmar si coinciden o cuál publicar como teléfono del vendedor | Identificación completa (art. 50 lit. a) |
| **E-22** | Conciliación de pedidos Nequi históricos | Nuevo | Que un operador autorizado ejecute `06-…` §7.2 contra el extracto real de Nequi | Riesgo de pedidos entregados sin cobro (V-01) |
| **E-23** | Cambiar el modo de envío en la BD de producción a "Incluido en el precio" | Nuevo (opcional) | El código ya lo aplica por defecto; cambiarlo en el panel deja la configuración coherente | — |
| **E-24** | Despublicar en el CMS las páginas antiguas "envios" y "cambios" | Nuevo | Hacerlo tras desplegar (no borrarlas) | Coherencia de contenidos |
| **E-25** | Opciones de personalización por producto | Nuevo | Revisar `customizationOptions` frente a lo que realmente se ofrece (07 X-3) | — |
| **E-26** | Crédito del desarrollador en el pie | Nuevo | Decidir con el abogado (07 J-13) | — |

## Guía: `MARKETING_TOKEN_SECRET` (E-15)

**Formato que espera el código** (`backend/src/utils/opaqueTokens.js`): una cadena de **al menos 32 caracteres**, usada como clave de HMAC-SHA256. Con menos de 32 caracteres se considera "no configurado": no se firman enlaces y no se envían recordatorios. Se recomienda una cadena aleatoria de al menos 48 bytes.

**Cómo generarlo de forma segura** (lo hace el operador, **en el servidor o en su equipo**, nunca en esta conversación ni en Git):

1. Generarlo con una fuente criptográfica, por ejemplo con Node en la terminal de cPanel: `node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))"`. Copiarlo directamente al panel, sin guardarlo en archivos ni pegarlo en chats o tickets.
2. Definirlo como variable de entorno de la **aplicación de la API** (cPanel → "Setup Node.js App" → Environment variables) y reiniciar la aplicación.
3. No añadirlo a `.env` versionados, capturas, informes ni logs. El código nunca lo imprime.

**Rotación:** mover el valor actual a `MARKETING_TOKEN_SECRET_PREVIOUS` (solo verifica), poner uno nuevo en `MARKETING_TOKEN_SECRET` y mantener el anterior mientras puedan usarse enlaces ya enviados (probado en N-06).

**En pruebas** se usó un secreto aleatorio exclusivo de pruebas, generado en memoria en cada ejecución y nunca escrito en disco.

## Qué bloquea qué (vista inversa)

| Funcionalidad o documento | Bloqueado por |
|---|---|
| **Cerrar V-01 en producción** | Contención de `06-…` §7.1 ejecutada y verificada por el operador (E-18), y conciliación E-22 |
| Publicar los textos legales | Revisión jurídica (07 §3) |
| Publicar un plazo de entrega | E-10 (definición) |
| Ofrecer contraentrega sin riesgo de promesa incumplida | E-19 |
| Activar PQR | E-2 (buzón probado, acceso de Roger autorizado, `ADMIN_NOTIFY_EMAIL`) |
| Recordatorios comerciales | Decisión del negocio + E-8, E-15, E-16 y abogado (Ley 2300) |
| Mostrar "Vigente desde" | E-7 |
| Desplegar | E-12, más lo que se quiera publicar (06 §0) |
