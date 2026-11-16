# Auditoría de privacidad, cookies y comercio electrónico — DIZOR

| Campo | Valor |
|---|---|
| Fecha de auditoría | 2026-11-16 |
| Repositorio | rama `main`, commit `59a4717` ("Modificaciones de imagenes y mejoras"), con cambios locales sin confirmar en archivos del catálogo (no relacionados con privacidad) |
| Sitio desplegado observado | `https://sombrerosdizor.com.co` (frontend) y `https://api.sombrerosdizor.com.co` (API), solo con peticiones GET públicas |
| Jurisdicción de análisis | Colombia (ver §G para el alcance de otras jurisdicciones) |
| Naturaleza | Auditoría técnica basada en evidencias. **No es una certificación de cumplimiento ni sustituye una revisión jurídica profesional.** |

Convenciones de evidencia usadas en todo el informe:

- **[E]** revisión estática del código del repositorio.
- **[P]** observación del sitio en producción mediante peticiones HTTP de solo lectura (HTML, cabeceras, bundles JS, endpoints públicos de la API).
- **[D]** verificación documental en fuentes normativas.
- **[N]** no verificado: queda como pendiente.

No se usó navegador interactivo (no había una herramienta disponible en la sesión), así que **no se ejecutó ninguna prueba dinámica de consentimiento, compra, registro ni envío de formularios**.

---

## A. Resumen ejecutivo

### Qué se revisó

- El código completo del frontend (Next.js 16 y React 19) y del backend (Express 5, Mongoose 9 y MongoDB): rutas, formularios, modelos, correos, integraciones, almacenamiento del navegador, cookies, logs y consentimiento.
- El sitio en producción: HTML de la portada, cabeceras HTTP (incluida la CSP), bundles JS servidos, páginas legales publicadas, páginas del CMS (`/api/content/pages`) y la configuración pública de checkout y marketing.
- Las normas colombianas sobre datos personales y protección al consumidor en comercio electrónico (ver §G).

### Qué no pudo revisarse

- El comportamiento real en navegador: banner, cookies efectivas, red, almacenamiento y los escenarios a) a f).
- El backend realmente desplegado. **No coincide con el repositorio** (H-24).
- La base de datos, el panel de Google Analytics, Resend, Cloudinary, Wompi, Nequi, el hosting y sus logs.
- Contratos con proveedores, procedimientos internos e identidad legal del vendedor.

### Principales riesgos respaldados por evidencia

1. **El vendedor y el responsable del tratamiento no están identificados.** La Política de Privacidad publicada en producción contiene marcadores literales `[PLACEHOLDER — pendiente de revisión legal…]` en lugar de la razón social, el NIT, el domicilio, el canal de derechos y los plazos. Tampoco hay identificación del vendedor en el sitio (H-01, H-15).
2. **Faltan piezas básicas del comercio electrónico** que exige el art. 50 de la Ley 1480, modificado por la Ley 2439 de 2024: términos y condiciones, información de retracto y reversión del pago, enlace a la SIC, canal PQR con radicado, acuse de recibo al consumidor y resumen detallado del pedido antes de confirmarlo (H-16 a H-22).
3. **La "Política de cambios" publicada mezcla garantía y retracto, y puede limitar derechos legales.** Fija 5 días hábiles solo para productos "dañados o incorrectos" y omite el retracto (H-18).
4. **Se recogen datos personales sin aviso de privacidad ni autorización registrada** en registro, checkout, newsletter (popup activo en producción), carrito abandonado, solicitudes de personalización y por mayor, y reseñas. Ningún modelo guarda prueba de autorización (H-03).
5. **Hay marketing por correo sin mecanismos de baja.** Los usuarios registrados quedan inscritos automáticamente en los recordatorios de carrito abandonado. Ni la newsletter ni esos recordatorios tienen baja autoservicio (H-04, H-05).
6. **El correo y el nombre del comprador viajan en URLs** (confirmación de pedido, seguimiento, login y la API de seguimiento por GET). Esto los expone en historial y logs, y los expondría a Google Analytics si se activa (H-06).
7. **Google Analytics 4 no está activo en producción**: el ID no está incluido en el bundle. La capa de consentimiento existe y bloquea la carga, pero tiene defectos latentes que se manifestarían al activarlo (H-07 a H-09).

No se asignan porcentajes de cumplimiento.

---

## B. Inventario

### B.1 Tecnologías y arquitectura [E]/[P]

| Componente | Detalle verificado |
|---|---|
| Frontend | Next.js 16.2.6 y React 19.2.4, en `frontend/`. En producción responde un servidor `LiteSpeed`; el proveedor de hosting no está identificado [P] |
| Backend | Express 5, Mongoose 9, JWT en cookies httpOnly, Helmet, rate-limit, winston con rotación diaria |
| Base de datos | MongoDB Atlas (`*.mongodb.net`) según el `.env` local [E]. La región y el plan no se pueden determinar. No se sabe si producción usa el mismo clúster [N] |
| Correo | Resend (`resend`), remitente con dominio `sombrerosdizor.com.co` [E] |
| Imágenes | Cloudinary (`res.cloudinary.com`), cargado directamente por el navegador en varias páginas [E][P] |
| Pagos | Wompi (enlace de pago), Nequi API, Nequi manual (comprobante por WhatsApp) y contra entrega. Los cuatro aparecen como activos en `/api/checkout/config` de producción [P] |
| Envíos | Interrapidísimo, Envía y Coordinadora (configuración de producción) [P] |
| Analítica | Google Analytics 4 vía `gtag.js`, condicionado a `NEXT_PUBLIC_GA_MEASUREMENT_ID` y al consentimiento. **El ID no está incluido en el bundle de producción**, así que GA está inactivo [P] |
| Mensajería | Enlaces `wa.me` (WhatsApp) e Instagram, solo como enlaces y sin contenido incrustado [P] |
| No encontrado | Meta Pixel, Google Ads, Hotjar/Clarity, CAPTCHA, chat incrustado, iframes, Google Fonts remotas ni seguimiento desde el servidor hacia terceros [E] |

### B.2 Rutas públicas y formularios con datos personales [E]

| Formulario o flujo | Archivo | Datos | Destino |
|---|---|---|---|
| Registro | `frontend/src/app/(auth)/register/page.js` | nombre, correo, contraseña, teléfono (opcional) | `User` |
| Modal de registro tras la compra | `frontend/src/app/(shop)/pedido/confirmacion/page.js:20` | nombre, correo, contraseña | `User` |
| Login y recuperación de contraseña | `(auth)/login`, `olvide-contrasena`, `restablecer/[token]` | correo y contraseña | `User`, correo vía Resend |
| Cuenta y direcciones | `(auth)/cuenta`, `components/cuenta/AddressBook.jsx` | teléfono, direcciones | `User.shippingAddresses` |
| Checkout (invitado o registrado) | `frontend/src/app/(shop)/checkout/page.js` | nombre, correo, teléfono, dirección, ciudad, departamento, CP, notas, teléfono Nequi | `Order`, Wompi, Nequi y correo al administrador |
| Seguimiento de pedido | `(shop)/seguimiento/page.js` | n.º de pedido y correo | `GET /api/checkout/track?…&email=` |
| Newsletter (pie de página, home, popup) | `components/marketing/NewsletterSignup.jsx` | correo y nombre (opcional) | `NewsletterSubscriber` |
| Recordatorio de carrito | `components/marketing/AbandonedCartCapture.jsx` (invitado) y `cartController.syncCart` (registrado, automático) | correo, nombre, productos | `AbandonedCart` y correos |
| Personalización y pedido al por mayor | `(shop)/personalizar`, `(shop)/pedido-mayor` | nombre, correo, teléfono, empresa, detalles | `SpecialRequest` y correo al administrador |
| Seguimiento de solicitud | `(shop)/solicitud/seguimiento` | n.º de solicitud y correo | `GET /api/special-requests/track?…&email=` |
| Reseñas | `components/products/ProductReviews.jsx` | nombre visible, ciudad, comentario | `Review` (público tras aprobación) |

### B.3 Modelos con datos personales [E]

`User` (nombre, correo, teléfono, direcciones, favoritos, último login, hash del refresh token), `Order` (comprador, dirección, notas, teléfono Nequi, URL del comprobante), `NewsletterSubscriber`, `AbandonedCart`, `SpecialRequest`, `Review` (nombre y ciudad públicos), `AuditLog` (correo, IP, user-agent, ruta, datos previos y nuevos), `Cart`.

