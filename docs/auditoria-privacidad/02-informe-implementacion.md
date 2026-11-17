# B. Informe de implementación — correcciones de privacidad y comercio electrónico

Fecha: 2026-11-16. Base: `main` @ `59a4717` más cambios locales (fases 1–2); fase 3 sobre `10cdf28` (§6).

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

**Conclusión de la fase 1:** producción ejecuta un backend **anterior a `52bbcc8`** o de otra rama. El commit exacto no se puede determinar (E-12). La fase 2 precisa más esta conclusión; ver §5.2.

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
6. **`.next/` local** se regeneró en la fase 1 con `next build` usando una API inalcanzable. Antes de `next start` hay que volver a compilar con la configuración correcta (`next dev` no se ve afectado). En la fase 2 **no** se usó ni se modificó: las pruebas se hicieron sobre una copia compilada aparte.
7. **`backend/logs/`** contiene entradas de las pruebas (solo datos sintéticos).
8. **Mongoose** muestra un aviso de obsolescencia (`new` en `findOneAndUpdate`); es un patrón preexistente en el proyecto, que también se usa en el código nuevo por consistencia.
9. **Errores 503 de PQR deshabilitado:** se registran como "Server error" (comportamiento preexistente del middleware para códigos ≥500). Generan ruido en los logs sin datos personales.

---

## 5. Fase 2 — validación final local (2026-11-16)

Punto de partida: el propietario confirmó la fase 1 en el commit `1f3ff14` ("Mejora de politicas y cookies"). Durante esta fase tenía cambios **sin confirmar** en `cuenta/page.js`, `catalogo/page.js`, `pedido/confirmacion/page.js`, `pedido/layout.js`, `seguimiento/layout.js`, `seguimiento/page.js` y `styles/pages/order-view.css`, entre ellos el rediseño de las páginas de confirmación y seguimiento. **No se editó ninguno de esos archivos.** Se revisó que el rediseño conserva la lógica de privacidad (token, limpieza de URL, `POST`, estados reales del pago), y se probó tal cual en E2E.

Aislamiento: igual que en la fase 1, más E2E con navegador real sobre una copia compilada del frontend (ver `evidencias/README.md`).

### 5.1 Defectos encontrados y corregidos en esta fase

| ID | Defecto comprobado | Hallazgo | Corrección | Prueba |
|---|---|---|---|---|
| V-02 | En móvil (≤480 px) el banner de cookies ocupaba **402 px de 844**, con un hueco en blanco: con `flex-direction: column`, el `flex: 1 1 320px` del texto se aplicaba como altura. **Preexistente** (ya estaba en `59a4717` y en producción) | H-09 | `cookie-consent.css`: `.cookie-banner__text { flex: 0 0 auto }` dentro de la regla móvil existente | E2E L-movil: banner ≤35 % de la altura (captura `L-movil-banner.png`) |
| V-03 | El banner y los controles dependían **solo** del ID de Google Analytics. El contador de visitas guardaba una cookie de la API (`dizor_visit_day`) y una clave local **sin permiso**, y al retirar el permiso no se detenía ese tratamiento | H-09, H-10 | Inventario central de tecnologías opcionales (`lib/optionalTechnologies.js`); categoría **"Estadísticas propias"** (contador); `VisitCounter` solo registra con permiso; al rechazar o retirar se borra la clave local y la API borra su cookie (`POST /api/visits/forget`); el panel se construye desde el inventario; la política de cookies separa esa categoría; `CONSENT_VERSION` "2" → "3" | E2E C-01…C-06; N-07 |
| V-04 | Las PQR no eran idempotentes: si la respuesta se perdía, el reintento creaba **otro radicado** | H-22 | Clave de idempotencia por intento desde el formulario; hash único en `CustomerRequest`; el reintento devuelve el mismo radicado con un código nuevo (el anterior se invalida) y reenvía la constancia; con otro correo → 409; seguro frente a concurrencia | N-04, N-05 |
| V-05 | Rotar `MARKETING_TOKEN_SECRET` invalidaba **todos** los enlaces de baja ya enviados | H-04, H-05 | Variable opcional `MARKETING_TOKEN_SECRET_PREVIOUS`: solo verifica, nunca firma | N-06 |
| V-06 | Los 400/410 no orientaban a quien tenía abierta la versión anterior del sitio | Transición de la API | Los mensajes indican "recarga la página" (autorización ausente y seguimiento por GET) | N-02, N-03 |

