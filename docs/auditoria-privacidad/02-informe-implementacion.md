# B. Informe de implementación — correcciones de privacidad y comercio electrónico

Fecha: 2026-11-16. Base: `main` @ `59a4717` más cambios locales.

**No se hizo commit, push ni despliegue, ni se modificó producción, la base de datos real o el CMS.**

## 1. Fase previa

### 1.1 Aislamiento

- **No se usó el `.env` del proyecto.** El backend se probó importando `src/app.js`, que no carga `dotenv`, con todas las variables fijadas explícitamente. `server.js` (que sí carga `.env` y conecta a la BD) **no se ejecutó**.
- **Base de datos:** `mongodb-memory-server` instalado **fuera del repositorio** (scratchpad), escuchando en `127.0.0.1`, efímero. La prueba aborta si el host de Mongoose no es `127.0.0.1`.
- **Servicios salientes:** sin claves de Resend, Wompi, Nequi ni Cloudinary. Los transportes del acuse y de la constancia PQR se sustituyeron por espías. `fetch` global bloquea cualquier host que no sea local; resultado: **0 intentos**.
- **Tareas programadas:** el repositorio no tiene cron ni workers. El único envío programable (`npm run marketing:reminders`) **no se ejecutó**; la función se probó directamente sobre la BD en memoria.
- **Hooks y scripts revisados antes de ejecutar:** `.git/hooks` solo contiene `*.sample`. Los scripts de `package.json` (`dev`, `start`, `seed:*`, `marketing:reminders`) no se ejecutaron, salvo `next build` y `eslint`. `next build` se lanzó con `NEXT_PUBLIC_API_URL=http://127.0.0.1:9/api` (inalcanzable).
- **Frontend:** no se arrancó ningún servidor. No había herramienta de navegador disponible, así que **las pruebas E2E no se ejecutaron**.

### 1.2 Reconciliación repositorio ↔ producción (H-24)

| Evidencia | Resultado |
|---|---|
| `git log -S nequi_api -- checkoutController.js` | `9c57d93` introdujo Nequi; `52bbcc8` (2026-09-12) lo retiró de la configuración |
| `git show 52bbcc8` | −14 líneas: elimina `nequi_api` (condicional) y `nequi_manual` de `getCheckoutConfig` |
| Ramas `develop`, `MejoraUno`, `origin/develop` | Todavía contienen `nequi_api` en el controlador |
| Producción (`/api/checkout/config`, 2026-11-16) | Ofrece `wompi`, `nequi_api`, `nequi_manual`, `contra_entrega` |

**Conclusión:** producción ejecuta un backend **anterior a `52bbcc8`** o de otra rama. El commit exacto no se puede determinar (E-12).

Medidas tomadas:

- No se eliminó ni reemplazó ninguna integración.
- No se cambió el contrato con Wompi ni con Nequi; la `redirect_url` de Wompi sigue llevando `order` y `payment`.
- El flujo `nequi_api` del checkout solo cambió en la URL de redirección final.

Las pruebas representan **la copia local, no producción**.

### 1.3 Cambios locales del propietario preservados

Archivos ya modificados antes de esta tarea, **no tocados**:

- `backend/src/controllers/productPublicController.js`
- `backend/src/services/catalogFilterService.js`
- `frontend/src/app/(shop)/catalogo/page.js`
- `components/catalog/CatalogFilters.jsx`
- `components/catalog/CatalogoContent.jsx`
- `services/productService.js`
- `styles/components/catalog-filters.css`

## 2. Cambios por bloque

### A. Datos personales en URLs y seguimiento (H-06, H-28)