**Ningún modelo registra la autorización de tratamiento, la aceptación de términos, la versión de política aceptada ni las preferencias de marketing.**

### B.4 Políticas y contenido legal publicados [P]

| Página | Origen | Estado observado en producción |
|---|---|---|
| `/politica-de-privacidad` | código (`frontend/src/app/(shop)/politica-de-privacidad/page.js`) | Publicada **con tres marcadores PLACEHOLDER visibles** |
| `/politica-de-cookies` | código | Publicada, con un PLACEHOLDER de contacto (`page.js:92-95`) |
| `/pagina/cambios` "Política de cambios" | CMS (BD) | Texto idéntico a la semilla `backend/src/scripts/seedCms.js:44` |
| `/pagina/envios` "Envíos y entregas" | CMS | Texto idéntico a la semilla `seedCms.js:34` |
| `/pagina/nosotros` | CMS | Afirma "familias tejedoras", "elaborado a mano" y "comercio justo" |
| Términos y condiciones | — | **No existe.** `/terminos` y `/terminos-y-condiciones` responden 404 y no hay enlace en el pie de página |
| Retracto, garantía, reversión del pago, PQR, enlace a la SIC | — | **No aparecen** en el sitio ni en el código |

### B.5 Inventario de cookies y almacenamiento del navegador

Duraciones comprobadas en el código [E]. No se observaron en navegador [N].

| Nombre | Tipo / dominio | Proveedor | Finalidad observada | Datos | Duración | Activación | Origen | Clasificación propuesta |
|---|---|---|---|---|---|---|---|---|
| `accessToken` | cookie httpOnly, `api.sombrerosdizor.com.co` | propio | sesión | JWT con id de usuario | 15 min | login y registro | `backend/src/controllers/authController.js:47-50` | Funcionamiento y seguridad |
| `refreshToken` | cookie httpOnly | propio | renovar la sesión | JWT (se guarda su hash en BD) | 7 días | login | `authController.js:52-55` | Funcionamiento y seguridad |
| `dizor_visit_day` | cookie **no** httpOnly, API | propio | no contar la visita dos veces | fecha (AAAA-MM-DD) | 1 día | `POST /api/visits/register` en cada página con pie de página | `backend/src/controllers/siteVisitController.js:5-16` | Estadística agregada (ver H-10) |
| `dizor_cart_v1`, `dizor_coupon_v1` | localStorage | propio | carrito y cupón | ids de producto, cantidades, cupón | persistente | al añadir | `frontend/src/context/CartContext.jsx:14-15` | Funcionamiento |
| `dizor_pending_popup_coupon` | localStorage | propio | aplicar el cupón del popup | código | hasta que se usa | al mostrar el popup de cupón | `CartContext.jsx:19`, `PromoPopup.jsx:37` | Funcionamiento y promoción. **No informado** |
| `dizor_promo_popup_seen` | sessionStorage | propio | no repetir el popup | "1" | sesión | al cerrar el popup | `components/marketing/PromoPopup.jsx:8,41` | Preferencias. **No informado** |
| `dizor_favorites_v1` | localStorage | propio | favoritos de invitado | ids de producto | persistente | al marcar | `context/FavoritesContext.jsx:25` | Funcionamiento |
| `dizor_guest_email`, `dizor_guest_name` | **sessionStorage** (la política dice "cookies") | propio | prellenar el registro después del pago con Wompi | **correo y nombre** | sesión, o hasta cerrar el modal | antes de redirigir a Wompi | `checkout/page.js:299-300`, `pedido/confirmacion/page.js:238-282` | Funcionamiento, con dato personal (H-10) |
| `dizor_last_visit_day` | localStorage | propio | contador de visitas | fecha | persistente | al cargar el pie de página | `components/layout/VisitCounter.jsx:6` | Estadística agregada |
| `dizor_cookie_preferences` | localStorage | propio | decisión de consentimiento | categorías, fecha, versión | persistente | decisión del usuario | `lib/consentPreferences.js:15` | Funcionamiento |
| `dizor_analytics_consent` | localStorage | propio | estado técnico de analítica | "granted" | persistente | aceptar analítica | `lib/analytics/consent.js:15` | Funcionamiento (ver H-07) |
| `dizor_ga_purchase_fired_<pedido>` | localStorage | propio | evitar duplicar `purchase` en GA | **n.º de pedido** | persistente, sin limpieza | compra con analítica aceptada | `lib/analytics/purchaseDedup.js:8` | Analítica. **No informado** |
| `dizor_dismissed_alerts` | localStorage | propio (solo panel admin) | alertas descartadas | ids | persistente | panel admin | `components/admin/AlertBell.jsx:8` | Funcionamiento interno |
| `_ga`, `_ga_<id>` | cookies de Google Analytics | Google | analítica | identificador de cliente | según Google [N] | solo con consentimiento y si el ID está configurado | `components/analytics/AnalyticsTracker.jsx:75-86` | Analítica. **Inactivo en producción** [P] |

Solicitudes a terceros al cargar páginas [E][P]:

- `res.cloudinary.com` recibe la IP, el user-agent y el origen por referer cuando el navegador carga imágenes, sin consentimiento previo. Es un servicio de alojamiento, no un rastreador, pero conviene informarlo como proveedor.
- `googletagmanager.com` y `google-analytics.com` solo se contactarían con consentimiento y con un ID configurado.

### B.6 Terceros y flujos de datos [E]/[P]

| Tercero | Datos que recibe | Momento | Rol probable* |
|---|---|---|---|
| MongoDB Atlas | toda la BD | siempre | encargado |
| Resend | correo y nombre del cliente, productos, dirección (en el correo de envío) y datos del pedido (en el correo al administrador) | recuperar contraseña, despacho, carrito abandonado, nuevo pedido o solicitud | encargado |
| Cloudinary | IP y user-agent del visitante (imágenes), imágenes subidas por el administrador | navegación | encargado |
| Wompi | n.º de pedido e importe; el cliente introduce sus datos en Wompi | pago | probablemente responsable independiente o encargado* |
| Nequi | teléfono e importe | pago | ídem* |
| Transportadoras | nombre, dirección y teléfono (operación manual, no automatizada en el código) | despacho | ídem* |
| WhatsApp (Meta) | lo que el cliente escriba, incluido el comprobante Nequi y el texto prellenado con datos del pedido | iniciado por el usuario | responsable independiente* |
| Google Analytics | eventos de navegación y comercio (inactivo) | con consentimiento | encargado o corresponsable* |
| Hosting (LiteSpeed, proveedor no identificado) | logs de acceso con IP y URL | siempre | encargado* |

\* El rol jurídico y la ubicación de los datos dependen de los contratos, que no se pudieron revisar (H-13).

---

## C. Matriz de hallazgos

Escala de prioridad:

- **Alta**: obligación legal verificada y un incumplimiento observable en producción, o un riesgo directo sobre datos de clientes.
- **Media**: brecha relevante con impacto acotado, o latente.
- **Baja**: mejora o inexactitud menor.

---

### H-01 — Responsable del tratamiento no identificado; política de privacidad publicada con marcadores

- **Área:** Privacidad, información al titular.
- **Estado:** Confirmado.
- **Evidencia:**
  - [E] `frontend/src/app/(shop)/politica-de-privacidad/page.js:30-35, 64-69, 90-95` contienen `[PLACEHOLDER — pendiente de revisión legal: razón social, NIT y domicilio…]`, `[…base jurídica detallada… plazos de conservación…]` y `[…canal y procedimiento formal para ejercer estos derechos]`.
  - [P] Las tres marcas aparecen en `https://sombrerosdizor.com.co/politica-de-privacidad` (consulta del 2026-11-16).
- **Entorno:** repositorio y producción.
- **Impacto y prioridad:** **Alta.** El titular no puede saber quién es el responsable, cómo ejercer sus derechos ni cuánto tiempo se conservan sus datos. La marca "Dizor" no equivale a la identidad legal del responsable.
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1581/2012, art. 12 (deber de informar la identidad y los datos de contacto del responsable) y art. 17 lit. k (manual de políticas); Decreto 1377/2013, art. 13 (contenido mínimo de la política: identificación, finalidades, derechos, área responsable, procedimiento, vigencia).
- **Corrección propuesta:** sustituir los marcadores por los datos reales del responsable, un canal de derechos operativo, plazos de conservación y la fecha de vigencia. Hasta tener esos datos, no publicar marcadores en producción.
- **Dependencias:** E-1, E-2, E-6 y E-7, y revisión jurídica.
- **Criterio de cierre:** ninguna página pública contiene la cadena "PLACEHOLDER". La política incluye todos los elementos del art. 13 del Decreto 1377, contrastados por un abogado.