**Clasificación del contador como opcional:** es una decisión **conservadora** (no es necesario para comprar y guarda datos en el dispositivo). Su calificación jurídica queda pendiente (`05-borradores…` §4). Efecto visible: el banner vuelve a mostrarse en la primera visita, porque hay una tecnología opcional activa, y el contador solo cuenta a quien acepta.

Archivos de la fase 2:

- **Backend:** `controllers/siteVisitController.js`, `routes/visitRoutes.js`, `models/customerRequest.js`, `services/customerRequestService.js`, `services/consentService.js` (mensaje), `controllers/checkoutController.js` y `controllers/specialRequestController.js` (mensaje 410), `utils/opaqueTokens.js`.
- **Frontend:** `lib/optionalTechnologies.js` (nuevo), `lib/consentRecord.js`, `lib/consentPreferences.js`, `services/visitService.js`, `components/layout/VisitCounter.jsx`, `components/consent/CookieConsentBanner.jsx`, `components/consent/CookiePreferencesPanel.jsx`, `app/(shop)/politica-de-cookies/page.js`, `app/(shop)/pqr/page.js`, `styles/components/cookie-consent.css`.

### 5.2 Diferencia con producción (H-24): evidencia con lecturas GET públicas

Solo se hicieron peticiones GET públicas, sin autenticación y sin ninguna operación que cree o modifique datos. No se afirma que producción ejecute un commit concreto.

| Capa | Evidencia (2026-11-16) | Interpretación |
|---|---|---|
| **Backend** | `GET /api/reviews` → 200 (ruta añadida en `237b4bd`, 2026-07-18); `GET /api/favorites/ids` → 404 "Ruta no encontrada" (ruta añadida en `68e986b`, 2026-09-12); `GET /api/products/random-sample` no existe (añadida en `52bbcc8`); `GET /api/legal/notices` → 404; `GET /api/checkout/track` → 400 con el contrato antiguo | Coherente con código **posterior a `237b4bd` y anterior a `68e986b`** en la historia de `main`, o con código no versionado. **Ningún commit queda identificado** |
| **Frontend** | `/politica-de-cookies` → 200 (creada en `245d22a`, 2026-07-14); `/guia-de-tallas` → 404 (creada en `cbddfe3`, 2026-08-31); `/favoritos` → 404 (creada en `68e986b`); `/pqr` y `/baja` → 404 | Coherente con código **posterior a `245d22a` y anterior a `cbddfe3`**. Puede ser una versión **distinta** de la del backend |
| **Configuración** | `/api/checkout/config` ofrece `nequi_api` y `nequi_manual`; `taxEnabled:false`; `shippingFixedCost:0` | Configuración de BD y variables de entorno de producción, no del código. El valor de `NEQUI_ENV` es desconocido (ver V-01) |
| **Contenido administrado** | Páginas CMS "Nosotros", "Envíos", "Política de cambios" (en BD) | No dependen del commit |
| **Caché** | Portada: `x-nextjs-cache: STALE`, `cache-control: s-maxage=30, stale-while-revalidate=31535970`, servidor `LiteSpeed` | Las páginas ISR pueden servirse obsoletas mientras se regeneran; tras un despliegue puede verse contenido anterior durante un tiempo |
| **Hosting** | `frontend/server.js` documenta el arranque para "Setup Node.js App" de cPanel (Passenger), coherente con `LiteSpeed` | Proveedor y retención de logs: E-4 |

**Consecuencia para el despliegue:** desplegar `main` no es "aplicar la remediación" a lo que hay en producción. Llevaría también unos dos meses de cambios no publicados (favoritos, guía de tallas, rediseño de la home, filtros del catálogo y la retirada de Nequi del checkout en `52bbcc8`). Ver `06-plan-despliegue-reversion.md` §1.

**Lo que debe obtener el operador** (sin compartir secretos):

1. En cPanel → "Setup Node.js App", de **cada** aplicación (frontend y API): ruta raíz de la aplicación, archivo de arranque, versión de Node y los **nombres** de las variables de entorno definidas (no sus valores). Excepción: el **valor** de `NEQUI_ENV`, que no es secreto (`mock`/`sandbox`/`production`).
2. Si la ruta raíz es un clon de Git: en la terminal de cPanel, `git -C <ruta> log -1 --format="%H %ad"` y `git -C <ruta> status --short | head -20`. Si no es un clon: fecha y origen del último despliegue (zip o subida).
3. Si hay `.next/BUILD_ID` en el frontend desplegado, su valor y su fecha.

