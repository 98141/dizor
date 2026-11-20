# DIZOR — Auditoría del panel administrativo (UX/UI, pedidos, notificaciones, inventario)

**Fecha:** 2026-11-20 · **Rama inspeccionada:** `develop` (árbol de trabajo con cambios de PDP sin confirmar, ajenos a esta auditoría)
**Alcance:** panel `/admin` y `/vendedor`, backend Express (`backend/src`), flujo de compra → entrega.
**Restricciones respetadas:** no se modificó código de la aplicación, ni BD, ni variables de entorno; sin commits, despliegues, pagos ni correos reales.

### Cómo leer los niveles de evidencia

| Marca | Significado |
|---|---|
| **[PRUEBA]** | Confirmado ejecutando el backend real contra MongoDB en memoria (ver `evidencias/`). |
| **[CÓDIGO]** | Confirmado leyendo el código; no ejecutado. |
| **[INFERIDO]** | Deducción técnica razonable; requiere validación. |
| **[PENDIENTE]** | Requiere validación externa (Wompi sandbox, Resend, navegador real, decisión comercial). |

**Evidencia reproducible:** `docs/auditoria-admin/evidencias/verificacion-admin.test.js` (22 casos, `node:test`), resultados en `resultados-2026-11-20.json`. Entorno: Mongo 7.0.24 en memoria (127.0.0.1), sin `.env`, claves de Resend vacías, Wompi con valores ficticios, red saliente bloqueada (0 intentos), logger de archivos sustituido por un transporte nulo, datos sintéticos `@example.test`. Se reutilizó `mongodb-memory-server` ya presente en una carpeta temporal; no se instaló nada en el proyecto.

---

## 1. Resumen ejecutivo

**Estado real.** El panel cubre muchas áreas (13 entradas de menú, 10 pestañas en *Contenido*), pero la operación central —pedido, pago, despacho, aviso al cliente— **no tiene reglas de negocio que la protejan**. El backend autentica y autoriza correctamente por rol, pero dentro de un pedido **cualquier transición de estado es posible** y varios efectos secundarios son incorrectos. Se confirmaron con pruebas aisladas:

1. **Pagos marcados como cobrados sin serlo.** Pasar un pedido a *Enviado* pone `paymentStatus = "pagado"` automáticamente, tanto en contraentrega (aún no cobrado) como en Wompi sin pago aprobado (`orderAdminController.js:172-174`). [PRUEBA B1, B2]
2. **Confirmación manual de pagos Wompi** disponible en la UI y la API, también para el rol vendedor, sin consultar a Wompi. [PRUEBA B4]
3. **Estados contradictorios**: pedido *cancelado + pagado* por tres caminos distintos (webhook aprobado tras rechazo, confirmación sobre pedido cancelado, cancelación del cliente de un pedido ya pagado). Nadie recibe aviso; Finanzas los cuenta como ingreso. [PRUEBA C1, B4, C4]
4. **Pago aprobado que queda "pendiente"**: si al llegar el webhook no hay stock (o el monto no cuadra), el dinero está cobrado pero el pedido sigue en *Pago pendiente* con una nota en el historial; sin alerta ni correo. [PRUEBA C2]
5. **Inventario corruptible**: guardar el formulario de producto sobrescribe el stock descontado por ventas ocurridas mientras estaba abierto; eventos Wompi simultáneos descuentan varias veces; se aceptan cantidades fraccionarias (stock 81,5). [PRUEBA E1, C3, E2]
6. **Número de pedido no atómico**: con pedidos simultáneos el checkout falla y muestra al cliente el error crudo de MongoDB (`E11000…`). [PRUEBA A2]
7. **Comunicación con el cliente casi inexistente**: solo existen el acuse de recibo y el correo de despacho. No hay correo de pago aprobado/rechazado, entrega, cancelación ni alertas de stock. El acuse se marca como "enviado" incluso cuando no hay proveedor de correo configurado. [PRUEBA D1, D2]
8. **El dashboard y las alertas no responden "¿qué hago primero?"**: los pedidos contraentrega nuevos aparecen como "Pagos por confirmar" y nunca como "Por preparar"; la alerta de pagos solo consulta Nequi manual (desactivado), siempre 0; el stock bajo se calcula por producto y no detecta variantes agotadas. [PRUEBA F1, E3]

**Riesgos principales:** cobros no conciliados, pedidos despachados sin pago verificado, sobreventa, cifras financieras infladas y clientes sin información del estado de su pedido.

**Oportunidades:** la base técnica es aprovechable (auth sólida, webhook con checksum/monto/moneda/entorno, acuse idempotente, historial de inventario, auditoría). Con **un módulo de transiciones de estado**, **un registro de notificaciones** y **una vista de pedidos por bandejas de trabajo**, el administrador pasaría de 13 entradas de menú dispersas a 6–7 áreas orientadas a tareas, sin rediseñar desde cero.

---

## 2. Inventario completo de funcionalidades

Leyenda de visibilidad: **M** = en menú lateral · **R** = solo ruta directa / enlace interno · **C** = existe en código sin UI.

### 2.1 Panel `/admin` (variante "admin")

| # | Nombre visible | Ruta | Visib. | Roles (front / back) | Propósito y funciones | Evidencia |
|---|---|---|---|---|---|---|
| 1 | Dashboard | `/admin` | M | sa, admin / sa, admin | Saludo, 4 KPI "Requieren atención", 6 KPI "Actividad", accesos rápidos, 8 pedidos recientes, solicitudes, cupones, 7 eventos de auditoría | `components/admin/AdminDashboard.jsx`, `controllers/dashboardAdminController.js` |
| 2 | Inventario | `/admin/inventario` | M | sa, admin | Historial de movimientos (creación, ajustes, ventas, borrado), estadísticas, PDF | `components/admin/ProductHistoryList.jsx`, `controllers/productHistoryAdminController.js` |
| 3 | Pedidos | `/admin/pedidos`, `/admin/pedidos/[id]` | M | sa, admin, vend. (menú solo sa/admin) / staff | Lista paginada (15), búsqueda, filtro estado de pedido y de pago, PDF; detalle con cliente, envío, productos, precios, confirmar pago, cambiar estado, guía, historial | `OrdersList.jsx`, `OrderDetail.jsx`, `orderAdminController.js` |
| 4 | Alertas | `/admin/alertas` (+ campana en topbar, sondeo 60 s) | M | sa, admin | Pedidos nuevos 24 h, "Pagos Nequi por confirmar", stock bajo (≤5), agotados, solicitudes pendientes, cupones por vencer; descartes en `localStorage` | `app/admin/alertas/page.js`, `AlertBell.jsx`, `adminAlertController.js` |
| 5 | Solicitudes | `/admin/solicitudes`, `/admin/solicitudes/[id]` | M | staff | Personalizaciones y mayoristas: estado, cotización, notas internas | `SpecialRequestsList.jsx`, `SpecialRequestDetail.jsx`, `specialRequestAdminController.js` |
| 6 | PQR y datos | `/admin/pqr` | M | sa, admin | Peticiones/quejas/derechos de datos: lista, detalle, historial, cambio de estado | `app/admin/pqr/page.js`, `customerRequestController.js` |
| 7 | Productos | `/admin/productos`, `/nuevo`, `/[id]/editar` | M | staff (vendedor solo lectura) | Lista (máx. 100, sin búsqueda ni paginación), toggle activo, eliminar con confirmación, pestaña "Inventario" (stock total por producto); formulario de 947 líneas con variantes, imágenes, SEO, promoción | `app/admin/productos/page.js`, `ProductForm.jsx`, `productAdminController.js` |
| 8 | Catálogo | `/admin/catalogo?tab=` | M | sa, admin | Categorías, colores, tallas, tejidos, estilos | `TaxonomyManager.jsx`, `taxonomyAdminController.js` |
| 9 | Contenido | `/admin/contenido?tab=` | M | sa, admin | **10 pestañas**: Inicio, Imágenes, Reseñas, Banners, Páginas, Popup, Newsletter, Carritos abandonados, Exportar (pedidos y newsletter CSV), Apariencia | `app/admin/contenido/page.js` (998 líneas), `HomeTextsTab.jsx`, `HomeImagesTab.jsx`, `ReviewsTab.jsx` |
| 10 | Cupones | `/admin/cupones` | M | sa, admin | CRUD, activar/desactivar, usos, vencimiento | `app/admin/cupones/page.js`, `adminCouponController.js` |
| 11 | Configuración | `/admin/configuracion` | M | sa, admin | IVA, modo/costo de envío (anulados por `SHIPPING_INCLUDED_IN_PRICE`), lista de transportadoras (solo lectura, ids crudos) | `app/admin/configuracion/page.js` |
| 12 | Usuarios | `/admin/usuarios` | M | superadmin | Crear personal, activar/desactivar | `app/admin/usuarios/page.js`, `adminUserController.js` |
| 13 | Finanzas | `/admin/finanzas` | M | superadmin | Ventas/ganancias por periodo, tendencia, inversión en inventario, top productos, margen bajo, pagos por método, costos por producto, exportación CSV/XLSX/PDF | `app/admin/finanzas/page.js`, `FinanceDashboard.jsx`, `financeService.js` |
| 14 | Auditoría | `/admin/auditoria` | **R** (comentada en el menú, enlazada desde el dashboard) | sa, admin | Registro de acciones | `AdminShell.jsx:12`, `AdminDashboard.jsx:383`, `AuditLogList.jsx` |
| 15 | Redirecciones legacy | `/admin/marketing`, `/admin/resenas`, `/admin/home-imagenes` | R | — | Redirigen a pestañas de Contenido | `app/admin/*/page.js` |