### H-02 — La política de privacidad no refleja los tratamientos reales

- **Área:** Privacidad, coherencia entre política y operación.
- **Estado:** Confirmado.
- **Evidencia:** [E] comparación entre `politica-de-privacidad/page.js` y el inventario B.2 y B.6. La política:
  - no menciona la newsletter, los recordatorios de carrito abandonado, las reseñas públicas (nombre y ciudad), las solicitudes especiales, el registro de auditoría (IP y user-agent), Resend, Cloudinary, MongoDB Atlas, el hosting ni WhatsApp;
  - presenta a Nequi como "pasarela" (también es un flujo manual vía WhatsApp);
  - afirma que se usa Google Analytics, que está inactivo (ver H-09).
- **Entorno:** repositorio y producción.
- **Impacto y prioridad:** **Alta.** El principio de finalidad exige informar cada finalidad. Las finalidades de marketing no aparecen.
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1581/2012, art. 4 lit. b (finalidad) y art. 12; Decreto 1377/2013, art. 13.
- **Corrección propuesta:** redactar, una vez aprobada por el negocio y revisada jurídicamente, una política basada en el inventario B.2 a B.6: finalidades por tratamiento, destinatarios y encargados, transferencias, conservación y derechos.
- **Dependencias:** H-13, E-3 y E-4.
- **Criterio de cierre:** cada tratamiento de B.2 y cada tercero de B.6 aparece en la política, o el tratamiento se elimina del sistema.

### H-03 — Formularios sin aviso de privacidad ni autorización registrada

- **Área:** Privacidad, formularios y autorizaciones.
- **Estado:** Confirmado.
- **Evidencia:**
  - [E] Ningún formulario de B.2 enlaza la política ni incluye un texto de autorización. La búsqueda de "privacidad", "autoriz", "términ" y "checkbox" no da resultados en registro, checkout, newsletter, popup, carrito ni reseñas. En `personalizar/page.js:172` hay una casilla, pero es una opción del producto.
  - [E] Los modelos `User`, `Order`, `NewsletterSubscriber`, `AbandonedCart`, `SpecialRequest` y `Review` no tienen campos de autorización, fecha, versión ni canal.
  - [P] En producción, `popup.enabled: true` con formulario de newsletter (`/api/marketing/config`).
- **Entorno:** repositorio y producción.
- **Impacto y prioridad:** **Alta.** No hay prueba de autorización (exigible al responsable), y el titular no recibe la información del art. 12 en el momento de la recolección.
- **Fundamento:**
  - OBLIGACIÓN LEGAL VERIFICADA: Ley 1581/2012, arts. 9 y 12; Decreto 1377/2013, art. 5 (autorización a más tardar en la recolección), art. 7 (conducta inequívoca; "en ningún caso el silencio" vale como autorización), art. 8 (conservar prueba) y art. 14 (aviso de privacidad).
  - INTERPRETACIÓN PENDIENTE DE REVISIÓN JURÍDICA: qué tratamientos pueden apoyarse en la conducta inequívoca del titular (por ejemplo, completar el checkout para ejecutar la compra) y cuáles requieren autorización separada (newsletter y recordatorios comerciales). La Ley 1581, art. 10, no enumera la ejecución de un contrato entre las excepciones, así que no conviene presuponerla.
- **Corrección propuesta:**
  1. Añadir un aviso de privacidad por capas junto a cada formulario, con un enlace a la política.
  2. Separar la aceptación contractual (términos), el tratamiento para gestionar el pedido o la solicitud, y el marketing. Este último debe ser opcional, sin casilla premarcada y sin condicionar la compra.
  3. Persistir la evidencia: fecha y hora, versión del texto, canal o formulario e identificador.
- **Dependencias:** H-01, H-02, E-5 y revisión jurídica de los textos.
- **Criterio de cierre:** cada formulario muestra el aviso antes de enviar. Las casillas de marketing aparecen desmarcadas por defecto. Cada registro creado guarda la versión del texto y la marca temporal, verificable en la BD de pruebas.

### H-04 — Newsletter sin evidencia de autorización ni baja autoservicio

- **Área:** Marketing.
- **Estado:** Confirmado. El envío real de campañas está pendiente de información.
- **Evidencia:**
  - [E] `backend/src/models/newsletterSubscriber.js` guarda solo correo, nombre, origen y `createdAt`.
  - [E] `backend/src/services/marketingService.js:48-56` reactiva en silencio a un suscriptor dado de baja si vuelve a suscribirse (aceptable si es una nueva acción del titular, pero sin rastro).
  - [E] La baja solo existe para administradores: `marketingAdminController.js:185-194`. No hay enlace ni endpoint público de baja.
  - [E] El repositorio no envía campañas. Existe una exportación CSV (`marketingAdminController.js:101`), lo que sugiere que se envían desde una herramienta externa [N].
- **Entorno:** repositorio y producción (formulario activo).
- **Impacto y prioridad:** **Alta-media.** No es posible demostrar la autorización ni atender la revocación de forma autónoma.
- **Fundamento:**
  - OBLIGACIÓN LEGAL VERIFICADA: Ley 1581/2012, art. 8 lit. e (revocar la autorización); Decreto 1377/2013, arts. 8 y 9.
  - INTERPRETACIÓN PENDIENTE: aplicabilidad de la Ley 2300/2023 (horarios y canales de mensajes publicitarios, art. 5 según el texto consultado) a los correos promocionales de DIZOR.
- **Corrección propuesta:** registrar la evidencia de autorización (H-03). Ofrecer un enlace de baja con un token por suscriptor en cada envío y una página pública de baja. Identificar la herramienta de envío y aplicar en ella la baja (sincronización o lista de supresión).
- **Dependencias:** E-8.
- **Criterio de cierre:** un suscriptor de prueba puede darse de baja sin intervención humana. Tras la baja deja de aparecer en la exportación y en la herramienta de envío.

### H-05 — Recordatorios de carrito abandonado: inscripción automática de usuarios registrados y correos sin baja

- **Área:** Marketing.
- **Estado:** Confirmado [E]. Está pendiente saber si el script se ejecuta en producción.
- **Evidencia:**
  - [E] `backend/src/controllers/cartController.js:127-134`: cada sincronización del carrito de un usuario autenticado crea o actualiza un `AbandonedCart` con su correo. **No hay ninguna acción del usuario que lo solicite.**
  - [E] `backend/src/services/marketingService.js:117-160` envía hasta `maxReminders` (por defecto 2) correos tras `delayHours` (por defecto 24). El envío no comprueba ninguna preferencia ni franja horaria.
  - [E] `backend/src/services/emailService.js` (`sendAbandonedCartEmail`) no incluye enlace de baja ni identificación del remitente más allá de "Sombreros artesanales — Sandoná, Nariño".
  - [E] Para invitados, `AbandonedCartCapture.jsx:39-41` sí exige una acción afirmativa ("¿Quieres que te recordemos…?"), pero sin aviso de privacidad.
  - [E] La ejecución depende de `npm run marketing:reminders` (`backend/package.json`). No hay programador en el repositorio [N].
- **Entorno:** repositorio.
- **Impacto y prioridad:** **Alta.** Se envía comunicación comercial (recuperar una venta) a titulares que no la solicitaron. El mensaje no es transaccional.
- **Fundamento:**
  - OBLIGACIÓN LEGAL VERIFICADA: Ley 1581/2012, art. 4 lit. b y c (finalidad y libertad) y art. 9.
  - RECOMENDACIÓN: tratar el recordatorio como mensaje comercial.
  - INTERPRETACIÓN PENDIENTE: Ley 2300/2023.
- **Corrección propuesta:** eliminar la inscripción automática en `syncCart` o condicionarla a una preferencia explícita del usuario. Añadir baja en cada correo, comprobación de la preferencia antes de enviar y, si aplica, franja horaria. Definir la conservación de `AbandonedCart` (H-12).
- **Dependencias:** decisión de negocio sobre si mantener la funcionalidad (E-8).
- **Criterio de cierre:** un usuario de prueba registrado que añade productos sin optar por los recordatorios no genera ningún `AbandonedCart` ni recibe correo. Un usuario que opta puede darse de baja desde el propio correo.

### H-06 — Correo y nombre del cliente en URLs y en query strings de la API