**No se eliminó ni restauró Nequi.** El código local mantiene las rutas de Nequi tal como estaban.

### 5.3 Riesgo crítico encontrado (fuera de los hallazgos originales): V-01 — Nequi en modo `mock`

Evidencia **solo de código**; no se hizo ninguna prueba contra producción, porque sería un ataque:

- `backend/src/services/nequiPaymentService.js:5`: `NEQUI_ENV` toma por defecto `"mock"` si no está definido.
- `:28`: en `mock`, `isNequiConfigured()` es verdadero, así que el checkout **ofrece** "Nequi (pago directo)".
- `:183`: en `mock`, `verifyWebhookSignature()` **siempre** devuelve `true`.
- `controllers/nequiController.js:213-251`: el webhook busca el pedido por número (`reference`) y, si el estado mapea a aprobado, ejecuta `approveOrder(order, "webhook")`.
- El mismo código existía en `237b4bd` (rango del backend desplegado).

**Consecuencia si producción está en `mock`:**

1. Cualquiera que conozca o adivine un número de pedido `nequi_api` (formato secuencial `DIZ-AAAAMMDD-NNNN`) podría marcarlo como **pagado** con una petición sin firma.
2. Los clientes que elijan Nequi recibirían un cobro simulado que nunca se procesa.

**Estado:** Pendiente de verificar contra producción (E-18). Es **prioridad máxima**, aunque no sea un hallazgo de privacidad. Acción del operador: confirmar el valor de `NEQUI_ENV`. Si es `mock` o no está definido, la decisión de desactivar Nequi en producción corresponde al propietario. No se modificó el código de Nequi.

### 5.4 Experiencia con enlaces antiguos que responden 410 y vía de recuperación

| Situación del cliente | Qué ve | Vía de recuperación segura |
|---|---|---|
| Pestaña abierta con la versión anterior que consulta el seguimiento por GET | Mensaje del 410: "…Recarga la página y vuelve a consultar con el formulario de seguimiento" | Recargar → formulario nuevo (POST con número y correo en el cuerpo) |
| Pestaña anterior que intenta finalizar la compra sin la casilla | 400: "…Si no ves la casilla de autorización, recarga la página." El carrito se conserva (`localStorage`) | Recargar → checkout con la casilla; la clave de idempotencia nueva evita duplicados (el intento anterior no creó pedido) |
| Marcador o enlace antiguo `/seguimiento?order=…&email=…` | Formulario con el número precargado; el correo se elimina de la URL y **no** se precarga | Escribir el correo o iniciar sesión → "Ver mis pedidos" |
| Enlace antiguo de confirmación con datos en la URL, abierto sin token ni sesión | "Verifica tu acceso" (modo limitado); no muestra datos | "Consultar con número de pedido y correo" o iniciar sesión |
| Sin acceso a nada de lo anterior | — | Canal de atención: WhatsApp hoy; PQR cuando se habilite (E-2) |

En ningún caso se restablece el acceso por correo en la URL ni se relajan controles.

### 5.5 Observación menor (no corregida)

`GET /api/payments/nequi/status/:orderId` responde sin autenticación con el estado del pago de un pedido `nequi_api` si se conoce su `_id` (ObjectId, no adivinable). No expone datos personales. No se modificó porque forma parte del flujo de Nequi (ver V-01); revisarlo junto con esa decisión.

## 6. Fase 3 — datos reales, políticas, pagos y expediente jurídico (2026-11-16)

Base: `main` @ `10cdf28` más los cambios locales sin confirmar del propietario (ProductCard, guía de tallas, newsletter compacta, estilos), que **no** se modificaron. Sin commit, push, despliegue ni cambios en el CMS o la BD reales. Datos y procedencia en `07-…` §1.

### 6.1 Medios de pago: solo Wompi y contraentrega