### 2.2 Panel `/vendedor` (variante "vendedor")

| Nombre | Ruta | Funciones | Observaciones |
|---|---|---|---|
| Dashboard | `/vendedor` | 2 tarjetas (pagos por confirmar, por preparar) + botón | `app/vendedor/page.js`; mismas métricas defectuosas que el admin |
| Pedidos | `/vendedor/pedidos[/id]` | Mismos `OrdersList`/`OrderDetail` | El vendedor **puede confirmar pagos (incluido Wompi)** y ver costos internos |
| Solicitudes | `/admin/solicitudes` | Enlace a la ruta admin | La página usa `variant="admin"`: el vendedor pierde su menú (solo ve "Solicitudes") |

### 2.3 Funcionalidad en código sin UI integrada [CÓDIGO]

| Elemento | Evidencia | Estado |
|---|---|---|
| Asignación de pedido a personal | `PATCH /api/admin/orders/:id/assign` (`orderAdminController.js:413`) | Sin UI; acepta cualquier id de usuario (también clientes) [PRUEBA G3] |
| Pedidos manuales / POS (`source: "manual"`, `channelOrigin`, `SourceBadge`, `REF_LABELS.pos`) | `models/order.js:53-54`, `OrdersList.jsx:15-36` | No existe endpoint que cree pedidos manuales: código residual |
| Estadísticas de pedidos `GET /admin/orders/stats` | `orderAdminController.js:40` | Solo la usa `/vendedor` |
| Integración Nequi directa y manual | `routes/nequiRoutes.js`, `nequiPaymentService.js` | Desactivada por variables (`NEQUI_DIRECT_ENABLED`, `NEQUI_MANUAL_ENABLED`); endpoints responden 410 según pruebas de privacidad. Correcto según decisión del negocio |
| Exportación PDF de pedidos | `GET /admin/orders/export/pdf` | En UI (botón "PDF"), pero ignora filtro de método/fuente |
| Recordatorios de carrito abandonado | `scripts/sendAbandonedReminders.js` | Desactivados por `MARKETING_CART_REMINDERS_ENABLED=false` |

### 2.4 Endpoints administrativos y control de acceso [CÓDIGO]

Todas las rutas `/api/admin/*` aplican `protect` (JWT en cookie o Bearer, usuario activo, invalidación por cambio de contraseña) y `authorizeRoles`. Pedidos y solicitudes: staff (incluye vendedor); catálogo: lectura staff, escritura admin; usuarios y finanzas: solo superadmin; resto: superadmin y admin. El frontend usa `RoleRoute` (solo cliente) — aceptable porque el backend aplica la autorización. No existe `middleware.js` de Next; las páginas admin renderizan "Cargando…" antes de redirigir.

### 2.5 Estados de carga, vacío y error [CÓDIGO]

| Vista | Carga | Vacío | Error |
|---|---|---|---|
| Lista de pedidos | Texto | "No hay pedidos con estos filtros." | **Error tragado**: muestra el mismo texto de vacío (`OrdersList.jsx:54-56`) |
| Detalle de pedido | Texto | — | Cualquier fallo → "Pedido no encontrado" |
| Dashboard | Texto | "Aún no hay pedidos" | Mensaje genérico, sin reintento |
| Productos | Texto | Tabla vacía sin mensaje | Error tragado (lista vacía) |
| Toggle activo / exportaciones | Optimista | — | `alert()` nativo |

---

## 3. Mapa actual de navegación

```
/admin  (AdminShell variant="admin" · campana de alertas en topbar móvil)
├── Dashboard ─────────────── /admin
│     ├─ KPI → /admin/pedidos (sin filtro) · /admin/inventario · /admin/solicitudes
│     ├─ "N alertas activas" → /admin/alertas
│     ├─ Pedidos recientes → /admin/pedidos/[id]
│     └─ "Historial completo" → /admin/auditoria   (oculta en menú)
├── Inventario ────────────── /admin/inventario      (historial de movimientos)
├── Pedidos ───────────────── /admin/pedidos
│     └─ Detalle ──────────── /admin/pedidos/[id]
│           ├─ Tarjeta Pago: [Confirmar pago] (+ URL comprobante)
│           ├─ Tarjeta Estado: <select 9 estados> + nota + [Actualizar estado] → abre WhatsApp
│           ├─ Tarjeta Guía: <select 4 transportadoras> + nº guía + [Guardar guía]
│           └─ Historial
├── Alertas ───────────────── /admin/alertas
├── Solicitudes ───────────── /admin/solicitudes → /[id]
├── PQR y datos ───────────── /admin/pqr
├── Productos ─────────────── /admin/productos   [Lista | Inventario]
│     ├─ Nuevo ────────────── /admin/productos/nuevo
│     ├─ Editar ───────────── /admin/productos/[id]/editar
│     └─ Botones → Catálogo base · Historial inventario
├── Catálogo ──────────────── /admin/catalogo?tab=categories|colors|sizes|weaves|styles
├── Contenido ─────────────── /admin/contenido?tab=
│     └─ Inicio · Imágenes · Reseñas · Banners · Páginas · Popup · Newsletter · Carritos · Exportar · Apariencia
├── Cupones ───────────────── /admin/cupones
├── Configuración ─────────── /admin/configuracion
├── Usuarios (superadmin) ─── /admin/usuarios
├── Finanzas (superadmin) ─── /admin/finanzas
├── Ver tienda · Cerrar sesión
└── (rutas ocultas) /admin/auditoria · /admin/marketing → contenido · /admin/resenas → contenido?tab=resenas · /admin/home-imagenes → contenido?tab=imagenes

/vendedor  (AdminShell variant="vendedor")
├── Dashboard ── /vendedor
├── Pedidos ──── /vendedor/pedidos → /[id]
└── Solicitudes ─ /admin/solicitudes  (cambia a variante admin y pierde el menú de vendedor)
```