- **Área:** Privacidad, minimización y seguridad.
- **Estado:** Confirmado en cuanto a la presencia en URLs. La transmisión a GA es un indicio, porque GA está inactivo.
- **Evidencia:**
  - [E] `frontend/src/app/(shop)/checkout/page.js:351-364` y `:190-203` construyen `/pedido/confirmacion?order=…&email=<correo>&name=<nombre>&…`.
  - [E] `pedido/confirmacion/page.js:90` genera `/login?email=…` y la línea `:406` genera `/seguimiento?order=…&email=…`.
  - [E] `frontend/src/services/checkoutService.js:18-20` y `specialRequestService.js:8-10` envían el correo como parámetro de un GET (`/api/checkout/track`, `/api/special-requests/track`).
  - [E] `backend/src/app.js:63-67`: morgan en formato `combined` en producción registra la URL completa en `logs/combined-*.log`, que se conserva 14 días (`lib/logger.js:229-236`).
  - [E] `lib/analytics/events.js:97-102` y `AnalyticsTracker.jsx:21-26` sanean `page_path`, pero no fijan `page_location`. gtag.js envía por defecto la URL completa del documento con cada evento (comportamiento estándar de GA4 que no se pudo verificar en red [N]). Con GA activo, el correo y el nombre de `/pedido/confirmacion` llegarían a Google.
- **Entorno:** repositorio. Producción tiene las mismas rutas.
- **Impacto y prioridad:** **Media-alta.** El dato personal queda en el historial del navegador, en los logs del servidor y del hosting, y potencialmente en un tercero. Contradice la política, que afirma que GA "nunca" recibe datos de contacto.
- **Fundamento:**
  - OBLIGACIÓN LEGAL VERIFICADA: Ley 1581/2012, art. 4 lit. g (seguridad) y lit. f (circulación restringida); Ley 1480, art. 50 lit. f (seguridad de los datos de la transacción).
  - RECOMENDACIÓN TÉCNICA: no transportar datos personales en URLs.
- **Corrección propuesta:** pasar los datos de confirmación por estado del cliente o sessionStorage, o recuperarlos del backend con un token opaco de un solo uso. Cambiar los endpoints de seguimiento a POST con cuerpo. Si se activa GA, fijar `page_location` saneado en `config` y en cada evento.
- **Dependencias:** ninguna externa.
- **Criterio de cierre:** una compra de prueba no deja ningún correo ni nombre en la barra de direcciones, el historial, los logs de acceso ni los payloads de `collect` de GA (verificado en DevTools).

### H-07 — Dos claves de consentimiento desincronizadas: cambiar la versión de la política no revoca la analítica

- **Área:** Cookies y consentimiento.
- **Estado:** Confirmado [E]. El impacto es latente porque GA está inactivo.
- **Evidencia:**
  - `lib/consentPreferences.js:18,29` invalida `dizor_cookie_preferences` si cambia `CONSENT_VERSION` y vuelve a mostrar el banner.
  - Pero `lib/analytics/consent.js:20-24,56-58` lee `dizor_analytics_consent === "granted"` sin comprobar ninguna versión.
  - `AnalyticsTracker.jsx:68,75` carga gtag.js según esta segunda clave. Al subir la versión, GA se cargaría **antes** de que el usuario tome la nueva decisión.
- **Impacto y prioridad:** **Media.** Se activaría analítica sin una decisión vigente.
- **Fundamento:** RECOMENDACIÓN TÉCNICA. Coherencia con la autorización previa (Ley 1581, art. 9) si la analítica se considera tratamiento sujeto a autorización (ver §F.3).
- **Corrección propuesta:** usar una única fuente de verdad (el registro versionado) o derivar `hasAnalyticsConsent` del registro con la versión vigente.
- **Criterio de cierre:** con `CONSENT_VERSION` incrementada y un consentimiento antiguo guardado, no se solicita `googletagmanager.com` hasta una nueva aceptación (verificado en la pestaña de red).

### H-08 — Retirar el consentimiento no elimina las cookies `_ga` ni detiene gtag.js ya cargado; Enhanced Measurement fuera de control

- **Área:** Cookies y consentimiento.
- **Estado:** Indicio (latente).
- **Evidencia:**
  - [E] `consentPreferences.js:109-112` y `events.js:84-95` solo envían `consent update analytics_storage: denied`. No borran las cookies `_ga*` ni desmontan el script, que permanece en memoria durante la sesión.
  - [E] Las exclusiones de ruta (`urlSanitizer.js:2`: `/admin`, `/restablecer`…) solo afectan al `page_view` manual. Los eventos automáticos de Enhanced Measurement (scroll, clics salientes, formularios), si están activados en la propiedad GA4 [N], no pasan por `trackEvent` y podrían enviarse desde `/restablecer/<token>`.
  - [E] `AnalyticsTracker` está en el layout raíz (`app/layout.js:132`) y también se monta en `/admin` y `/vendedor`, donde no hay banner.
- **Impacto y prioridad:** **Media** (solo si se activa GA).
- **Fundamento:** RECOMENDACIÓN TÉCNICA. INTERPRETACIÓN PENDIENTE: alcance de la revocación (Ley 1581, art. 8 lit. e) aplicado a identificadores de analítica.
- **Corrección propuesta:** al retirar el consentimiento, eliminar las cookies `_ga*` del dominio y recargar, o bien bloquear el envío. Desactivar Enhanced Measurement en GA4 o fijar `page_location` saneado. No montar el tracker en rutas de staff.
- **Dependencias:** acceso a la propiedad GA4 (E-9).
- **Criterio de cierre:** tras retirar el consentimiento no hay peticiones a `google-analytics.com` y las cookies `_ga*` desaparecen (escenario e de §D).

### H-09 — El banner y la política anuncian Google Analytics, que no está activo en producción; la CSP no admite los endpoints regionales de GA4

- **Área:** Cookies, exactitud de la información.
- **Estado:** Confirmado [P] respecto al ID. Indicio respecto a la CSP.
- **Evidencia:**
  - [P] El bundle `/_next/static/chunks/00dss~ufi7_04.js` conserva la referencia `process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID` sin un valor incluido, así que `isAnalyticsConfigured()` devuelve `false` y `AnalyticsTracker` no renderiza nada. No se encontró ningún ID `G-…` en los bundles.
  - [P] La política de cookies dice "Usamos Google Analytics 4" y el banner pide permiso para "cookies analíticas".
  - [P] La CSP de producción permite `connect-src https://www.google-analytics.com https://analytics.google.com`, pero no `*.google-analytics.com` (GA4 suele enviar a subdominios regionales [N]).
- **Impacto y prioridad:** **Baja.** Información inexacta y una analítica que fallaría silenciosamente al activarse.
- **Fundamento:** RECOMENDACIÓN (exactitud de la información al titular, Ley 1581, art. 12).
- **Corrección propuesta:** decidir si se usará GA (E-9). Si no se usa, retirar la categoría o indicar que no está activa. Si se usa, ampliar la CSP según la documentación de Google y verificar.
- **Criterio de cierre:** el texto del banner y de la política coincide con las solicitudes de red observadas en los escenarios a) a c).

### H-10 — El inventario de la política de cookies no coincide con el almacenamiento real

- **Área:** Cookies.
- **Estado:** Confirmado [E].
- **Evidencia:** comparación de `politica-de-cookies/page.js:43-50` con B.5.
  - Omite `dizor_pending_popup_coupon`, `dizor_promo_popup_seen`, `dizor_ga_purchase_fired_*` (guarda números de pedido sin limpieza) y la carga de imágenes desde Cloudinary.
  - Llama "cookies" a elementos de localStorage y sessionStorage.
  - Califica `dizor_guest_email` y `dizor_guest_name` (correo y nombre) como "necesarias", aunque su finalidad es prellenar un registro opcional.
  - No indica las duraciones ni que `dizor_visit_day` la emite el subdominio de la API.
- **Impacto y prioridad:** **Baja-media.**
- **Fundamento:** RECOMENDACIÓN y Ley 1581, art. 12 (información veraz). Que una cookie sea "necesaria" no elimina el deber de informar el tratamiento de los datos personales que contenga.
- **Corrección propuesta:** publicar una tabla basada en B.5, con nombre, tipo, proveedor, finalidad, duración y categoría. Revisar si la prellenada del registro necesita guardar el correo, o si puede usar un token.
- **Criterio de cierre:** la tabla publicada coincide con lo observado en Application > Storage en los escenarios a) y c).

### H-11 — Sin canal ni procedimiento para los derechos de los titulares; sin eliminación de cuenta