| Elemento | Antes | Ahora |
|---|---|---|
| `nequiPaymentService.getNequiEnv` | `NEQUI_ENV \|\| "mock"` | `sandbox`/`production` solo si se fijan; `mock` solo con `NODE_ENV=test`; cualquier otro caso → `disabled` |
| Activación | Implícita (mock siempre "configurado") | `isNequiDirectEnabled()` exige `NEQUI_DIRECT_ENABLED=true` + entorno válido + 4 credenciales; `isNequiManualEnabled()` exige `NEQUI_MANUAL_ENABLED=true`. Ambas **desactivadas** |
| `verifyWebhookSignature` | `true` en mock | `false` si la integración está desactivada |
| Endpoints `/api/payments/nequi/*` | Activos; el webhook aprobaba pedidos | **410** antes de leer o modificar pedidos (también con `NEQUI_ENV=mock`) |
| `createCheckoutOrder` | Lista fija con `nequi_api` y `nequi_manual` | `services/paymentMethods.js`: solo lo habilitado (Wompi si está configurado + contraentrega). Cualquier otro valor, incluido un objeto, → 400 sin crear pedido |
| `getCheckoutConfig` | Lista propia | La misma fuente (`getEnabledPaymentMethods`) |
| Confirmación (pedidos históricos Nequi) | Instrucciones de transferencia y "enviar comprobante por WhatsApp" | Aviso de que el medio ya no se ofrece y botón de consulta (cambio quirúrgico en el diseño del propietario) |
| Código de Nequi | — | **Conservado** (servicio, controlador, rutas, modelo `Order.nequi`, pantalla de espera del checkout), inactivo |
| Pedidos históricos | — | Intactos: ni se borran, ni se reclasifican, ni se marcan pagados. Conciliación en `06-…` §7.2 |

Contraentrega: el pedido se crea con `paymentStatus: "pendiente"` (probado). El acuse y la confirmación lo indican.

### 6.2 Webhook de Wompi (sin cambiar los métodos del checkout alojado)

- Se mantiene la verificación oficial del checksum (SHA-256 de `signature.properties` + `timestamp` + secreto, comparación en tiempo constante). Ahora acepta el checksum en la cabecera `X-Event-Checksum` **o** en `signature.checksum`.
- Ventana anti-repetición: de 5 minutos a **26 horas**, porque Wompi reintenta hasta 3 veces en 24 h (30 min, 3 h, 24 h). Repetir un evento ya aplicado es inocuo.
- Nuevas validaciones: `event.environment` debe coincidir con `WOMPI_ENV` (`prod`/`test`); el pedido debe ser `paymentMethod: "wompi"`; `currency` debe ser `COP`; el monto debe coincidir (ya existía).
- Un pedido pagado **no se degrada** por un evento posterior `DECLINED`/`VOIDED`/`ERROR` (se anota en el historial).
- No se filtra por `payment_method_type`: Nequi procesado dentro de Wompi se acepta (proveedor ≠ medio).
- La redirección del navegador sigue sin confirmar pagos: solo el webhook verificado cambia el estado.

### 6.3 Envío incluido en el precio y transportadoras

- `settingsService.isShippingIncluded()`: activo por defecto (`SHIPPING_INCLUDED_IN_PRICE !== "false"`) o con el nuevo modo `included`. El costo de envío es 0, `freeShippingApplied` es `false` y no se anuncia umbral.
- `Order.shippingIncluded` guarda la condición de cada pedido.
- Textos: "Incluido en el precio" en carrito, checkout, confirmación, cuenta, acuse y panel. Se eliminó "Gratis" / "gratis ≥ …". El panel de configuración ofrece "Incluido en el precio" y avisa del valor efectivo.
- Transportadoras: `interrapidisimo` y `servientrega` (código). Se valida la elegida. Etiquetas añadidas en checkout, cuenta, seguimiento, `orderLabels` y correo (sin URL de rastreo de Servientrega, que no se conoce).

### 6.4 Plazos de entrega (bloqueados)

`backend/src/config/deliveryTerms.js` con `status: "pending_definition"`. Mientras tanto: no se muestra plazo en checkout ni en "Envíos y entregas"; el acuse dice "te lo confirmaremos por este medio". Cuando se defina, el checkout lo mostrará antes de confirmar y el pedido guardará `legal.deliveryTermsVersion` y `deliveryTermsText`. `ORDER_DELIVERY_TIME_TEXT` deja de usarse.

### 6.5 Textos legales y formularios