---

## 4. Diagnóstico UX/UI

### 4.1 Navegación y arquitectura de información

- **Orden del menú no refleja frecuencia de uso**: "Inventario" (historial) aparece antes que "Pedidos"; "Productos", "Catálogo" e "Inventario" son tres entradas para una sola tarea mental (mi catálogo y su stock).
- **Inventario disperso en 5 lugares**: columna de stock en Productos, pestaña "Inventario" en Productos, página Inventario (historial), sección de Alertas, KPI del dashboard. Ninguno permite ajustar stock directamente; hay que abrir el formulario completo del producto.
- **"Contenido & Marketing" mezcla tres dominios**: vitrina (inicio, imágenes, banners, páginas, apariencia), marketing (popup, newsletter, carritos) y datos operativos (exportar pedidos con nombre y correo de clientes).
- **"Alertas" duplica el dashboard** con criterios distintos (el dashboard suma 4 contadores como "alertas activas"; la página Alertas suma 6 categorías diferentes).
- **Auditoría oculta del menú pero enlazada** desde el dashboard.
- **Configuración engañosa**: los campos de envío son editables pero el backend los ignora mientras `SHIPPING_INCLUDED_IN_PRICE` no sea `false` (solo un texto lo advierte). Las transportadoras se muestran como `interrapidisimo, servientrega`.

### 4.2 Pedidos: la tarea principal requiere memorizar el procedimiento

Despachar un pedido contraentrega hoy: Dashboard → Pedidos → *Ver pedido* → seleccionar "En preparación" → *Actualizar estado* (se abre una pestaña de WhatsApp) → volver → escribir guía → *Guardar guía* (pasa solo a "Enviado" y envía correo). **≈8 acciones, 2 cargas de página y una pestaña externa**. Si en vez de eso se guarda la guía estando en "Pagado", no cambia nada; hay que saber que primero va "En preparación". Si se elige "Enviado" en el selector, el correo se envía pero además se abre WhatsApp y **el pago queda marcado como cobrado**.

Problemas concretos (`OrderDetail.jsx`):
- Tres tarjetas independientes (Pago, Estado, Guía) para un mismo flujo; dos caminos distintos para "Enviado" con efectos distintos.
- El selector ofrece los 9 estados en cualquier momento (incluidos "Rechazado" y "Devuelto"); **sin confirmación** al cancelar.
- **Cada cambio de estado abre WhatsApp automáticamente** (línea 120), incluso para "Cancelado" o "Rechazado", y no queda registro de si se envió.
- "Nota interna" (línea 379) **no es interna**: el cliente la recibe por API (ver ADM-14).
- "Total pagado" (línea 323) aunque el pago esté pendiente.
- Transportadora por defecto "Inter Rapidísimo" aunque el pedido no tenga ninguna (línea 52); el selector incluye Envía/Coordinadora (históricas).
- Botón "Confirmar pago" también para Wompi, con campo "URL comprobante" heredado de Nequi manual (líneas 41-43).

Lista (`OrdersList.jsx`): sin bandejas por tarea, sin filtro por método de pago o fecha en la UI (el backend sí los admite), búsqueda solo al enviar, errores ocultos como "sin resultados", sin acciones rápidas por fila, sin indicador de "requiere revisión".

### 4.3 Consistencia, legibilidad y feedback

- Estilos en línea abundantes (badges, mensajes) y colores hex fijos en el dashboard; mezcla de `alert()` nativo, `ConfirmModal` y mensajes de texto.
- Mensajes de éxito/error en texto plano sin rol `status`/`alert`; no se anuncian a lectores de pantalla.
- Emojis como iconos de sección en el dashboard; etiquetas abreviadas ("Pend.").
- Botón de despliegue móvil con `aria-label` correcto; no hay gestión de foco al abrir/cerrar el menú ni al abrir modales [CÓDIGO; teclado no probado en navegador → PENDIENTE].
- Tablas anchas dentro de `admin-table-wrap` (scroll horizontal); en móvil el detalle de pedido apila 5–6 tarjetas antes de las acciones [CÓDIGO; responsive no verificado en navegador → PENDIENTE].

### 4.4 Clasificación solicitada (A–H)

| | Hallazgo |
|---|---|
| **A. Funciones innecesariamente separadas** | Pago / Estado / Guía en el detalle de pedido; Productos / Inventario / Catálogo; Alertas / Dashboard. |
| **B. Pantallas combinables** | *Alertas* dentro del dashboard (bloque "Requiere atención") + campana; *Inventario* como pestaña "Movimientos" de Productos; pestaña "Inventario" de Productos absorbida por la lista con stock por variante. Se justifican porque responden a la misma pregunta y se usan juntas. |
| **C. Información repetida** | Stock total en 5 vistas; KPI de pedidos en dashboard, vendedor y alertas con criterios distintos; etiquetas de estado definidas en 4 sitios (`lib/orderLabels.js`, `AdminDashboard.jsx:35`, `emailService.js`, `orderAdminController.js:363`). |
| **D. Demasiados clics** | Despachar (≈8), ajustar stock de una variante (abrir formulario completo, buscar variante, guardar todo), encontrar pedidos contraentrega por preparar (no hay filtro que los aísle). |
| **E. Pasar a secundario** | Catálogo base, Apariencia, Páginas, Popup, Newsletter, Carritos, Auditoría, Exportaciones → Configuración o "Tienda online"/"Marketing". |
| **F. Acciones directas en tabla/detalle** | "Marcar en preparación", "Registrar guía y despachar", "Marcar entregado (y cobrado si es contraentrega)", "Ajustar stock ±" por variante, "Reenviar correo". |
| **G. Debe estar en el dashboard** | Pedidos por bandeja (por confirmar / por preparar / por despachar / en camino >N días / requieren revisión), pagos con incidencia, variantes agotadas o bajas, correos fallidos. |
| **H. Pasos que hay que memorizar** | "En preparación antes de guía"; "guardar guía antes de elegir Enviado"; "cerrar la pestaña de WhatsApp"; "revisar el historial para ver alertas de pago". |

---

## 5. Análisis profundo del flujo de pedidos

### 5.1 Flujo actual

```
Cliente (checkout)                     Backend                                     Admin
──────────────────                     ───────                                     ─────
POST /api/checkout/orders ──► valida comprador/dirección (presencia),
                              autorización de datos, términos,
                              método habilitado (wompi|contra_entrega),
                              transportadora confirmada
                              resolveCartItems: producto/variante activos,
                              stock ≥ cantidad, precio del servidor
                              idempotencyKey (si existe y es del mismo actor → devuelve el mismo)
                              cupón (validación, sin consumir)
                              createOrder:
                               · orderNumber = DIZ-AAAAMMDD-(count hoy+1)   ← no atómico
                               · contraentrega → "pendiente", descuenta stock
                               · wompi        → "pago_pendiente", NO descuenta
                              contraentrega+cupón → consume cupón
                              wompi → crea payment link (single_use) o borra el pedido
                              registra evidencia legal, token de acceso
                              acuse al cliente (idempotente)            ──► correo "Nuevo pedido" al admin
                                                                           (también para Wompi sin pagar)
Redirección Wompi ──► /pedido/confirmacion lee estado desde BD (no confía en la URL) ✔

Wompi ── POST /api/webhooks/wompi ──► checksum + antigüedad ≤26 h + entorno
                                      busca por sku/reference/payment_link_id
                                      solo paymentMethod "wompi"; ya pagado → no degrada
                                      APPROVED: moneda COP, monto exacto,
                                        descuenta stock (si falla → nota y fin, sigue "pendiente")
                                        consume cupón, pagado / orderStatus "pagado" (solo desde pendiente|pago_pendiente)
                                      DECLINED/ERROR/VOIDED: rechazado + cancelado
                                      (sin correo en ningún caso)

                                                                 Admin: PATCH /status (cualquier estado no final)
                                                                         PATCH /payment (confirmar)
                                                                         PATCH /shipping (guía; desde en_preparacion → enviado + correo)
Cliente: PATCH /checkout/orders/:id/cancel (si no enviado/entregado/cancelado)
```