- **Área:** Privacidad, derechos.
- **Estado:** Confirmado [E][P].
- **Evidencia:**
  - [E] `backend/src/routes/authRoutes.js` permite ver y editar el perfil y las direcciones, pero no ofrece `DELETE /me`, exportación ni revocación.
  - [E] La baja de newsletter solo la puede hacer un administrador.
  - [P] La política remite a un PLACEHOLDER. No hay correo de contacto publicado; solo WhatsApp.
- **Impacto y prioridad:** **Alta.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1581/2012, art. 8 (derechos), art. 14 (consultas: 10 días hábiles, prorrogables 5) y art. 15 (reclamos: 15 días hábiles, prorrogables 8; leyenda "reclamo en trámite" en 2 días hábiles); Decreto 1377/2013, arts. 9 y 13.
- **Corrección propuesta:** definir un canal (correo dedicado o formulario) con registro de la fecha de recepción. Crear un procedimiento interno con plazos y un flujo técnico para supresión o anonimización que respete las obligaciones de conservación (H-12). **No prometer eliminación inmediata de todo dato**: los pedidos pueden estar sujetos a conservación legal (pendiente jurídico).
- **Dependencias:** E-2 y E-6.
- **Criterio de cierre:** el canal está publicado. Una solicitud de prueba queda registrada con fecha y se responde dentro del plazo. La supresión de una cuenta de prueba elimina o anonimiza los datos no sujetos a conservación.

### H-12 — Sin criterios de conservación ni eliminación

- **Área:** Privacidad, conservación.
- **Estado:** Confirmado [E] (ausencia en el código). Las políticas internas están pendientes de información.
- **Evidencia:**
  - No hay índices TTL ni tareas de purga para `AbandonedCart`, `NewsletterSubscriber` inactivos, `AuditLog` (correo, IP, user-agent y datos previos y nuevos), `SpecialRequest`, `Order` ni `User` inactivos. La búsqueda de `expireAfterSeconds`, `TTL` y `deleteMany` no da resultados relevantes.
  - Los logs de archivo sí rotan (14 y 30 días, `lib/logger.js`). La retención de los logs del hosting se desconoce [N].
  - `purchaseDedup.js` deja claves indefinidas en el navegador.
- **Impacto y prioridad:** **Media.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Decreto 1377/2013, art. 11 (conservar "durante el tiempo que sea razonable y necesario") y art. 13 (la política debe indicar el periodo de vigencia de la base). INTERPRETACIÓN PENDIENTE: plazos de conservación contables, tributarios y comerciales de pedidos y facturas.
- **Corrección propuesta:** definir los plazos por colección (E-6) e implementarlos con TTL o tareas programadas.
- **Criterio de cierre:** cada colección con datos personales tiene un plazo documentado y un mecanismo de purga probado en el entorno de pruebas.

### H-13 — Encargados, contratos y transferencias internacionales sin documentar

- **Área:** Privacidad, proveedores.
- **Estado:** Pendiente de información.
- **Evidencia:** [E] proveedores en uso según B.6. La región de MongoDB Atlas, la ubicación de Resend, Cloudinary y el hosting, y la existencia de contratos de transmisión no son verificables desde el repositorio. Que el proveedor sea una marca extranjera no prueba la región contratada.
- **Impacto y prioridad:** **Media.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1581/2012, art. 26 (transferencias); Decreto 1377/2013, art. 25 (contrato de transmisión con encargados). INTERPRETACIÓN PENDIENTE: distinguir entre transferencia y transmisión para cada proveedor, y cuáles de ellos son responsables independientes (Wompi, Nequi, transportadoras, WhatsApp).
- **Corrección propuesta:** inventariar los contratos y DPA de cada proveedor y la región de alojamiento, e informarlos en la política.
- **Dependencias:** E-3 y E-4.
- **Criterio de cierre:** existe un registro interno con proveedor, rol, región, contrato y fecha, y la política lo refleja.

### H-14 — Reseñas: datos públicos sin aviso, y reseñas de marca indistinguibles de las de clientes

- **Área:** Privacidad y comercio (publicidad).
- **Estado:** Confirmado [E]. El origen de las reseñas publicadas está pendiente.
- **Evidencia:**
  - `reviewController.js:76-77` publica el nombre y la ciudad.
  - `reviewController.js:194-199`: el administrador puede crear reseñas `isBrandReview` con cualquier `authorName` y `city`, y `reviewController.js:22` las ordena primero.
  - `HomeReviews.jsx:57-60` y `ProductReviews.jsx:91-92` no muestran ninguna marca que las distinga. Solo el panel admin la muestra (`ReviewsTab.jsx:233`).
  - Las reseñas de clientes exigen compra verificada (`reviewService.js:48-76`), lo cual es positivo.
- **Impacto y prioridad:** **Media.** Un testimonio creado por la marca y presentado como si fuera de un cliente puede inducir a error.
- **Fundamento:** INTERPRETACIÓN PENDIENTE DE REVISIÓN JURÍDICA: la Ley 1480 (información y publicidad engañosa; los artículos específicos no se consultaron en esta auditoría) y el principio de finalidad (Ley 1581, art. 4) para publicar el nombre y la ciudad.
- **Corrección propuesta:** etiquetar o separar las reseñas de marca. Conservar el respaldo de cada testimonio (autorización de la persona y origen). Informar en el formulario que el nombre y la ciudad serán públicos y hacer la ciudad opcional y explícita.
- **Dependencias:** E-11.
- **Criterio de cierre:** ninguna reseña de marca aparece sin una etiqueta visible, y cada testimonio de tercero tiene un respaldo archivado.

### H-15 — Sin identificación del vendedor

- **Área:** Comercio electrónico.
- **Estado:** Confirmado [P].
- **Evidencia:** [P] La portada y el pie de página no muestran razón social, NIT, dirección de notificación judicial ni correo. Solo aparecen WhatsApp (+57 315…) y "Sandoná, Nariño". El pie de página atribuye "Todos los derechos reservados" al desarrollador del sitio, no al titular de la tienda (`SiteFooter.jsx:76-84`).
- **Impacto y prioridad:** **Alta.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1480/2011, art. 50 lit. a (no modificado por la Ley 2439): nombre o razón social, NIT, dirección de notificación judicial, teléfono, correo electrónico y demás datos de contacto.
- **Corrección propuesta:** publicar los datos del vendedor en el pie de página y en los términos. Ajustar el aviso de derechos de autor para distinguir el crédito de desarrollo del titular.
- **Dependencias:** E-1.
- **Criterio de cierre:** los datos del art. 50 lit. a son visibles desde cualquier página.

### H-16 — Sin enlace visible a la autoridad de protección al consumidor

- **Área:** Comercio electrónico.
- **Estado:** Confirmado [E][P]. No hay ninguna referencia a "sic.gov.co" en el código ni en el sitio.
- **Impacto y prioridad:** **Alta** (y de corrección sencilla).
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1480/2011, art. 50, parágrafo ("enlace visible, fácilmente identificable" a la página de la autoridad de protección al consumidor de Colombia).
- **Corrección propuesta:** añadir un enlace a la SIC en el pie de página global.
- **Criterio de cierre:** el enlace está presente y es visible en todas las plantillas públicas.

### H-17 — Sin términos y condiciones generales

- **Área:** Comercio electrónico.
- **Estado:** Confirmado [P]: 404 en las rutas probables y sin enlace en el pie de página ni en el checkout.
- **Impacto y prioridad:** **Alta.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1480/2011, art. 50 lit. d (publicar las condiciones generales de los contratos de forma accesible, imprimible y descargable). Las condiciones generales también están sujetas a los arts. 37 y 43 (cláusulas ineficaces).
- **Corrección propuesta:** redactar los términos con revisión jurídica: identificación, proceso de compra, precios, pagos, envíos y plazos, retracto, garantía, reversión, PQR y ley aplicable. Enlazarlos en el pie de página y en el checkout.
- **Dependencias:** E-1, E-10 y revisión jurídica.
- **Criterio de cierre:** la página existe, es descargable o imprimible, y está enlazada en el checkout antes de confirmar.

### H-18 — Retracto, garantía y reversión del pago: no informados; la "Política de cambios" mezcla figuras y puede limitar derechos

- **Área:** Comercio electrónico.
- **Estado:** Confirmado [P].
- **Evidencia:** [P] `/pagina/cambios` dice: "las piezas personalizadas no tienen devolución salvo defecto de fabricación" y "Para productos de catálogo estándar, contáctanos dentro de los 5 días hábiles posteriores a la entrega si recibes un artículo dañado o incorrecto." No menciona el retracto, el término de la garantía legal ni la reversión del pago.
- **Impacto y prioridad:** **Alta.**
  1. Omite el retracto en una venta a distancia.
  2. Limita la reclamación por defectos a 5 días hábiles, lo que puede chocar con el término de la garantía legal.
  3. Aplica la excepción de "personalizado" sin definirla. Un producto artesanal de catálogo no es, por ese solo hecho, un bien "confeccionado conforme a las especificaciones del consumidor".