- `legalTexts.js`: versiones "2" (casillas) y "1" (términos), estado `published` con `legalReview: "pending"` interno. Nombran a la sociedad como responsable. La versión de fase 1 queda en `HISTORY`.
- `ConsentCheckbox`: sin la marca "Texto en revisión"; enlace "Ver política"/"Ver términos".
- Checkout: casilla obligatoria de términos (`termsAccepted === true` en el servidor) → `Order.legal.termsVersion/termsStatus` + `ConsentRecord` de finalidad `terms`.
- `consentService.isUsableTextStatus`: `approved` y `published` cuentan; `draft` no (salvo pruebas explícitas). Lo usa también la exportación de la newsletter.
- Formularios revisados (todos reciben el texto del servidor): registro, checkout, registro tras la compra, newsletter (pie, inicio, ventana), encargos, mayoristas, reseñas, PQR y recordatorio (desactivado).
- Páginas: `/politica-de-privacidad` reescrita; `/politica-de-cookies` sin PLACEHOLDER; nuevas `/terminos-y-condiciones` y `/garantias-y-devoluciones` (imprimibles); `/pagina/envios` estática con el mismo título, ruta y diseño; `/pagina/cambios` → redirección; pie con identificación del vendedor; sitemap actualizado. Cada página muestra su versión y solo muestra fecha de vigencia si se define `NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE`.
- Corrección encontrada en la validación: el compilador eliminaba el espacio tras `</strong>` cuando el texto siguiente contenía `&quot;` ("personalización:su ficha"); se añadió `{" "}` explícito en 4 lugares.

### 6.6 Marketing, PQR y acuse

- Recordatorios de carrito: interruptor de servidor `MARKETING_CART_REMINDERS_ENABLED` (desactivado). Configuración pública `cartReminders.enabled=false` → el carrito no muestra el formulario; `POST /marketing/abandoned-cart` → 503 sin guardar nada; `sendDueAbandonedReminders` → `feature_disabled`; el endpoint del panel → 409 y el botón queda deshabilitado.
- PQR: aviso interno a `ADMIN_NOTIFY_EMAIL` con datos mínimos; constancia con razón social, NIT, correo y horario; página `/pqr` con contacto y horario (y, si el canal está desactivado, el correo además de WhatsApp). Canal **sin activar**.
- Acuse: identificación del vendedor, envío incluido, aviso de contraentrega y contacto.
- `seedCms.js` y `seedStoreSettings.js` actualizados (no ejecutados).

### 6.7 Archivos de la fase 3

Backend nuevos: `config/businessInfo.js`, `config/deliveryTerms.js`, `services/paymentMethods.js`.
Backend modificados: `config/legalTexts.js`; `controllers/{cart,checkout,marketingAdmin,nequi,settingsAdmin,wompiWebhook}Controller.js`; `models/{consentRecord,order,storeSettings}.js`; `scripts/{seedCms,seedStoreSettings}.js`; `services/{cart,consent,customerRequest,email,marketing,nequiPayment,orderReceipt,order,settings,wompi}Service.js`; `utils/formatMarketingSettings.js`.
Frontend nuevos: `app/(shop)/terminos-y-condiciones/page.js`, `app/(shop)/garantias-y-devoluciones/page.js`, `app/(shop)/pagina/envios/page.js`, `components/legal/{LegalDocMeta,PrintButton}.jsx`, `lib/businessInfo.js`.
Frontend modificados: `next.config.mjs` (redirección), `app/sitemap.js`, `app/(shop)/{carrito,checkout,politica-de-privacidad,politica-de-cookies,pqr}/page.js`, `app/admin/{configuracion,contenido}/page.js`, `components/{layout/SiteFooter,legal/ConsentCheckbox,marketing/AbandonedCartCapture}.jsx`, `lib/orderLabels.js`, `styles/layouts/public-footer.css`; ediciones **quirúrgicas** en archivos rediseñados por el propietario: `pedido/confirmacion/page.js` (bloque Nequi y fila de envío), `cuenta/page.js` y `seguimiento/page.js` (etiquetas), `components/admin/OrderDetail.jsx` (fila de envío).
No tocados: `ProductCard.jsx`, `SizeGuide.jsx`, `guia-de-tallas/*`, `HomeNewsletter.jsx`, `product-card.css`, `size-guide.css` (cambios del propietario), catálogo.