| Antes | Ahora |
|---|---|
| `/pedido/confirmacion?order=…&email=…&name=…&total=…` | `/pedido/confirmacion?order=…` |
| La confirmación leía importes de la URL (manipulables) y el correo de la URL o de sessionStorage | La confirmación pide los datos al servidor (`POST /api/checkout/orders/lookup`). Solo responde al **dueño autenticado** o a quien tenga el **token de acceso** emitido al crear el pedido. Cualquier otro caso → 404 genérico |
| `sessionStorage`: `dizor_guest_email`, `dizor_guest_name` | `sessionStorage`: `dizor_order_access` = {número de pedido, token}. Las claves antiguas se borran al visitar la confirmación |
| `GET /api/checkout/track?orderNumber=&email=` | `POST /api/checkout/track` (cuerpo). El GET responde **410** sin leer parámetros |
| `GET /api/special-requests/track?…&email=` sin limitador | `POST` con `trackingLimiter`. El GET responde 410 |
| `/seguimiento?order=…&email=…`, `/login?email=…` | `/seguimiento?order=…`, `/login` |
| morgan `combined` con la URL completa | Mismo formato con `:url-redacted`: solo los parámetros de una lista permitida conservan su valor |
| Errores y `AuditLog.path` con la URL completa | URL redactada |
| GA: `page_path` saneado, pero `page_location` = URL completa | `page_location` saneado en `config` y en cada evento; ningún evento desde `/admin`, `/vendedor`, `/restablecer`, `/favoritos`, `/cuenta`, `/pedido`, `/baja`, `/pqr` |
| En desarrollo, `console.log` de correos de destinatarios y del enlace de recuperación | Sin correos en consola; el enlace de recuperación solo se imprime fuera de producción |

**Token de acceso:**

- 32 bytes aleatorios; en BD solo el hash SHA-256 (`select:false`).
- Comparación en tiempo constante; vigencia de 72 h.
- Se **rota** en cada reintento idempotente (el anterior deja de valer).
- No es la única barrera: el pedido se busca por número **y** debe coincidir el hash vigente, o bien el usuario autenticado debe ser el dueño.
- La respuesta no incluye dirección, teléfono, costos internos ni notas de staff.

**Enlaces antiguos:** la página de confirmación y la de seguimiento reescriben la barra de direcciones (`history.replaceState`) sin los parámetros personales e **ignoran** el correo. Una confirmación antigua abierta sin token muestra un modo limitado que remite a seguimiento o a iniciar sesión.

**Exposición histórica (no resuelta por código):** el historial de los navegadores, los logs ya escritos (14 días localmente; los del hosting, desconocidos, E-4) y cualquier registro de terceros siguen como estaban. **No se borró ningún log.** Requiere una evaluación separada.

### B. Marketing (H-04, H-05)

- **Inscripción automática eliminada** en `cartController.syncCart`.
- **Newsletter** (`subscribeNewsletter`): exige `marketingConsent === true`, registra `ConsentRecord` (finalidad `marketing_newsletter`) y guarda `lastConsentRecord`. Una nueva suscripción tras una baja es una acción afirmativa: queda registrada y levanta la supresión.
- **Recordatorio de carrito** (`trackAbandonedCart`): exige `marketingConsent === true` y guarda `consentRecord`. La respuesta ya no devuelve el correo.
- **Envío** (`sendDueAbandonedReminders`): no envía si:
  - el envío está deshabilitado;
  - falta `MARKETING_TOKEN_SECRET` (sin enlace de baja no hay publicidad);
  - se está fuera de la franja horaria (`utils/contactWindow.js`).

  Luego, por cada carrito comprueba que tenga evidencia y una autorización vigente que no esté en la lista de supresión (`hasValidMarketingConsent`). Esta comprobación ocurre **en el momento del envío**, así que una baja posterior al guardado se respeta.
- **Baja:**
  - Token `<finalidad>.<ObjectId>.<HMAC-SHA256>`, sin correo; determinista, lo que hace la baja idempotente.
  - `POST /api/marketing/unsubscribe` → marca la baja, crea `MarketingSuppression` y una fila `revoked` en `ConsentRecord` (solo la primera vez).
  - Página `/baja` con botón de confirmación, para evitar bajas por los escáneres de enlaces de los clientes de correo. No requiere sesión.