- **Fundamento:**
  - OBLIGACIÓN LEGAL VERIFICADA:
    - Ley 1480, art. 47: retracto de 5 días hábiles desde la entrega en ventas a distancia, con excepciones, entre ellas los bienes personalizados (num. 3). Devolución del dinero en máximo 15 días calendario según la Ley 2439/2024, art. 3.
    - Art. 50 lit. c: informar el derecho de retracto y el procedimiento para ejercerlo.
    - Art. 51: reversión del pago.
    - Arts. 7 y 8: garantía legal; si no se anuncia término, el texto consultado indica un año para productos nuevos (confirmar con el abogado y con el Decreto 735/2013, no consultado).
    - Art. 43 num. 1 y 2: son ineficaces las cláusulas que limitan la responsabilidad legal o implican renuncia de derechos.
  - INTERPRETACIÓN PENDIENTE: qué productos de DIZOR encajan realmente en la excepción del num. 3 del art. 47.
  - Nota: la Sentencia C-192/26 extendió el plazo de 15 días a todas las modalidades del art. 47. Esto se conoce solo por un resumen de resultados de búsqueda; el texto de la sentencia no se leyó.
- **Corrección propuesta:** separar en el sitio cuatro procedimientos:
  1. Garantía legal: término y procedimiento.
  2. Retracto: plazo, excepciones justificadas por tipo de producto, costos de devolución a cargo del consumidor y reembolso en 15 días.
  3. Reversión del pago: causales y plazo de 5 días hábiles para reclamar.
  4. Cambios comerciales voluntarios, si se ofrecen.
- **Dependencias:** E-10 y revisión jurídica.
- **Criterio de cierre:** las cuatro figuras aparecen diferenciadas, con plazos contrastados por un abogado, y ninguna cláusula excluye derechos legales.

### H-19 — Checkout: sin términos, información de retracto ni plazo de entrega, y sin resumen detallado antes de confirmar

- **Área:** Comercio electrónico.
- **Estado:** Confirmado [E]. En producción la página `/checkout` responde 200, pero no se recorrió.
- **Evidencia:**
  - [E] El paso "Revisión y confirmación" (`checkout/page.js:678-773`) muestra el cliente, la ciudad, la transportadora, el pago, el subtotal, el IVA, el envío y el total. **No lista los productos con su descripción ni el precio individual**, no es imprimible ni descargable, y no enlaza términos, retracto ni plazo de entrega.
  - [E] No hay casilla ni texto de aceptación. El backend no registra la versión de los términos (`checkoutController.js:142-392`, modelo `Order`).
  - [E] El carrito sí lista los productos (`carrito/page.js`), pero el resumen legal debe presentarse antes de concluir la transacción.
- **Impacto y prioridad:** **Alta.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1480, art. 50 lit. c (medios de pago, tiempo de entrega, retracto, precio total con impuestos y gastos de envío por separado), lit. d (resumen previo con descripción completa, precio individual, precio total y costos adicionales; posibilidad de corregir; imprimible o descargable) y lit. e (soporte duradero de la identidad, la voluntad expresa de compra, la forma de pago y la entrega).
- **Corrección propuesta:** incluir en el último paso las líneas del pedido con su descripción y precio unitario, el plazo de entrega, un enlace a términos y retracto, y una opción de imprimir o descargar. Registrar en `Order` la aceptación con versión y fecha.
- **Criterio de cierre:** una compra de prueba muestra todos los elementos del lit. d antes de "Confirmar pedido", y el `Order` resultante guarda la versión de los términos aceptada.

### H-20 — No se envía acuse de recibo al consumidor; la confirmación dice "¡Pedido confirmado!" aunque el pago esté pendiente

- **Área:** Comercio electrónico.
- **Estado:** Confirmado [E] en el repositorio. En producción está pendiente [N], porque el backend desplegado difiere (H-24).
- **Evidencia:**
  - [E] Al crear el pedido solo se envía `sendNewOrderAdminEmail` (`checkoutController.js:367`). El cliente solo recibe un correo al despachar (`orderAdminController.js:180,315`).
  - [E] `pedido/confirmacion/page.js:308-311` muestra "¡Pedido confirmado!" para todos los métodos, incluidos Wompi (el pago puede estar pendiente o haber sido rechazado) y Nequi manual (pago no realizado).
- **Impacto y prioridad:** **Alta.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1480, art. 50 lit. d (acuse de recibo "a más tardar el día calendario siguiente de efectuado el pedido", con tiempo de entrega, precio exacto con impuestos, gastos de envío y forma de pago).
- **Corrección propuesta:** enviar un correo transaccional al cliente al crear el pedido con el contenido mínimo legal. Ajustar el texto de la confirmación según el estado real del pago.
- **Criterio de cierre:** un pedido de prueba genera el acuse de recibo al correo del comprador en menos de 24 h, con todos los campos exigidos.

### H-21 — Plazo de entrega no informado

- **Área:** Comercio electrónico.
- **Estado:** Confirmado [P]. `/pagina/envios` dice "Los tiempos de entrega dependen de la ciudad destino" y no da plazos.
- **Impacto y prioridad:** **Media.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: art. 50 lit. c (tiempo de entrega) y lit. h, modificado por la Ley 2439/2024, art. 4 (entregar en el plazo aceptado; a falta de plazo, máximo 30 días calendario; derecho a terminar el contrato y recibir la devolución en 15 días calendario si hay retraso o falta de disponibilidad).
- **Corrección propuesta:** publicar los plazos por zona o tipo de producto (los personalizados pueden tener plazos de fabricación propios) y mostrarlos en el checkout y en el acuse de recibo.
- **Dependencias:** E-10.
- **Criterio de cierre:** el plazo es visible antes de confirmar y aparece en el acuse de recibo.

### H-22 — Sin canal PQR con radicado y trazabilidad

- **Área:** Comercio electrónico.
- **Estado:** Confirmado [E][P]. Solo existe WhatsApp, sin número de caso. "Mis solicitudes" corresponde a personalización y por mayor, no a PQR.
- **Impacto y prioridad:** **Alta.**
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: art. 50 lit. g, modificado por la Ley 2439/2024, art. 4 (canales de fácil acceso en el mismo medio; número de registro o radicado con fecha y hora; trazabilidad).
- **Corrección propuesta:** crear un formulario PQR (se puede reutilizar el patrón de `SpecialRequest` y su seguimiento) que asigne un radicado y registre la fecha y la hora. Recomendable que comparta el canal con las solicitudes de datos personales (H-11).
- **Criterio de cierre:** una PQR de prueba recibe un radicado con fecha y hora, y su estado puede consultarse.

### H-23 — Afirmaciones comerciales y contenido que requieren respaldo

- **Área:** Comercio electrónico, publicidad e imagen.
- **Estado:** Pendiente de información.
- **Evidencia:**
  - [P] `/pagina/nosotros`: "familias tejedoras de Sandoná", "elaborado a mano", "comercio justo".
  - [E] La semilla del catálogo usa "Palma de iraca 100%" e imagen de Unsplash (`seedCatalog.js:92-101`). No se verificó si hay imágenes de stock en producción [N].
  - [P] Hay enlaces a Instagram.
  - No se declara ninguna infracción.
- **Impacto y prioridad:** **Baja-media.** "Comercio justo" puede interpretarse como una certificación. Las fotos deben representar fielmente el producto (art. 50 lit. b, modificado).
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: art. 50 lit. b (información cierta e imágenes que representen el producto). INTERPRETACIÓN PENDIENTE: publicidad y uso de indicaciones de origen geográfico.
- **Corrección propuesta:** conservar el respaldo de cada afirmación (procedencia, proveedores, certificaciones si se alude a ellas) y de los derechos sobre fotografías y testimonios.
- **Dependencias:** E-11.
- **Criterio de cierre:** existe un registro de respaldo para cada afirmación y cada imagen publicada.

### H-24 — El backend desplegado no coincide con el repositorio