### 5.2 Estados existentes

- `orderStatus`: `pendiente, pago_pendiente, pagado, en_preparacion, enviado, entregado, cancelado, rechazado, devuelto` (`models/order.js:91-105`).
- `paymentStatus`: `pendiente, pagado, rechazado, reembolsado` (`models/order.js:79-83`). `reembolsado` nunca se asigna en el código.
- "pagado" existe **en ambos ejes**, lo que permite combinaciones absurdas (`orderStatus=pagado` + `paymentStatus=pendiente`, ver B3).

### 5.3 Transiciones reales (no existe máquina de estados) [CÓDIGO + PRUEBA]

| Actor | Desde | Hacia | Validación existente | Efectos secundarios |
|---|---|---|---|---|
| Sistema (checkout) | — | `pendiente` (CE) / `pago_pendiente` (Wompi) | — | Stock (solo CE), cupón (solo CE), acuse, correo admin |
| Webhook Wompi | `pendiente`, `pago_pendiente` | `pagado` | checksum, entorno, COP, monto | stock, cupón; **sin correo** |
| Webhook Wompi | cualquiera salvo `cancelado/entregado/devuelto` | `cancelado` (+ pago rechazado) | idem | ninguno |
| Webhook Wompi | `cancelado` (tras rechazo) | **se queda `cancelado` con pago `pagado`** | — | **descuenta stock** [PRUEBA C1] |
| Admin | cualquier no final (`cancelado/entregado/devuelto` son finales) | **cualquiera** de los 9 | enum; para `enviado` exige guía | `cancelado/devuelto` restaura stock; `enviado` **marca pagado** + correo |
| Vendedor | cualquier no final | `pago_pendiente, pagado, en_preparacion, enviado` | `orderPermissions.js:4` | idem |
| Admin/Vendedor (confirmar pago) | **cualquier estado, incluso cancelado** | pagado (orderStatus a `pagado` solo desde pendiente/pago_pendiente) | solo "no estaba pagado" | descuenta stock si no estaba descontado [PRUEBA B4] |
| Admin (guía) | **cualquier estado, incluso cancelado** | `en_preparacion` → `enviado` | — | correo de despacho (solo si estaba en preparación) [PRUEBA B6] |
| Cliente | todo salvo `enviado/entregado/cancelado` (**incluye pagado y en preparación**) | `cancelado` | — | restaura stock; **pago sigue "pagado"; nadie es notificado** [PRUEBA C4] |

Casos confirmados con pruebas: `pendiente → entregado` directo (B5); `rechazado → pendiente` (B5); Wompi `pago_pendiente → en_preparacion → enviado` sin pago, **sin descontar stock** y quedando "pagado" (B2).

### 5.4 Requisitos del encargo frente al estado real

| Requisito | Estado |
|---|---|
| Contraentrega no se considera pagado sin justificación | ❌ Se marca pagado al pasar a *Enviado* por el selector (B1); por la vía de la guía no (inconsistente). `paymentConfirmedAt/By` quedan vacíos. |
| Confirmación Wompi basada en eventos verificables | ✔ El webhook lo cumple (checksum, entorno, monto, moneda; la página de confirmación lee la BD). ❌ Pero el panel permite confirmar manualmente sin verificación (B4) y "Enviado" lo marca pagado (B2). |
| Idempotencia de webhooks | ⚠ Repetición secuencial: inocua. Concurrente: **descuento múltiple** (C3) porque lee-modifica-guarda sin condición atómica (`wompiWebhookController.js:107-114`). |
| Idempotencia del checkout | ✔ Con clave (el frontend la envía, `checkout/page.js:59`). ⚠ Índice único `sparse` con `default: null` impide un segundo pedido sin clave (A1). |
| Duplicación accidental | ✔ Doble clic cubierto por la clave. ❌ Pedidos simultáneos de clientes distintos colisionan en `orderNumber` (A2). |
| Relación con inventario | ⚠ CE descuenta al crear; Wompi al aprobar (sin reserva → riesgo de sobreventa en la ventana de pago, manejado como "revisión manual" pero sin alerta). Cancelación restaura sin revertir `salesCount`, sin movimiento en el historial y sin devolver el uso del cupón. |
| Pedidos Wompi abandonados | ❌ No expiran: permanecen en `pago_pendiente` y cuentan como "Pagos por confirmar" indefinidamente. |
| Trazabilidad | ⚠ `statusHistory` registra cambios con usuario; la auditoría registra cambios de estado, confirmación de pago y guía. No se audita: webhooks, cancelaciones del cliente, correos enviados/fallidos. |
| Gestión de errores | ❌ Errores de BD se devuelven al cliente literalmente (`checkoutController.js:360`, E11000). ❌ Fallo al consumir el cupón tras crear el pedido responde error pero deja el pedido con stock descontado (`checkoutController.js:380-382`) [INFERIDO]. |

### 5.5 Inconsistencias posibles entre pago, inventario, pedido y correo (todas confirmadas salvo indicación)

| Escenario | Pedido | Pago | Stock | Correo/aviso |
|---|---|---|---|---|
| Wompi rechazado y luego aprobado (C1) | cancelado | pagado | descontado | ninguno |
| Confirmar pago de un cancelado (B4) | cancelado | pagado | descontado de nuevo | ninguno |
| Cliente cancela tras pagar (C4) | cancelado | pagado | restaurado | ninguno (ni al admin) |
| Aprobado sin stock (C2) | pago_pendiente | pendiente (cobrado en Wompi) | sin cambio | ninguno |
| Wompi llevado a enviado sin pago (B2) | enviado | pagado | **no descontado** | correo de despacho |
| CE enviado por selector (B1) | enviado | pagado (no cobrado) | descontado | correo de despacho |
| Webhook concurrente ×3 (C3) | pagado | pagado | −3 unidades por 1 vendida | ninguno |
| Formulario de producto abierto durante una venta (E1) | — | — | venta revertida | ninguno |

---

## 6. Matriz de notificaciones

Infraestructura [CÓDIGO]: **Resend** (`resend@6`), `RESEND_API_KEY`, `EMAIL_FROM` (por defecto `onboarding@resend.dev`), `ADMIN_NOTIFY_EMAIL` (si falta, usa `EMAIL_FROM`). Plantillas HTML en línea en `services/emailService.js` y `services/orderReceiptService.js`. Todo es **síncrono dentro de la petición HTTP**, sin cola, sin reintentos automáticos y sin registro de envíos (salvo `order.buyerReceipt`). Los fallos solo se escriben con `console.error`. No se comprueba entrega (no hay webhooks de Resend). Sin clave, cada función imprime un aviso y devuelve `devMode: true`.