- **Correo de recordatorio:** enlace de baja visible y cabecera `List-Unsubscribe`. Si falta el enlace, la función lanza un error y no envía.
- **Exportación CSV:** solo suscriptores activos con evidencia utilizable y sin supresión; incluye `consentRecordedAt`, `consentTextVersion` y `unsubscribeUrl`.
- **Panel admin:** el listado añade `hasConsentEvidence`; la baja desde el panel también suprime y registra la revocación.
- **Usuarios y registros existentes:**
  - No se fabricaron autorizaciones ni fechas, y no se ejecutó ninguna migración.
  - Los suscriptores y carritos sin evidencia **se conservan** pero **quedan excluidos** de la exportación y de los envíos.
- **Interfaz:**
  - Casilla opcional desmarcada en newsletter (pie de página, home y popup) y en el recordatorio de carrito. Sin marcarla, no se puede enviar.
  - El recordatorio sigue oculto para usuarios registrados, como antes. Ofrecérselo es una decisión del negocio (E-5).
- **Transaccionales separados:** el acuse, el correo de despacho y la constancia PQR no llevan baja ni contenido promocional, y no dependen de la autorización comercial.

### C. Autorizaciones y formularios (H-03, H-14)

- **`backend/src/config/legalTexts.js`**: fuente única de textos, versión y estado por finalidad (`order_processing`, `account`, `special_request`, `review_publication`, `customer_request`, `marketing_newsletter`, `marketing_cart_reminder`, `terms`).
  - **Todos en `draft`**, con la lista de datos que faltan.
  - `terms` está en `missing`: no se muestra casilla ni se registra aceptación.
- **`ConsentRecord`** (append-only; los hooks de Mongoose bloquean actualizaciones y borrados):
  - Campos: `purpose`, `action`, `textVersion`, `textStatus`, `subjectEmail`, `user`, `source`, `referenceType/referenceId`, `recordedAt` (servidor, inmutable).
  - **Sin IP, user-agent ni huellas**: no se justificó su necesidad. Si el abogado lo exige como prueba, se añadiría con finalidad y conservación definidas.
- **Validación en el servidor:** `requireAuthorization` solo acepta el booleano `true`. Las cadenas `"true"`, `"on"`, etc. → 400. Las versiones o fechas enviadas por el cliente se ignoran (probado en P-04).
- **Separación de finalidades:**
  - Aceptación contractual (`terms`, aún inexistente).
  - Tratamiento para el trámite (`order_processing`, `account`, `special_request`, `customer_request`, `review_publication`).
  - Comercial (`marketing_*`), siempre opcional y nunca condición de la compra.
- **Frontend:**
  - `ConsentCheckbox` muestra el texto exacto servido por el backend y un enlace a la Política de Privacidad.
  - Si el texto está en `draft`, la casilla lo indica con "Texto en revisión".
  - Si el aviso no carga, el formulario no se puede enviar.
- **Reseñas:** autorización de publicación obligatoria; "Ciudad (opcional; se mostrará públicamente)"; etiqueta "Publicada por la tienda" en las reseñas `isBrandReview`.

### D. Cookies y analítica (H-07, H-08, H-09, H-10)

- **GA sigue desactivado:** no se añadió ningún ID.
- **Registro único versionado** (`lib/consentRecord.js`, `CONSENT_VERSION = "2"`). La analítica se deriva de él y la clave antigua `dizor_analytics_consent` se elimina. Al subir la versión, las decisiones previas se invalidan y la analítica queda denegada.
- **Retirada o rechazo tras aceptar:**
  - Borra `_ga`, `_ga_*` y `_gid` en el host y los dominios padre.
  - Borra las marcas `dizor_ga_purchase_fired_*`.
  - Recarga la página si gtag.js llegó a cargarse.
  - **No** borra el carrito ni otras claves.
- **El tracker no se monta en `/admin` ni `/vendedor`.**
- **Sin GA configurado:**
  - No se muestra el banner (no hay nada opcional que aceptar; el almacenamiento necesario se informa en la política).
  - El panel ("Configurar cookies") muestra la categoría analítica deshabilitada con la nota "Actualmente no utilizamos cookies analíticas".
  - Las preferencias guardan `analytics:false`.