- **Área:** Alcance y gobierno.
- **Estado:** Confirmado [P].
- **Evidencia:**
  - [P] `GET https://api.sombrerosdizor.com.co/api/checkout/config` devuelve los métodos `wompi`, `nequi_api`, `nequi_manual` y `contra_entrega`.
  - [E] El repositorio solo ofrece `wompi` (si está configurado) y `contra_entrega` (`checkoutController.js:74-89`).
  - [P] `shippingFixedCost: 0` con `free_threshold`, frente a `SHIPPING_FIXED_COST=15000` en el `.env` local (posible configuración distinta en BD, no necesariamente del código).
- **Impacto y prioridad:** **Media.** Las conclusiones [E] sobre el backend pueden no reflejar producción, especialmente H-20, H-05 y H-06.
- **Corrección propuesta:** identificar el commit desplegado y repetir la verificación de H-05, H-06 y H-20 sobre esa versión.
- **Dependencias:** E-12.
- **Criterio de cierre:** el commit de producción está documentado y coincide con el auditado.

### H-25 — IVA sumado en el checkout sobre el precio exhibido (latente)

- **Área:** Comercio electrónico, precios.
- **Estado:** Indicio (latente). En producción `taxEnabled: false` [P].
- **Evidencia:** [E] `backend/src/services/cartService.js:65-85`: si `taxEnabled`, el IVA se suma al subtotal, lo que implica que el precio mostrado en el catálogo no incluiría impuestos.
- **Impacto y prioridad:** **Baja** (solo si se activa).
- **Fundamento:** OBLIGACIÓN LEGAL VERIFICADA: Ley 1480, art. 26 (precio de venta al público con todos los impuestos) y art. 50 lit. c.
- **Corrección propuesta:** si se activa el IVA, mostrar precios con IVA incluido y desglosarlo. No añadirlo al final.
- **Criterio de cierre:** el precio de la ficha de producto es igual al que se cobra por esa unidad, sin contar el envío.

### H-26 — Registro Nacional de Bases de Datos: aplicabilidad no determinada

- **Área:** Privacidad.
- **Estado:** Pendiente de información.
- **Fundamento:** INTERPRETACIÓN PENDIENTE. Ley 1581, art. 25 (RNBD). Según fuentes secundarias consultadas (el Decreto 090 de 2018 no se leyó en su texto oficial), la inscripción obliga a sociedades y entidades sin ánimo de lucro con activos totales superiores a 100.000 UVT y a personas jurídicas públicas. **No se presupone obligatoria.**
- **Dependencias:** E-1 (forma jurídica) y E-13 (activos).
- **Criterio de cierre:** existe una determinación jurídica documentada (obligado o no).

### H-27 — Menores y datos sensibles

- **Área:** Privacidad.
- **Estado:** Sin tratamiento efectivo detectado.
- **Evidencia:** [E] No se recogen fechas de nacimiento, documentos ni categorías especiales. Los campos libres (notas del pedido, detalles de personalización, comentarios) podrían recibir información sensible de forma espontánea.
- **Impacto y prioridad:** **Baja.**
- **Fundamento:** Ley 1581, arts. 5 y 7.
- **Corrección propuesta:** no añadir campos de edad ni documentos. Opcionalmente, incluir una indicación junto a los campos libres para que no se incluyan datos sensibles.
- **Criterio de cierre:** no aplica, salvo que cambie la funcionalidad.

### H-28 — Controles de seguridad menores vinculados a privacidad

- **Área:** Seguridad.
- **Estado:** Confirmado [E].
- **Evidencia:**
  - `GET /api/special-requests/track` no tiene un limitador específico (`specialRequestRoutes.js:15`), a diferencia de `/api/checkout/track` (`trackingLimiter`). Solo aplica el global de 300 peticiones cada 15 min.
  - El registro `AuditLog` guarda `previousData` y `newData` completos (tipo `Mixed`), que pueden incluir datos personales sin plazo de conservación (ver H-12).
  - Positivo: la contraseña y los tokens tienen `select:false`, el refresh token se guarda en hash, las cookies son httpOnly, el modo producción no expone stacks, las exportaciones están restringidas por rol y el seguimiento público solo devuelve ciudad y departamento.
- **Impacto y prioridad:** **Baja.**
- **Fundamento:** Ley 1581, art. 4 lit. g; Ley 1480, art. 50 lit. f.
- **Corrección propuesta:** aplicar `trackingLimiter` también a las solicitudes y minimizar `previousData` y `newData` en los registros de auditoría.
- **Criterio de cierre:** el límite responde 429 tras N intentos en el entorno de pruebas, y los registros de auditoría no guardan datos personales innecesarios.

---

## D. Resultados de pruebas

| # | Escenario | Esperado | Observado | Evidencia | Tipo |
|---|---|---|---|---|---|
| 1 | Lectura de la portada de producción | Sin cookies antes del consentimiento | Ningún `Set-Cookie` en la respuesta HTML | cabeceras de `GET /` (scratchpad local, no versionado) | [P] ejecutada |
| 2 | ¿Se incluye un ID de GA4 en producción? | — | No: el bundle conserva `process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID` sin valor; no hay ningún `G-…` | 14 chunks JS de la portada | [P] ejecutada |
| 3 | CSP de producción | Coherente con las integraciones | Incluye Wompi, Cloudinary, Unsplash y GA (sin endpoints regionales) | cabecera `content-security-policy` | [P] ejecutada |
| 4 | Contenido legal publicado | Políticas completas | Privacidad con 3 PLACEHOLDER; cambios y envíos idénticos a la semilla; sin términos (404) | WebFetch de las páginas; `GET /api/content/pages` | [P] ejecutada |
| 5 | Configuración pública de checkout y marketing | — | 4 métodos de pago; IVA desactivado; popup de newsletter activo | `GET /api/checkout/config`, `GET /api/marketing/config` | [P] ejecutada |
| 6 | Logs locales con correo en la URL | — | 0 coincidencias de `track…email=` en `backend/logs` (entorno de desarrollo, sin uso de seguimiento) | conteo con grep sin imprimir el contenido | [E] ejecutada |
| a | Primera visita sin interactuar | Sin GA ni rastreadores | — | — | **NO EJECUTADA** (sin navegador) |
| b | Rechazo | Sin GA; tienda funcional | — | — | **NO EJECUTADA** |
| c | Aceptación | GA solo tras aceptar | — | — | **NO EJECUTADA** (GA inactivo en producción) |
| d | Selección por categorías | Igual que b o c según la elección | — | — | **NO EJECUTADA** |
| e | Retirada | Fin de los envíos; borrado de `_ga` | Análisis estático: no borra `_ga` (H-08) | — | **NO EJECUTADA** |
| f | Recarga, navegación y nueva visita | Decisión recordada | Análisis estático: persiste en localStorage | — | **NO EJECUTADA** |
| g | Compra, registro, newsletter, PQR y correos | — | — | — | **NO EJECUTADAS**: no se permiten en producción, y el entorno local apunta a un clúster de MongoDB Atlas que podría ser el de producción |

Para ejecutar a) a g) se recomienda un entorno local con una **base de datos de pruebas aislada**, un ID de GA4 de pruebas, DevTools (Network, Application) y datos ficticios.

---

## E. Datos pendientes del propietario

| # | Dato | Decisión o documento que depende de él |
|---|---|---|
| E-1 | Identidad legal del vendedor y responsable: persona natural o jurídica, nombre o razón social, NIT, dirección de notificación judicial | H-01, H-15, H-17, H-26; política de privacidad y términos |
| E-2 | Correo y canal oficial para derechos de titulares y PQR, y área o persona responsable | H-01, H-11, H-22 |
| E-3 | Contratos o condiciones aceptadas con MongoDB Atlas, Resend, Cloudinary, hosting, Wompi y Nequi; región de alojamiento de cada uno | H-13, H-02 |
| E-4 | Proveedor de hosting de `sombrerosdizor.com.co` y de la API, y retención de sus logs | H-06, H-12, H-13 |
| E-5 | Qué finalidades quiere mantener el negocio (newsletter, recordatorios, reseñas públicas, prellenado de registro) | H-03, H-04, H-05, H-10 |
| E-6 | Plazos de conservación por tipo de dato, incluidas las obligaciones contables y tributarias de pedidos y facturas | H-11, H-12 |
| E-7 | Fecha de vigencia que tendrá la política y cómo se comunicarán los cambios | H-01 |
| E-8 | Herramienta usada para enviar la newsletter; si el script de recordatorios se ejecuta en producción y con qué frecuencia | H-04, H-05 |
| E-9 | Si se usará Google Analytics; acceso a la propiedad (Enhanced Measurement, retención, señales de Google) | H-07, H-08, H-09 |
| E-10 | Plazos reales de fabricación y entrega por zona; qué productos son realmente personalizados; si se ofrecen cambios voluntarios | H-17, H-18, H-21 |
| E-11 | Respaldo de los testimonios de marca, de "comercio justo" y del origen artesanal; licencias de las fotos | H-14, H-23 |
| E-12 | Commit o versión del backend y del frontend desplegados, y su variable `NEXT_PUBLIC_GA_MEASUREMENT_ID` | H-24, H-09 |
| E-13 | Si es sociedad: activos totales (para el umbral del RNBD) | H-26 |
| E-14 | Si se vende o se planea vender a consumidores fuera de Colombia (el sitio solo admite direcciones de departamentos colombianos y precios en COP) | §G, alcance de otras jurisdicciones |