| Evento | Destinatario | Canal | Disparador técnico | Plantilla | Condiciones | Reintentos / registro | Evidencia | Estado |
|---|---|---|---|---|---|---|---|---|
| Nuevo pedido | Admin | Correo | `createCheckoutOrder` → `sendNewOrderAdminEmail` (`checkoutController.js:492-496`) | `emailService.js:121-162` (sin escapar HTML) | Siempre, **también Wompi aún no pagado** | No / solo `console.error` | D1: intento registrado | **Implementado** (evento generado verificado; aceptación por proveedor **no verificable**) |
| Acuse de compra | Cliente | Correo | `sendOrderReceiptOnce` (`checkoutController.js:490`) | `orderReceiptService.js` `buildOrderReceivedEmail` (escapado, datos Ley 1480) | Una vez por pedido; requiere email | Reclamación atómica; ante error libera y guarda `lastError`; **no hay proceso que reintente** | Pruebas de privacidad + D2 | **Implementado con defecto**: sin clave marca `sentAt` como enviado (D2) |
| Pago aprobado (Wompi) | Cliente / Admin | — | — | — | — | — | D1: 0 intentos | **Inexistente** |
| Pago rechazado (Wompi) | Cliente | — | — | — | — | — | D1: 0 intentos | **Inexistente** (el pedido se cancela en silencio) |
| Pago confirmado manualmente | Cliente | — | — | — | — | — | Código | **Inexistente** |
| Pago con incidencia (monto, moneda, sin stock) | Admin | Nota en historial | Webhook | Texto "ALERTA…" | — | — | C2 | **Incompleto**: solo nota, sin alerta ni correo |
| Cambio de estado (preparación, etc.) | Cliente | WhatsApp manual | `handleUpdateStatus` abre `wa.me` (`OrderDetail.jsx:120`) | Texto en el front | Si hay teléfono | Depende del admin; sin registro | Código | **Incompleto** (manual, no trazable) |
| Pedido despachado + transportadora y guía | Cliente | Correo | `updateOrderStatus` → `enviado`, o `updateShipping` desde `en_preparacion` | `emailService.js:164-212` | Requiere email; no se reenvía si se corrige la guía; no se envía si la guía se registra en estado "pagado" | No / `console.error` | D1: intento registrado | **Implementado** (aceptación por proveedor **no verificable**) |
| Entregado | Cliente | — | — | — | — | — | D1: 0 intentos | **Inexistente** |
| Cancelado (admin, cliente o Wompi) | Cliente / Admin | — | — | — | — | — | D1, C4: 0 intentos | **Inexistente** |
| Stock bajo / agotado | Admin | Panel (campana, página) | Consulta cada 60 s | — | Umbral fijo 5 por **producto** | — | E3 | **Solo indicador visual**, sin disparador; no detecta variantes agotadas |
| Nueva solicitud especial | Admin | Correo | `specialRequestController.js:26` | `emailService.js:62-100` | — | No | Código | Implementado (no verificado) |
| PQR radicada | Bandeja de atención / cliente | Correo | `customerRequestService` | constancia | `PQR_PUBLIC_ENABLED` | — | Pruebas de privacidad F3-Q1 | Implementado (fuera del foco) |
| Recuperación de contraseña | Usuario | Correo | `authController` | `emailService.js:17-55` | — | No | Código | Implementado |
| Carrito abandonado | Cliente | Correo | script manual | `emailService.js:214-273` | Desactivado | — | Pruebas de privacidad | Desactivado por decisión |

**Niveles de verificación alcanzados:** "evento generado" confirmado por prueba para nuevo pedido, acuse y despacho. "Encolado": no aplica (no hay cola). "Aceptado por el proveedor" y "entregado": **no verificables** sin una clave de Resend de pruebas y un buzón controlado [PENDIENTE]. "Fallido": solo visible en la consola del servidor.

**Qué amerita correo y qué solo panel (recomendación):**
- Correo al cliente: acuse (existe), pago aprobado (Wompi), pago rechazado con enlace para reintentar, despachado con guía (existe), entregado, cancelado.
- Correo al admin: pedido **listo para preparar** (CE creado o Wompi aprobado) en lugar de "nuevo pedido" al crear un Wompi sin pagar; pago con incidencia (cobrado sin stock, monto distinto, cancelado y pagado); cancelación por el cliente.
- Solo panel: stock bajo/agotado (resumen diario opcional por correo), Wompi sin pagar > X horas, correos fallidos, cupones por vencer, solicitudes pendientes.

---

## 7. Diagnóstico del inventario

| Aspecto | Estado | Evidencia |
|---|---|---|
| Modelo | Stock por variante (talla+color, SKU único, precio opcional, activa/inactiva) | `models/product.js:5-40` |
| Edición | Formulario completo; el stock se envía como **valor absoluto** | `ProductForm.jsx:713`, `productAdminController.js:244-258` |
| Concurrencia en edición | ❌ Sobrescribe ventas ocurridas mientras el formulario está abierto | PRUEBA E1 (82 → 83 tras guardar) |
| Descuento en pedidos | Atómico por variante con `$elemMatch` y rollback parcial | `orderService.js:26-73`, `165-201` |
| Cantidades | ❌ No se valida entero: 1,5 unidades aceptadas, stock 81,5 | PRUEBA E2, `cartService.js:18` |
| Reserva durante pago Wompi | No existe; se comprueba al crear y se descuenta al aprobar | `checkoutController.js:340` |
| Reposición al cancelar | Sí (si `stockDeducted`), pero sin revertir `salesCount`, sin movimiento en historial, no atómica frente a cancelaciones simultáneas [INFERIDO] | `orderService.js:76-86` |
| Historial de movimientos | Ventas, ajustes, altas, cambios de precio/estado, borrado | `productHistoryService.js` |
| Umbral bajo | 5 unidades **sumando variantes activas**, fijo en 3 archivos (`adminAlertController.js:7`, `dashboardAdminController.js:35`, `productAdminController.js:470`); criterios de "variante activa" distintos (`v.isActive` vs `!== false`) | PRUEBA E3 |
| Agotados por variante | ❌ No detectados (producto con una talla en 0 y otra en 40 no aparece) | PRUEBA E3 |
| Alertas | Solo visuales, sondeo de 60 s; sin correo ni resumen | `AlertBell.jsx:7` |
| Eliminación de producto | Borrado físico sin comprobar pedidos pendientes; un Wompi pendiente de ese producto no podrá descontar stock | `productAdminController.js:316-348` [INFERIDO] |
| Eliminar una variante | Se elimina del array aunque haya pedidos Wompi pendientes que la referencien | `productAdminController.js:268-275` [INFERIDO] |
| Promociones | Descuento porcentual por producto con fecha fin; cupones globales (porcentaje/valor) | `product.js:206-218`, `adminCouponController.js` |
| Consistencia tienda ↔ panel | El precio y el stock se resuelven en servidor al calcular y al crear el pedido ✔ | `cartService.js:8-63` |

**Simplificación propuesta del mantenimiento:** lista única de productos con stock por variante visible y editable con ajustes **relativos** (+/−, motivo), umbral configurable por variante o global, filtro "agotados / bajos", y el historial como pestaña del mismo módulo.

---

## 8. Problemas priorizados