- **Política de Cookies:** tabla real de almacenamiento (B.5 corregido) y texto condicionado al estado real de GA; Cloudinary informado.
- **CSP:** comodines `*.google-analytics.com`, `*.analytics.google.com` y `*.googletagmanager.com`. Pendiente de validar con el proveedor cuando se active GA.
- Se eliminó la afirmación "No identifican a personas" del panel, porque el identificador de cliente de GA es un identificador.

### E. Checkout y acuse (H-19, H-20)

- **Resumen previo:** líneas con precio unitario y subtotal **devueltos por `/checkout/calculate` (servidor)**, desglose de totales, corrección (Atrás o carrito) e "Imprimir resumen" con CSS de impresión.
- **Los importes los recalcula siempre el servidor** al crear el pedido (sin cambios en ese cálculo).
- **`Order.legal`:** versión y estado del aviso de privacidad y `acceptedAt` del servidor; `termsVersion` queda nulo mientras no haya términos.
- **Acuse** (`services/orderReceiptService.js`):
  - Contenido: número y fecha, líneas con precio unitario, subtotal, descuento, IVA, envío, total, forma y **estado** del pago, y tiempo de entrega.
  - Idempotencia por reclamación atómica `buyerReceipt.claimedAt`.
  - Si el proveedor falla, se libera la reclamación y se guarda `lastError` (sin datos personales).
  - Un reintento del mismo pedido no lo reenvía.
- **Confirmación:** título y estado según `paymentStatus` del servidor. Ya no aparece "¡Pedido confirmado!" ante una simple redirección.
- **Nequi / Wompi:** sin cambios de contrato. Las respuestas de las pasarelas no se simularon porque los cambios no tocan esos flujos; el método probado fue contra entrega.

### F. PQR y derechos (H-22, H-11)

| Pieza | Detalle |
|---|---|
| Modelo | `CustomerRequest` con `category` (`consumo` / `datos_personales`), tipo validado por categoría, contacto mínimo, número de pedido opcional, descripción (≤3000), estado, historial (nota pública e interna), `accessTokenHash` (`select:false`) y `receivedAt` inmutable |
| Radicado | `PQR-AAAAMMDD-` + 8 hex aleatorios (no secuencial); reintento ante colisión |
| Persistencia | Se guarda **antes** de devolver el radicado; si falla, no hay radicado |
| Constancia | Correo con radicado, fecha y hora (Colombia) y código de consulta |
| Seguimiento | `POST /api/pqr/track` (radicado + código) → sin datos de contacto; 404 genérico |
| Administración | `/api/admin/pqr` (solo `superadmin` y `admin`); cambios de estado con historial y auditoría |
| Activación | `PQR_PUBLIC_ENABLED=true` (backend) y `NEXT_PUBLIC_PQR_ENABLED=true` (enlace en el pie de página). **Desactivado por defecto**: responde 503 y la página remite a WhatsApp |
| No implementado | Plazos legales visibles, alertas de vencimiento, supresión o anonimización automática y `DELETE /me` (dependen de E-2, E-6 y revisión jurídica) |

### G. Otros

- **Pie de página:** enlace a la SIC (destino verificado) y enlace a PQR condicionado a la variable de entorno.
- **Admin:** entrada "PQR y datos" en la navegación (solo administradores).

## 3. Archivos

**Backend modificados:**

- `src/app.js`
- `src/controllers/`: `authController`, `cartController`, `checkoutController`, `marketingAdminController`, `marketingPublicController`, `reviewController`, `specialRequestController`
- `src/middlewares/errorMiddleware.js`
- `src/models/`: `abandonedCart`, `newsletterSubscriber`, `order`
- `src/routes/`: `checkoutRoutes`, `marketingPublicRoutes`, `specialRequestRoutes`
- `src/services/`: `auditService`, `emailService`, `marketingService`

**Backend nuevos:**