---

## F. Plan de corrección por fases

### F.1 Cambios técnicos respaldados por evidencia (no requieren datos del negocio)

| Acción | IDs | Prueba de aceptación |
|---|---|---|
| Añadir un enlace visible a la SIC en el pie de página global | H-16 | El enlace está visible en todas las plantillas públicas |
| Retirar los correos y nombres de las URLs; seguimiento por POST | H-06 | No queda ningún correo en URL, historial ni logs tras una compra de prueba |
| Unificar la fuente de verdad del consentimiento con versión | H-07 | Al subir la versión, GA no carga hasta una nueva aceptación |
| Al retirar el consentimiento, borrar `_ga*` y no montar el tracker en `/admin` y `/vendedor` | H-08 | Escenario e) sin peticiones a GA |
| Mostrar en el último paso del checkout el detalle de líneas con precio unitario y la opción de imprimir o descargar | H-19 (parcial) | Todos los elementos del lit. d visibles antes de confirmar |
| Ajustar el texto de la confirmación según el estado real del pago | H-20 (parcial) | Con Wompi pendiente no aparece "¡Pedido confirmado!" |
| Eliminar la inscripción automática en `syncCart` | H-05 | Usuario de prueba sin opt-in → ningún `AbandonedCart` |
| Aplicar el rate-limit al seguimiento de solicitudes y minimizar `AuditLog` | H-28 | 429 tras N intentos; registros sin datos personales innecesarios |
| Etiquetar visualmente las reseñas de marca | H-14 (parcial) | Ninguna reseña de marca sin etiqueta |
| Actualizar la tabla de cookies y almacenamiento conforme a B.5 | H-10 | La tabla coincide con Application > Storage |

### F.2 Cambios que requieren decisiones o información del negocio

| Acción | IDs | Dependencia | Prueba de aceptación |
|---|---|---|---|
| Publicar la identificación del vendedor | H-15 | E-1, E-2 | Datos del lit. a visibles |
| Avisos de privacidad por formulario y registro de evidencia de autorización | H-03 | E-5 + textos aprobados | Cada registro guarda la versión, la fecha y el canal |
| Baja autoservicio para newsletter y recordatorios | H-04, H-05 | E-8 | Baja sin intervención humana, efectiva en la herramienta de envío |
| Acuse de recibo transaccional al cliente | H-20 | E-10 (plazos) | Correo con todos los campos del lit. d en menos de 24 h |
| Canal PQR y de derechos con radicado | H-11, H-22 | E-2 | Radicado con fecha y hora; consulta del estado |
| Plazos de entrega en el checkout | H-21 | E-10 | Plazo visible antes de confirmar |
| Purga y conservación por colección | H-12 | E-6 | TTL o tareas probadas en pruebas |
| Decidir sobre GA (activar con CSP correcta o retirar la categoría) | H-09 | E-9 | El banner y la política coinciden con la red |
| Identificar la versión desplegada y re-auditar el backend | H-24 | E-12 | El commit de producción coincide con el auditado |

### F.3 Puntos que requieren revisión jurídica

| Punto | IDs |
|---|---|
| Texto final de la política de tratamiento y de los avisos de privacidad; bases de cada tratamiento (autorización expresa frente a conducta inequívoca) | H-01, H-02, H-03 |
| Si la analítica con cookies requiere autorización previa conforme a la Ley 1581 (la normativa colombiana revisada no contiene una regla específica sobre cookies; no se consultaron las guías SIC de 2019 citadas por la Circular Externa 005 de 2020) | H-07, H-08 |
| Términos y condiciones; redacción de garantía, retracto (excepciones aplicables a productos personalizados de DIZOR), reversión del pago y cambios | H-17, H-18 |
| Aplicabilidad de la Ley 2300/2023 a correos promocionales y recordatorios | H-04, H-05 |
| Plazos de conservación obligatorios de pedidos y facturación | H-12 |
| Rol (encargado o responsable) de cada proveedor y transferencias internacionales | H-13 |
| Testimonios de marca, "comercio justo" e indicaciones de origen | H-14, H-23 |
| Obligación de inscripción en el RNBD | H-26 |

### F.4 Mejoras opcionales

- Indicaciones junto a los campos libres para que no se incluyan datos sensibles (H-27).
- Limpiar las claves `dizor_ga_purchase_fired_*` antiguas (H-10).
- Precios con IVA incluido si alguna vez se activa el impuesto (H-25).
- Dejar de versionar `frontend/.lh-tmp/` (2.857 archivos de caché de compilación en Git). Es un problema de higiene del repositorio, no de privacidad.

---

## G. Fuentes y limitaciones

### Fuentes consultadas (fecha de consulta: 2026-11-16)

| Norma | Fuente | Estado de la verificación |
|---|---|---|
| Ley 1480 de 2011 (arts. 7, 8, 26, 43, 47, 50, 51; notas de modificación por la Ley 2439/2024) | Régimen Legal de Bogotá, Secretaría Jurídica Distrital: https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=44306 | Leída (compilación oficial distrital; no es el Diario Oficial) |
| Ley 2439 de 2024 (19-12-2024, D.O. 52975), arts. 3 a 5 | https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=171718 | Leída |
| Ley 1581 de 2012, arts. 3, 4, 5, 7, 8, 9, 10, 12, 14, 15, 17, 18, 25, 26 | https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=49981 | Leída |
| Decreto 1377 de 2013, arts. 5, 7, 8, 9, 10, 11, 13, 14, 15, 22, 25, 26 | https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=53646 | Leída. **Su compilación en el Decreto 1074 de 2015 (sección 2.2.2.25) no se verificó en el texto del Decreto 1074**; la numeración DUR debe confirmarse |
| Sentencia C-192/26 (plazo de 15 días para todas las modalidades del art. 47) | Resultado de búsqueda que remite a https://www.corteconstitucional.gov.co/relatoria/2026/c-192-26.htm | **No leída directamente** |
| Decreto 090 de 2018 (RNBD) | Solo fuentes secundarias (actualicese.com, Deloitte, vLex) | **No verificada en texto oficial** |
| Ley 2300 de 2023 (arts. 3 y 5) | Compilaciones de normogramas (Colpensiones, DIAN, MinTIC) vía resultados de búsqueda | **No leída íntegramente** |
| Circular Externa SIC 005 de 2020 y guías SIC de 2019 sobre comercio electrónico y marketing | Referencia en resultados de búsqueda | **No leídas** |

Las fuentes de Función Pública, la Secretaría del Senado y el normograma de la SIC no se pudieron consultar por errores de certificado o de conexión desde el entorno de auditoría.

No se usaron como norma general políticas de privacidad de otras entidades.

### Limitaciones

1. **Sin navegador interactivo.** No se observaron cookies, almacenamiento ni red en los escenarios a) a f), por lo que el inventario B.5 se basa en el código y en peticiones HTTP sin JavaScript.
2. **El backend de producción difiere del repositorio** (H-24). Las conclusiones [E] sobre el backend son del commit `59a4717`.
3. **Sin acceso a la base de datos.** Las páginas del CMS se observaron por la API pública. No se revisaron los datos almacenados ni la configuración interna.
4. **Sin acceso a paneles externos** (GA4, Resend, Cloudinary, Wompi, Nequi, Atlas, hosting) ni a contratos o procedimientos internos. Su ausencia en el repositorio no prueba que no existan.
5. **Otras jurisdicciones.** El sitio solo admite envíos a departamentos colombianos y precios en COP [E][P], pero no se descartó la venta a extranjeros (por ejemplo, por WhatsApp o por pedidos al por mayor). No se aplicó el RGPD ni otras normas extranjeras; su evaluación depende de E-14.
6. **No se declara cumplimiento integral.** Quedaron sin revisar las áreas listadas en los puntos 1 a 4.