| ID | Prior. | Módulo | Problema | Impacto | Evidencia | Recomendación |
|---|---|---|---|---|---|---|
| ADM-01 | **P0** | Pedidos/Pagos | Pasar a *Enviado* por el selector marca `paymentStatus=pagado` sin `paymentConfirmedAt/By` | Contraentrega "cobrado" antes de cobrar; Wompi sin pago "cobrado"; Finanzas inflada | PRUEBA B1, B2 · `orderAdminController.js:172-174` | Eliminar el auto-pago. CE se cobra al marcar *Entregado* (acción explícita "Entregado y cobrado"); Wompi solo por webhook |
| ADM-02 | **P0** | Pedidos | No hay máquina de estados: cualquier transición entre estados no finales, por admin y vendedor | Wompi sin pago despachado sin descontar stock; `pendiente→entregado`; `rechazado→pendiente`; `orderStatus=pagado` con pago pendiente | PRUEBA B2, B3, B5 · `orderAdminController.js:124-205`, `orderPermissions.js` | Módulo único de transiciones (estado actual × método × rol → estados siguientes + efectos), usado por backend y UI |
| ADM-03 | **P0** | Pagos | Confirmación manual de pagos Wompi (UI y API), también por vendedor, sin verificación | Pedidos dados por pagados sin dinero; fraude interno o error | PRUEBA B4 · `OrderDetail.jsx:41-43`, `orderAdminController.js:207-284` | Limitar "Confirmar pago" a contraentrega (al entregar). Para Wompi, sustituir por "Verificar con Wompi" (consulta de la transacción) |
| ADM-04 | **P0** | Pagos/Inventario | Confirmar pago en pedido cancelado: vuelve a descontar stock y queda cancelado+pagado | Stock y finanzas incorrectos | PRUEBA B4 | Rechazar confirmación en estados finales (parte de ADM-02) |
| ADM-05 | **P0** | Webhook Wompi | Aprobación posterior a un rechazo deja el pedido *cancelado + pagado* con stock descontado, sin aviso | Cliente pagó y no recibirá nada; nadie se entera | PRUEBA C1 · `wompiWebhookController.js:145-162` · reintento en enlace `single_use` tras rechazo: [PENDIENTE validar en sandbox] | Un rechazo no cancela: deja `pago_pendiente`/"pago rechazado, puede reintentar". Un aprobado sobre cancelado → marca "requiere revisión" y alerta |
| ADM-06 | **P0** | Webhook Wompi | Aprobado sin stock (o monto/moneda distintos): dinero cobrado, pedido sigue "Pago pendiente"; solo nota en historial | Cobro no conciliado, cliente sin respuesta | PRUEBA C2 · `wompiWebhookController.js:84-127` | Registrar el pago como recibido + bandera `requiereRevisión` con motivo; alerta en dashboard y correo al admin |
| ADM-07 | **P0** | Inventario | Guardar un producto sobrescribe el stock (valor absoluto leído al abrir el formulario) | Ventas "devueltas" al stock → sobreventa | PRUEBA E1 · `productAdminController.js:244-258` | Ajustes relativos de stock con motivo, o control de versión (rechazar si el stock cambió desde que se abrió) |
| ADM-08 | **P0** | Pedidos (cliente) | El cliente puede cancelar pedidos *pagados* o *en preparación*; el pago sigue "pagado"; sin aviso al admin ni reembolso | Pedido preparado/cobrado cancelado en silencio | PRUEBA C4 · `checkoutController.js:642-683` | Permitir autocancelación solo en `pendiente`/`pago_pendiente`; en otros estados, "solicitar cancelación" que avisa al admin |
| ADM-09 | P1 | Webhook Wompi | Eventos aprobados concurrentes descuentan stock varias veces | Inventario subestimado | PRUEBA C3 (3 eventos → −3) · `wompiWebhookController.js:107-114` | Reclamar la transición atómicamente (`findOneAndUpdate` con condición `paymentStatus≠pagado, stockDeducted=false`) |
| ADM-10 | P1 | Checkout | `orderNumber` = conteo del día + 1: pedidos simultáneos fallan con E11000 y se muestra el error de Mongo al cliente; "día" en hora del servidor | Ventas perdidas; mensaje técnico | PRUEBA A2 (2 de 6 OK) · `orderService.js:9-18`, `checkoutController.js:360` | Contador atómico (colección de secuencias) en zona `America/Bogota`; mensajes de error genéricos al cliente |
| ADM-11 | P1 | Notificaciones | No existen correos de pago aprobado/rechazado, entregado, cancelado; el aviso de estado es WhatsApp manual sin registro | Cliente sin información; más consultas por WhatsApp | PRUEBA D1 · `emailService.js` | Plantillas transaccionales por evento disparadas desde el módulo de transiciones |
| ADM-12 | P1 | Notificaciones | Acuse marcado como enviado (`sentAt`) cuando no hay `RESEND_API_KEY` | Falsa evidencia de cumplimiento (Ley 1480) y del envío | PRUEBA D2 · `orderReceiptService.js:129-133` | Tratar `devMode` como "no enviado" (`skipped`) |
| ADM-13 | P1 | Notificaciones | Envío síncrono, sin reintentos ni registro; fallos solo en consola; el admin no ve si un correo falló | Fallos silenciosos | CÓDIGO · `checkoutController.js:490-496`, `orderAdminController.js:178-184` | Registro de notificaciones por pedido (evento, estado, error, intentos) + "Reenviar" en el detalle + contador en el dashboard |
| ADM-14 | P1 | Pedidos/Privacidad | La "Nota interna" del cambio de estado y las alertas del sistema se devuelven al cliente en `GET /checkout/orders/:id` | Exposición de comentarios internos | PRUEBA C5 · `checkoutController.js:116-120` | Separar nota interna de nota visible; filtrar en el DTO del cliente |
| ADM-15 | P1 | Correo admin | "Nuevo pedido" se envía al crear un Wompi sin pagar; no hay aviso cuando se paga | Ruido + falta de la señal útil | CÓDIGO · `checkoutController.js:492` | Avisar "pedido listo para preparar" (CE al crear; Wompi al aprobar) |
| ADM-16 | P1 | Dashboard | "Pagos por confirmar" mezcla CE nuevos (que hay que preparar) con Wompi abandonados; "Por preparar" solo cuenta `orderStatus=pagado` → los CE nunca aparecen | El admin no ve qué preparar | PRUEBA F1 · `dashboardAdminController.js:81-85` | Bandejas calculadas por estado operativo (ver §9) |
| ADM-17 | P1 | Alertas | "Pagos Nequi por confirmar" consulta solo `nequi_manual` (método desactivado): siempre 0 | Alerta muerta | PRUEBA F1 · `adminAlertController.js:27` | Sustituir por "pagos con incidencia" y "Wompi sin pagar > N h" |
| ADM-18 | P1 | Inventario | Umbral fijo por producto; variantes agotadas no detectadas; solo visual | Tallas agotadas invisibles | PRUEBA E3 | Umbral por variante (o global configurable) y alerta por variante |
| ADM-19 | P1 | Inventario/Checkout | Cantidades no enteras aceptadas (stock 81,5) | Corrupción de inventario vía petición manipulada | PRUEBA E2 · `cartService.js:18` | Validar entero ≥1 y ≤ máximo |
| ADM-20 | P1 | Finanzas | Ingresos = `paymentStatus=pagado` sin excluir cancelados ni reembolsos | Cifras infladas por ADM-01/05/08 | CÓDIGO · `financeService.js:237-240` | Excluir cancelados/devueltos o mostrarlos como "por reembolsar" |
| ADM-21 | P1 | Pedidos | Wompi `pago_pendiente` no expiran | Listas y KPI contaminados; stock "comprometido" ilusorio | CÓDIGO | Expiración (p. ej. 24–48 h) a "pago no completado" sin borrar |
| ADM-22 | P1 | Checkout/Cupones | Si el cupón se agota entre validar y consumir, se responde error pero el pedido CE queda creado con stock descontado | Pedido huérfano | INFERIDO · `checkoutController.js:367-385` | Consumir el cupón antes de crear el pedido o revertir el pedido |
| ADM-23 | P1 | Permisos | Vendedor ve `unitCost` en el detalle del pedido (el catálogo sí lo oculta) | Exposición de costos | PRUEBA G1 · `orderAdminController.js:108-122` | DTO por rol (`canViewOrderCosts` ya existe sin usarse) |
| ADM-24 | P2 | Pedidos UI | Tres tarjetas (Pago/Estado/Guía), dos caminos a "Enviado", selector con 9 estados, sin confirmaciones, WhatsApp automático en cada cambio, "Total pagado" con pago pendiente | Errores operativos, pasos memorizados | CÓDIGO · `OrderDetail.jsx` | Panel de "siguiente acción" contextual por estado; confirmación en cancelar; WhatsApp como botón opcional |
| ADM-25 | P2 | Pedidos UI | Lista sin bandejas, sin filtros de método/fecha, errores ocultos como "sin resultados", sin acciones rápidas | Búsqueda manual | CÓDIGO · `OrdersList.jsx` | Pestañas por bandeja con contadores; filtros existentes del backend; estado de error con reintento |
| ADM-26 | P2 | Pedidos API | Búsqueda con regex sin escapar: `(` → 500 | Error al buscar nombres con paréntesis, `+`, etc. | PRUEBA G2 · `orderAdminController.js:77-85` | Escapar el texto |
| ADM-27 | P2 | Pedidos | Guía editable en pedidos cancelados/entregados; corregir la guía no reenvía el correo; registrar guía en "Pagado" no despacha | Datos inconsistentes | PRUEBA B6 · `orderAdminController.js:286-339` | Integrar en el módulo de transiciones |
| ADM-28 | P2 | Índices | `idempotencyKey` único `sparse` con `default: null` bloquea pedidos sin clave; `orderNumber` indexado dos veces produce error en `Order.init()` | Bloqueará pedidos manuales futuros y `seed:demo-order` | PRUEBA A0, A1 · `models/order.js:44, 136, 179, 182` | Índice parcial (`partialFilterExpression: {idempotencyKey: {$type: "string"}}`) y eliminar el índice duplicado |
| ADM-29 | P2 | Navegación | 13 entradas, inventario en 5 vistas, Alertas duplica dashboard, Contenido con 10 pestañas mezclando marketing y exportaciones con datos personales, Auditoría oculta pero enlazada | Carga cognitiva | CÓDIGO | Reorganización §9 |
| ADM-30 | P2 | Configuración | Campos de envío editables pero ignorados; transportadoras con ids crudos | Confusión | CÓDIGO · `configuracion/page.js:93-151` | Mostrar "Envío incluido" como información; ocultar campos inactivos |
| ADM-31 | P2 | Productos | Lista limitada a 100 sin búsqueda, filtros ni paginación; eliminación física sin comprobar pedidos pendientes | Escalabilidad y riesgo de datos | CÓDIGO · `productos/page.js:198-201` | Búsqueda/filtros; preferir desactivar a borrar cuando hay pedidos abiertos |
| ADM-32 | P2 | Fechas | "Hoy", "enviados hoy" (por `updatedAt`) y el prefijo del pedido usan la hora del servidor | Cifras desfasadas 5 h si el servidor está en UTC | CÓDIGO · `dashboardAdminController.js:10-21`, `orderService.js:10-13` | Calcular en `America/Bogota`; "enviados hoy" desde `statusHistory` |
| ADM-33 | P2 | Vendedor | `/admin/solicitudes` usa la variante admin: el vendedor pierde su menú; vendedor puede confirmar pagos | Navegación rota; permisos amplios | CÓDIGO · `solicitudes/page.js:10`, `orderPermissions.js:24` | Decidir si el rol vendedor se usa (pregunta §11) |
| ADM-34 | P2 | Auditoría | No se auditan webhooks, cancelaciones del cliente ni correos | Trazabilidad incompleta | CÓDIGO | Registrar en el historial del pedido y en auditoría |
| ADM-35 | P2 | Checkout | Formato de correo, teléfono y departamento no validados en servidor | Correos que nunca llegan; datos de envío erróneos | CÓDIGO · `checkoutController.js:205-219` | Validación de formato y lista de departamentos (ya existe en `getCheckoutConfig`) |
| ADM-36 | P3 | Correos | HTML sin escapar en correos de admin y despacho (mitigado por el saneamiento XSS global) | Bajo | CÓDIGO · `emailService.js:126-143, 172-190` | Reutilizar `escapeHtml` de `orderReceiptService.js` |
| ADM-37 | P3 | Asignación | `assign` sin UI y sin validar que el destinatario sea personal | Bajo (sin UI) | PRUEBA G3 | Ocultar o validar |
| ADM-38 | P3 | Residuos | `source: manual`, `channelOrigin`, POS, transportadoras y métodos históricos en selectores; etiquetas de estado duplicadas en 4 archivos | Ruido | CÓDIGO | Centralizar etiquetas; ocultar históricos en selectores (conservar en datos) |
| ADM-39 | P3 | UI/Accesibilidad | Estilos en línea, `alert()` nativo, mensajes sin `role="status"`, emojis como iconos, sin gestión de foco | Consistencia y accesibilidad | CÓDIGO; navegador [PENDIENTE] | Componentes compartidos de aviso/confirmación |