- `src/config/legalTexts.js`
- `src/controllers/customerRequestController.js`
- `src/models/`: `consentRecord`, `customerRequest`, `marketingSuppression`
- `src/routes/`: `customerRequestRoutes`, `customerRequestAdminRoutes`, `legalPublicRoutes`
- `src/services/`: `consentService`, `customerRequestService`, `orderReceiptService`
- `src/utils/`: `contactWindow`, `opaqueTokens`, `redactUrl`

**Frontend modificados:**

- `next.config.mjs`
- `src/app/(auth)/`: `layout.js`, `register/page.js`
- `src/app/(shop)/`: `layout.js`, `checkout/page.js`, `pedido/confirmacion/page.js`, `seguimiento/page.js`, `personalizar/page.js`, `pedido-mayor/page.js`, `politica-de-cookies/page.js`
- `src/components/`: `admin/AdminShell.jsx`, `analytics/AnalyticsTracker.jsx`, `consent/CookieConsentBanner.jsx`, `consent/CookiePreferencesPanel.jsx`, `home/HomeReviews.jsx`, `layout/SiteFooter.jsx`, `marketing/AbandonedCartCapture.jsx`, `marketing/NewsletterSignup.jsx`, `products/ProductReviews.jsx`
- `src/lib/`: `analytics/consent.js`, `analytics/events.js`, `analytics/urlSanitizer.js`, `consentPreferences.js`
- `src/services/`: `checkoutService.js`, `marketingService.js`, `specialRequestService.js`

**Frontend nuevos:**

- `src/app/(shop)/baja/{layout,page}.js`
- `src/app/(shop)/pqr/{layout,page}.js`, `src/app/(shop)/pqr/seguimiento/page.js`
- `src/app/admin/pqr/page.js`
- `src/components/legal/ConsentCheckbox.jsx`
- `src/lib/`: `consentRecord.js`, `customerRequestLabels.js`, `legalNotices.js`, `orderAccess.js`
- `src/services/`: `customerRequestService.js`, `legalService.js`
- `src/styles/components/consent-check.css`

**Sin modificar a propósito:**

- `politica-de-privacidad/page.js`: depende de E-1, E-2, E-6 y E-7.
- Páginas del CMS ("Política de cambios", "Envíos", "Nosotros"): están en la BD.
- Cálculo de precios e IVA.
- Integraciones de Wompi y Nequi.
- El informe original.

**No se añadieron dependencias al proyecto.**

## 4. Limitaciones y riesgos conocidos

1. **Contrato de API incompatible con el frontend desplegado.** El checkout, el registro, la newsletter, el recordatorio, las solicitudes y las reseñas exigen ahora la autorización, y el seguimiento usa POST. Backend y frontend deben desplegarse juntos (ver `06-plan-despliegue-reversion.md`).
2. **Textos en borrador:** si se desplegara tal cual, el público vería "Texto en revisión" y la evidencia recogida sería provisional. Por eso el plan de despliegue lo **bloquea**.
3. **`CONSENT_VERSION` = "2":** al desplegar, las decisiones de cookies previas se invalidan (sin efecto visible mientras GA esté apagado).
4. **Franja horaria:** no incluye festivos (no hay un calendario validado); hay que usar `MARKETING_BLOCKED_DATES`. Su aplicabilidad legal está pendiente.
5. **Enhanced Measurement de GA4** no es controlable desde el código (E-9).
6. **`.next/` local** se regeneró con `next build` usando una API inalcanzable. Antes de `next start` hay que volver a compilar con la configuración correcta (`next dev` no se ve afectado).
7. **`backend/logs/`** contiene entradas de las pruebas (solo datos sintéticos).
8. **Mongoose** muestra un aviso de obsolescencia (`new` en `findOneAndUpdate`); es un patrón preexistente en el proyecto, que también se usa en el código nuevo por consistencia.
9. **Errores 503 de PQR deshabilitado:** se registran como "Server error" (comportamiento preexistente del middleware para códigos ≥500). Generan ruido en los logs sin datos personales.