**Separación defecto vs. preferencia:** ADM-01 a ADM-23, 26-28, 32, 35 son defectos verificables. ADM-24, 25, 29-31, 33, 38, 39 son mejoras de usabilidad/diseño con impacto operativo argumentado.

---

## 9. Propuesta conceptual de reorganización (no implementar todavía)

Principio: organizar por **tarea y frecuencia**, no por entidad técnica.

```
Inicio (diario)
  ├─ "Qué hacer ahora": bandejas con contador → enlace filtrado
  │    Por confirmar · Por preparar · Por despachar · En camino > N días · Requieren revisión
  ├─ Incidencias: pagos con problema, correos fallidos, variantes agotadas/bajas
  └─ Resumen: ventas del mes (pagadas y no canceladas), pedidos de hoy
Pedidos (diario)
  ├─ Pestañas = bandejas anteriores + Todos (filtros: método, fecha, búsqueda)
  └─ Detalle: cabecera con estado y UNA acción principal según estado
       (Preparar → Registrar guía y despachar → Marcar entregado [y cobrado si CE])
       acciones secundarias: cancelar (con confirmación y motivo), reenviar correo, WhatsApp
       pestañas: Cliente/Envío · Productos · Historial y notificaciones
Productos (semanal)
  ├─ Lista con stock por variante, filtros agotado/bajo, ajuste rápido ±
  ├─ Movimientos de inventario (hoy "Inventario")
  └─ Catálogo base (categorías, tallas, colores, tejidos, hormas)
Atención al cliente (según demanda)
  ├─ Solicitudes especiales
  └─ PQR y datos (se mantiene separado por requisitos legales)
Tienda online (ocasional)
  └─ Inicio · Imágenes · Banners · Páginas · Reseñas · Apariencia
Marketing (ocasional)
  └─ Cupones · Popup · Newsletter · Carritos
Finanzas (superadmin)
Configuración (ocasional)
  └─ Tienda (impuestos, envío informativo, transportadoras) · Usuarios · Auditoría · Exportaciones
```

| Módulo actual | Decisión | Justificación / dependencias / riesgo |
|---|---|---|
| Dashboard | **Mejorar** | Reemplazar KPI decorativos por bandejas e incidencias. Riesgo bajo (solo lectura). |
| Alertas (página) | **Integrar con Inicio**; campana se mantiene | Misma pregunta que el dashboard. Depende de `adminAlertController`; se reutiliza. |
| Pedidos | **Mantener y mejorar** (prioridad) | Núcleo operativo. Depende del módulo de transiciones (Etapa 1). |
| Productos | **Mantener y mejorar** | Absorbe la pestaña "Inventario". |
| Inventario (historial) | **Integrar con Productos** como "Movimientos" | Mismo dominio; ruta actual puede redirigir. |
| Catálogo base | **Mover** bajo Productos (secundario) | Uso esporádico. |
| Contenido (10 pestañas) | **Dividir** en "Tienda online" y "Marketing"; **Exportar → Configuración** | Separa tareas visuales de datos personales. Rutas `?tab=` actuales pueden redirigir. |
| Cupones | **Mover a Marketing** | Uso ocasional. |
| Solicitudes, PQR | **Mantener**, agrupar bajo "Atención al cliente" | PQR tiene obligaciones legales propias; no fusionar con solicitudes. |
| Configuración | **Mejorar** | Campos de envío como información mientras rija "envío incluido". |
| Usuarios, Auditoría | **Mover a Configuración** | Auditoría hoy oculta pero enlazada. |
| Finanzas | **Mantener** (superadmin), corregir criterio de ingresos | — |
| Panel vendedor | **Mantener u ocultar** según §11 | Si no se usa el rol, ocultar reduce superficie de permisos; no borrar código. |
| Nequi directo/manual | **Mantener desactivado** | Decisión del negocio; ya rechazado en backend. |
| Pedidos manuales/POS, asignación | **Candidata a eliminar de la UI** (residuos) | Sin endpoint de creación; eliminar solo etiquetas visibles, conservar campos de datos. Riesgo: bajo. Requiere autorización. |

---

## 10. Plan de mejoras por etapas

Cada etapa es pequeña, verificable con el arnés aislado (`evidencias/verificacion-admin.test.js`, que debe pasar de "documenta el defecto" a "exige el comportamiento correcto") y desplegable por separado.

**Etapa 0 — Red de seguridad (½ día).** Convertir los 22 casos en aserciones del comportamiento deseado; añadir casos de regresión del flujo feliz (CE completo, Wompi aprobado). Sin cambios de aplicación.

**Etapa 1 — Integridad de pedidos y pagos (P0).**
1. `orderTransitions` (backend, un archivo): tabla estado×método×rol → siguientes estados permitidos y efectos. Usar en `updateOrderStatus`, `confirmPayment`, `updateShipping` y en la UI (el selector solo muestra estados válidos). Resuelve ADM-01, 02, 04, 27.
2. Contraentrega: pago se registra en "Entregado y cobrado"; Wompi: sin confirmación manual (ADM-03).
3. Webhook: transición atómica, aprobado sobre cancelado/sin stock/monto distinto → bandera `requiresReview` + motivo (ADM-05, 06, 09). Validar en Wompi sandbox el reintento tras rechazo.
4. Cancelación del cliente limitada a estados sin pago (ADM-08).
5. Stock: ajustes relativos o control de versión al guardar producto; validar cantidades enteras (ADM-07, 19).
6. Número de pedido con contador atómico y zona horaria de Bogotá; errores genéricos al cliente; índices de `Order` corregidos (ADM-10, 28).

**Etapa 2 — Notificaciones confiables (P1).**
1. Registro de notificaciones en el pedido (`notifications[]`: tipo, canal, estado `sent|failed|skipped`, intentos, error) y `devMode` = `skipped` (ADM-12, 13).
2. Plantillas: pago aprobado, pago rechazado (con reintento), entregado, cancelado; aviso al admin "listo para preparar" y "requiere revisión" (ADM-11, 15).
3. Botón "Reenviar" en el detalle; contador de fallidos en Inicio.
4. Separar nota interna de nota al cliente (ADM-14).
5. Validación externa: dominio verificado en Resend y `ADMIN_NOTIFY_EMAIL` [PENDIENTE].

**Etapa 3 — Operación diaria (P1/P2).**
1. Bandejas en backend (consulta única) y en Inicio/Pedidos; corregir KPI y alertas (ADM-16, 17, 21, 32).
2. Detalle de pedido con acción principal contextual, confirmaciones y WhatsApp opcional (ADM-24, 25).
3. Expiración de Wompi sin pagar.
4. Corrección de Finanzas (ADM-20) y DTO por rol (ADM-23).

**Etapa 4 — Inventario.** Stock por variante en la lista, ajuste rápido ±, umbral configurable, alerta por variante, "Movimientos" como pestaña (ADM-18, 31).

**Etapa 5 — Reorganización de navegación** (§9) con redirecciones desde las rutas antiguas (ADM-29, 30, 33).

**Etapa 6 — Pulido visual y accesibilidad.** Componentes compartidos de aviso/confirmación, eliminar estilos en línea, foco y `aria-live`, revisión responsive en navegador (ADM-36 a 39).

---

## 11. Preguntas pendientes (decisión comercial o validación externa)

1. **Contraentrega:** ¿el pago se considera recibido cuando la transportadora entrega, o cuando la transportadora gira el recaudo? ¿Quién lo marca y con qué dato (número de guía, comprobante de recaudo)?
2. **Cancelaciones del cliente:** ¿hasta qué estado puede cancelar por sí mismo? ¿Cómo se gestionan los reembolsos Wompi (desde el panel de Wompi y luego se marca "reembolsado" aquí)?
3. **Rol vendedor:** ¿hay o habrá personal con ese rol? Si no, ¿ocultamos el panel `/vendedor`? Si sí, ¿debe poder confirmar pagos y ver costos?
4. **Pedidos Wompi sin pagar:** ¿tras cuántas horas se consideran abandonados?
5. **Stock bajo:** ¿umbral único (p. ej. 2 unidades por talla/color) o distinto por producto?
6. **Avisos al cliente:** ¿qué eventos van por correo y cuáles se siguen avisando por WhatsApp manual? ¿Se conserva el WhatsApp automático al cambiar de estado?
7. **Validación externa:** dominio remitente verificado en Resend, valor de `ADMIN_NOTIFY_EMAIL`, y prueba en Wompi sandbox de un enlace `single_use` con transacción rechazada y luego aprobada.
8. **Plazo de entrega** (pendiente E-10 de la auditoría de privacidad): necesario para el acuse y los correos de despacho.
9. **Pedidos manuales** (WhatsApp/presencial): ¿se necesitan? El modelo tiene campos para ello pero no hay forma de crearlos.

---

## Anexo A. Pruebas existentes y cobertura

| Área | Pruebas en el repositorio | Pruebas fuera de la app | Cobertura |
|---|---|---|---|
| Backend (general) | Ninguna (`"test": "echo Error…"` en `backend/package.json`) | — | — |
| Checkout, acuse, seguimiento, webhook Wompi (verificación) | — | `docs/auditoria-privacidad/evidencias/pruebas/privacy.test.js` (42 casos) | Privacidad y validación del webhook |
| Gestión de pedidos admin, estados, inventario, notificaciones, permisos, dashboard | — | **Nuevo:** `docs/auditoria-admin/evidencias/verificacion-admin.test.js` (22 casos) | Documenta los defectos de este informe |
| Frontend | Solo `eslint` | E2E Playwright de privacidad (22 escenarios) | Sin flujos del administrador |

**Resultado de la ejecución (2026-11-20):** 22/22 casos ejecutados; 20 documentan un defecto (`ok: false` en el JSON), 2 son informativos (D1, F1). 0 intentos de red saliente. Ver `evidencias/resultados-2026-11-20.json`.

**Cómo reproducir** (fuera del repositorio, con `mongodb-memory-server` instalado en una carpeta aparte):

```bash
DIZOR_BACKEND_DIR="<ruta>/dizor/backend" MMS_DIR="<carpeta con node_modules/mongodb-memory-server>" \
MONGOMS_SYSTEM_BINARY="<ruta a mongod>" node --test --test-concurrency=1 verificacion-admin.test.js
```

## Anexo B. Bloqueos para pruebas adicionales

- **Correo real:** sin clave de Resend de pruebas ni buzón controlado no se puede verificar aceptación ni entrega.
- **Wompi:** sin credenciales sandbox no se probó la creación real del enlace ni el comportamiento de un enlace `single_use` tras un rechazo (afecta la probabilidad de ADM-05, no su existencia en el código).
- **Navegador:** no se ejecutó la UI del administrador; responsive, teclado y lector de pantalla se evaluaron por inspección de código.
- **Producción:** no se consultaron datos reales (por restricción), así que no se sabe cuántos pedidos ya están en estados inconsistentes. Se sugiere, con autorización, una consulta de solo lectura: pedidos `cancelado` con `paymentStatus: "pagado"`, `enviado/entregado` sin `paymentConfirmedAt`, `pago_pendiente` con `wompi.status: "APPROVED"`, y variantes con stock no entero.
