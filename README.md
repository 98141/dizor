# Dizor — Plataforma e-commerce artesanal

Sombreros artesanales en palma de iraca · Sandoná, Nariño, Colombia.  
Stack: **Next.js 15 App Router + Express 5 + MongoDB/Mongoose**.

---

## 1. Arranque local

```powershell
# Terminal 1 — API
cd backend
npm install
npm run seed:superadmin    # primera vez
npm run seed:catalog       # si no hay productos
npm run seed:settings
npm run seed:cms
npm run seed:marketing
npm run dev

# Terminal 2 — Tienda
cd frontend
npm install
# copia .env.example a .env y verifica NEXT_PUBLIC_API_URL
npm run dev
```

| Servicio | URL |
|----------|-----|
| Tienda | http://localhost:3000 |
| API | http://localhost:5000/api |
| Admin | http://localhost:3000/admin |
| Vendedor | http://localhost:3000/vendedor |

---

## 2. Variables de entorno

### Backend (`backend/.env`)

| Variable | Uso |
|----------|-----|
| `MONGO_URI` | Conexión MongoDB |
| `JWT_SECRET` | Firma tokens de acceso |
| `JWT_REFRESH_SECRET` | Firma tokens de refresco |
| `CLIENT_URL` | CORS + enlaces en emails |
| `RESEND_API_KEY` | Envío de emails (auth, pedidos, carrito abandonado) |
| `EMAIL_FROM` | Remitente de correos |
| `ADMIN_NOTIFY_EMAIL` | Alertas admin (nuevos pedidos, solicitudes) |
| `CLOUDINARY_CLOUD_NAME` | Subida de imágenes de productos |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |
| `WOMPI_PRIVATE_KEY` | Payment links Wompi |
| `WOMPI_EVENTS_SECRET` | Validación checksum webhook |
| `WOMPI_ENV` | `sandbox` o `production` |
| `PORT` | Puerto API (por defecto 5000) |
| `NODE_ENV` | `development` o `production` |

### Frontend (`frontend/.env`)

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_API_URL` | URL del backend (`http://localhost:5000/api` en local) |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio (para SEO y sitemap en producción) |

---

## 3. Módulos implementados

| Fase | Contenido |
|------|-----------|
| 1 | Auth completo: registro, login, JWT refresh, recuperar contraseña, Resend |
| 2 | Catálogo público: listado, filtros, búsqueda, producto detalle, JSON-LD |
| 3 | Carrito (guest + autenticado), checkout, pedidos, seguimiento por código |
| 4 | Panel admin/vendedor: gestión pedidos, confirmar pagos, guías de envío |
| 5 | Admin catálogo: productos, variantes, colores, tallas, taxonomías, Cloudinary |
| 6 | Perfil cliente, direcciones guardadas, usuarios admin, configuración tienda |
| 7 | Solicitudes personalizadas y pedidos por mayor (cliente + admin) |
| 8 | CMS: home, banners, páginas de contenido, footer dinámico |
| 9 | Marketing: newsletter, popup, carritos abandonados, export CSV |
| 10 | Pagos: Wompi payment links + webhook, Nequi manual, contra entrega |
| 11 | Finanzas: reporte de ventas, gráficas, filtros por período |
| 12 | Alertas: notificaciones en tiempo real para nuevos pedidos |
| 13 | Inventario: historial de movimientos, ajustes de stock |
| 14 | Auditoría: registro de todas las acciones admin con filtros y stats |
| 15 | **Branding dinámico**: nombre del sitio, colores y favicon desde admin |
| 16 | **SEO completo**: robots.txt, noindex en rutas privadas, sitemap, manifest PWA |
| 17 | **Logging estructurado**: Winston + rotación diaria de logs en producción |

---

## 4. Branding dinámico

El nombre del sitio, colores (primario, acento, fondo) y URL del favicon se controlan desde el panel admin sin tocar código.

**Dónde configurar:** `/admin/contenido` → pestaña **Apariencia**

**Cómo funciona:**
- Los valores se guardan en MongoDB (`storeSettings.appearance`).
- El backend expone `GET /api/content/appearance` (caché de 30 s en Next.js).
- El layout raíz inyecta los colores como variables CSS (`:root { --color-primary: ... }`).
- `SiteConfigContext` distribuye el nombre del sitio a todos los componentes cliente (navbar, footer, admin, emails de WhatsApp).
- Si no hay valor configurado, el nombre por defecto es **MBT**.

> Al cambiar el nombre o colores en admin, el sitio refleja el cambio en máximo 30 segundos (caché ISR).

---

## 5. Panel de contenido unificado

`/admin/contenido` agrupa en una sola página de **8 pestañas** lo que antes estaba separado:

| Pestaña | Contenido |
|---------|-----------|
| Inicio | Textos y sección hero de la home |
| Banners | Carrusel de imágenes |
| Páginas | Páginas de contenido (términos, políticas, etc.) |
| Popup | Popup promocional de bienvenida |
| Newsletter | Suscriptores y export CSV |
| Carritos | Carritos abandonados y recordatorios |
| Exportar | Exportación de datos |
| **Apariencia** | Nombre sitio, colores, favicon |

> `/admin/marketing` redirige automáticamente a `/admin/contenido`.

---

## 6. Seguridad

La plataforma implementa múltiples capas de protección en backend y frontend.

### Backend

| Capa | Implementación |
|------|---------------|
| **Rate limiting** | Global: 300 req/15 min (rutas públicas). Admin: 1500 req/15 min. Login: 5 intentos/15 min. Tracking: 15 req/15 min. Webhook: 100 req/min |
| **Sanitización de inputs** | `mongo-sanitize` + `xss` en `req.body`, `req.params` y `req.query` en cada request |
| **Helmet** | Cabeceras HTTP de seguridad (HSTS, X-Content-Type-Options, etc.) |
| **HPP** | Prevención de HTTP Parameter Pollution en rutas de catálogo |
| **JWT** | Access token (15 min) + Refresh token (7 días, hashed en DB). Secretos mínimo 32 caracteres |
| **Bloqueo de cuenta** | 5 intentos fallidos → bloqueo 15 min. El contador no se resetea en cada bloqueo |
| **isActive en refresh** | Un usuario desactivado por admin no puede obtener nuevos tokens |
| **CORS** | Solo acepta requests desde `CLIENT_URL` configurado |
| **Webhook anti-replay** | El webhook de Wompi verifica el timestamp del evento (ventana ±5 min) |
| **Stock atómico** | Deducción y restauración de stock con `findOneAndUpdate` + `$inc` + `$gte` — sin race conditions |
| **Cupón atómico** | Consumo de cupón con `findOneAndUpdate` condicional — previene doble uso concurrente |
| **DTO de pedidos** | `formatOrderForClient` nunca expone `unitCost` ni campos internos al cliente |
| **Idempotencia de órdenes** | Una misma `idempotencyKey` devuelve la orden existente solo si pertenece al mismo actor |
| **Validación de entorno** | El servidor no arranca si `JWT_SECRET` < 32 chars. En producción falla si `WOMPI_ENV !== "production"` |
| **Auditoría completa** | Todas las acciones de staff (pedidos, catálogo, cupones, CMS, usuarios) quedan en `AuditLog` |

### Frontend (Next.js)

| Capa | Implementación |
|------|---------------|
| **Content-Security-Policy** | `script-src`, `style-src`, `img-src`, `connect-src`, `frame-src`, `object-src` estrictamente definidos |
| **X-Frame-Options** | `DENY` en `/admin/*` y `/vendedor/*`; `SAMEORIGIN` global |
| **X-Content-Type-Options** | `nosniff` en todas las rutas |
| **Referrer-Policy** | `strict-origin-when-cross-origin` |
| **Permissions-Policy** | Deshabilita cámara, micrófono y geolocalización |
| **X-Robots-Tag** | `noindex, nofollow` en `/admin/*`, `/vendedor/*` y `/api/*` |
| **Imágenes** | `remotePatterns` solo permite `res.cloudinary.com` e `images.unsplash.com`; sin wildcards |

> En desarrollo, la CSP incluye `'unsafe-eval'` para los source maps de React/HMR. En producción este permiso se omite automáticamente.

---

## 7. Roles y permisos

| Rol | Acceso |
|-----|--------|
| `cliente` | Tienda pública, carrito, checkout, mis pedidos, mi perfil |
| `vendedor` | Panel `/vendedor`: gestión de pedidos, solicitudes especiales |
| `admin` | Todo lo del vendedor + catálogo, contenido CMS, cupones, marketing, inventario, auditoría |
| `superadmin` | Todo lo del admin + gestión de usuarios staff, finanzas, configuración de tienda |

**Reglas adicionales:**
- Staff (`admin`, `vendedor`, `superadmin`) no puede hacer checkout como cliente (`blockStaffCheckout`).
- Solo `superadmin` puede crear, editar o desactivar otros usuarios staff.
- Solo `superadmin` accede a reportes de finanzas y costos internos de productos.
- Los usuarios guest (sin cuenta) pueden: navegar, agregar al carrito, hacer checkout, y seguir pedidos por código.

---

## 8. Flujo de pedidos y stock

### Estados de una orden

```
pago_pendiente → pagado → preparando → enviado → entregado
     ↓                        ↓
  cancelado              cancelado (si aún no se envió)
```

Para `contra_entrega` el estado inicial es `pendiente` (sin esperar confirmación de pago).

### Cuándo se descuenta el stock

| Método de pago | Descuento de stock |
|---|---|
| `nequi_manual` | Al crear la orden (inmediato) |
| `contra_entrega` | Al crear la orden (inmediato) |
| `wompi` | Al confirmar el pago (webhook `transaction.updated → APPROVED`) |

Si el pago Wompi se aprueba pero el stock se agotó mientras esperaba, la orden queda marcada para revisión manual con una nota en el historial. El admin debe resolverlo.

### Stock al cancelar

- Si `stockDeducted = true` → se restaura el stock automáticamente al cancelar.
- Si `stockDeducted = false` (Wompi sin pagar, cancelado antes del webhook) → no hay stock que restaurar.

---

## 9. Sistema de cupones

Los cupones se crean desde `/admin/cupones` y se aplican en el checkout.

| Campo | Descripción |
|-------|-------------|
| `code` | Código único (en mayúsculas) |
| `type` | `percentage` (% del subtotal) o `fixed` (monto fijo COP) |
| `value` | Valor del descuento |
| `minOrderAmount` | Compra mínima requerida |
| `maxUses` | Usos totales permitidos (`null` = ilimitado) |
| `usedCount` | Usos acumulados (solo lectura) |
| `expiresAt` | Fecha de expiración opcional |
| `isActive` | Se puede activar/desactivar sin eliminar |

**Protección anti-fraude:** el consumo del cupón se realiza con una operación atómica MongoDB (`findOneAndUpdate` con `$expr: { $lt: ["$usedCount", "$maxUses"] }`). Dos requests concurrentes con el mismo cupón no pueden duplicar su uso.

---

## 10. SEO

| Recurso | Comportamiento |
|---------|---------------|
| `robots.txt` | Generado por `app/robots.js`; bloquea `/admin/`, `/vendedor/`, `/api/`, `/checkout`, `/cuenta`, `/login`, `/register` y similares |
| Páginas privadas | `metadata: { robots: { index: false } }` en sus layouts — doble protección |
| Sitemap | `app/sitemap.js` — incluye home, catálogo, productos activos y páginas CMS |
| Manifest PWA | `app/manifest.js` — nombre y colores dinámicos desde `appearance` |
| Metadatos dinámicos | `generateMetadata()` en cada página pública con título, descripción y OG |
| JSON-LD | Schema `Organization` y `WebSite` en el layout raíz; `Product` en cada producto |

**Cuando tengas dominio:** actualiza `NEXT_PUBLIC_SITE_URL` en el `.env` del frontend. El sitemap y el `allowedOrigin` del robots tomará el valor real.

---

## 11. Sistema de logging

Los logs se escriben en `backend/logs/` con rotación diaria automática.

```
backend/logs/
  combined-YYYY-MM-DD.log   ← todos los eventos (info, http, warn, error)
  error-YYYY-MM-DD.log      ← solo errores 500 y crashes
```

**Ver logs en tiempo real (PowerShell):**
```powershell
# Todos los eventos
Get-Content "backend\logs\combined-2026-05-21.log" -Wait -Tail 30

# Solo errores
Get-Content "backend\logs\error-2026-05-21.log" -Wait -Tail 30

# Buscar intentos de acceso no autorizado
Select-String '"warn"' "backend\logs\combined-2026-05-21.log"
```

**Niveles registrados:**

| Nivel | Cuándo |
|-------|--------|
| `error` | Errores 500, crashes, variables de entorno faltantes |
| `warn` | Errores 401/403 (intentos de acceso no autorizado), fallo al guardar auditoría |
| `info` | Servidor iniciado |
| `http` | Cada request HTTP (método, ruta, código, tiempo de respuesta) |

**Retención:** errores → 30 días / combined → 14 días. Archivos mayores a 10 MB se rotan. La carpeta `logs/` está en `.gitignore`.

**Qué hacer si ves esto:**
- Muchos `warn 401` desde la misma IP → posible fuerza bruta (revisar rate limit de auth)
- `error` en `POST /api/checkout/orders` → orden fallando antes de guardarse
- Tiempos de respuesta `> 2000 ms` en catálogo → revisar índices de MongoDB

---

## 12. Auditoría

Registra acciones de staff en MongoDB (`AuditLog`). Cada entrada incluye:
`userId`, `userEmail`, `role`, `action`, `module`, `entityId`, `ip`, `userAgent`, **`method`**, **`path`**, `previousData`, `newData`, `success`, `createdAt`.

**Ver logs de auditoría:** `/admin/auditoria` → filtros por módulo, acción, rol, rango de fechas.

**API (solo superadmin/admin):**
- `GET /api/admin/audit?module=orders&from=2026-01-01`
- `GET /api/admin/audit/stats`

---

## 13. Cloudinary — imágenes

Variables requeridas en `.env` del backend: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

Flujo actual: editar producto → campo URL de imagen → guardar URL pública de Cloudinary.

> **Pendiente:** el campo de imagen en el formulario de producto actualmente acepta URL manual. La carga directa desde el equipo (seleccionar archivo) está planificada como mejora.

---

## 14. Wompi — pagos

1. Cuenta en [comercios.wompi.co](https://comercios.wompi.co) (sandbox disponible).
2. Copiar `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET` al `.env`.
3. Configurar webhook en el dashboard de Wompi: `https://TU-DOMINIO/api/webhooks/wompi`
4. Checkout → método Wompi → redirección a `checkout.wompi.co`.
5. Pago aprobado → webhook actualiza `paymentStatus: pagado` automáticamente.

Métodos alternativos sin integración bancaria: **Nequi manual** (cliente sube comprobante) y **contra entrega**.

---

## 15. Rutas del API — resumen de acceso

| Ruta | Acceso |
|------|--------|
| `GET /api/products/*` | Público |
| `GET /api/content/*` | Público |
| `GET /api/marketing/config` | Público |
| `POST /api/marketing/newsletter` | Público |
| `POST /api/auth/*` | Público |
| `GET /api/cart`, `POST /api/checkout/*` | Público + autenticado |
| `GET/POST /api/special-requests` | Público + autenticado |
| `/api/admin/users` | Solo superadmin |
| `/api/admin/finance` | Solo superadmin |
| `/api/admin/catalog`, `/api/admin/orders` | Admin + superadmin |
| `/api/admin/solicitudes` | Admin + superadmin + vendedor |
| `/api/admin/audit` | Admin + superadmin |
| `/api/webhooks/wompi` | Validado por HMAC (sin auth JWT) |

---

## 16. Scripts útiles

```bash
# Seeders (backend)
npm run seed:superadmin     # crea usuario superadmin inicial
npm run seed:catalog        # productos de ejemplo
npm run seed:settings       # configuración tienda
npm run seed:cms            # contenido home, banners, páginas
npm run seed:marketing      # popup + textos marketing

# Utilidades
npm run marketing:reminders # envía recordatorios de carrito abandonado
npm run fix:slugs           # corrige slugs de productos existentes
```

---

## 17. Build producción

```powershell
# Frontend
cd frontend
npm run build
npm start

# Backend
cd backend
npm start   # NODE_ENV=production en el .env
```

En producción, el logger cambia automáticamente a formato JSON sin colores ANSI.

---

## 18. Favicon e íconos PWA — pendiente

Los archivos de imagen deben colocarse en estas rutas:

| Archivo | Tamaño | Ruta |
|---------|--------|------|
| `favicon.ico` | 32×32 | `frontend/src/app/favicon.ico` |
| `icon.png` | 512×512 | `frontend/src/app/icon.png` |
| `apple-icon.png` | 180×180 | `frontend/src/app/apple-icon.png` |
| `icon-192.png` | 192×192 | `frontend/public/icon-192.png` |
| `icon-512.png` | 512×512 | `frontend/public/icon-512.png` |

Next.js detecta `favicon.ico` e `icon.png` en `app/` automáticamente y los añade al `<head>`. Los archivos de `public/` son referenciados por el manifest PWA.

> Hasta que se coloquen estos archivos, el navegador mostrará el favicon por defecto y el manifest PWA lanzará advertencias 404.

---

## 19. Mejoras futuras planificadas

### Alta prioridad

- [ ] **Carga de imágenes desde el equipo** — el formulario de producto actualmente solo acepta URL. Implementar selector de archivo (`<input type="file">`) que suba directamente a Cloudinary desde el frontend admin. Backend ya tiene `multer` + `multer-storage-cloudinary` instalados.
- [ ] **Archivos de favicon e íconos PWA** — ver sección 19.
- [ ] **og:image para homepage y páginas principales** — agregar imagen de marca (1200×630 px) a `frontend/public/og-default.jpg` y configurarla en los metadatos de inicio, catálogo, personalizar y pedido-mayor. Mejora el preview de WhatsApp, Facebook e Instagram al compartir el link.
- [ ] **Verificación de email en registro** — los pedidos guest se vinculan automáticamente al crear cuenta por coincidencia de email, sin verificar que ese email le pertenece realmente. Requiere implementar flujo de confirmación por correo (enviar token → usuario confirma → se activa la vinculación).

### Media prioridad

- [ ] **Cron automático de recordatorios** — programar `marketing:reminders` como tarea diaria en el servidor (PM2 cron, cron de sistema, o servicio externo).
- [ ] **Búsqueda con Atlas Search** — reemplazar regex de MongoDB por Atlas Search para búsqueda más robusta y tolerante a errores tipográficos.
- [ ] **Metadata dinámica en catálogo filtrado** — actualmente `/catalogo?term=brisa` tiene el mismo título que `/catalogo`. Requiere convertir el catálogo de cliente a componente servidor para poder exportar `generateMetadata` con acceso a `searchParams`.
- [ ] **TTL de carritos abandonados** — los carritos sin actividad se acumulan en MongoDB indefinidamente. Agregar un índice TTL o un script de limpieza periódica.
- [ ] **Notificaciones push** — enviar push al admin cuando llega un pedido (complemento al sistema de alertas actual).
- [ ] **Paginación en auditoría frontend** — la página `/admin/auditoria` podría mejorar la experiencia de filtros y exportación para volúmenes grandes.

### Despliegue

- [ ] Desplegar MongoDB Atlas, API (Railway/Render/VPS) y Next.js (Vercel/Netlify).
- [ ] Configurar Resend, Cloudinary y Wompi con credenciales de producción.
- [ ] Asignar dominio real y SSL (requerido para webhook Wompi).
- [ ] Actualizar `CLIENT_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL` en producción.
- [ ] Configurar `WOMPI_ENV=production` (el servidor rechaza arrancar en producción si no está configurado).
- [ ] Verificar que `JWT_SECRET` y `JWT_REFRESH_SECRET` tienen al menos 32 caracteres en producción (el servidor rechaza arrancar si no).
- [ ] Configurar webhook en el dashboard de Wompi: `POST https://TU-DOMINIO/api/webhooks/wompi`.

### Pruebas pendientes de validar

- [ ] Flujo completo Wompi en sandbox: pago → webhook → estado pedido actualizado → stock descontado.
- [ ] Escenario Wompi con stock agotado: pago aprobado → stock insuficiente → orden marcada para revisión manual.
- [ ] Email de recuperación de contraseña llegando correctamente con Resend.
- [ ] Carrito abandonado: email de recordatorio llega al cabo de las horas configuradas.
- [ ] Cupón de un solo uso: dos requests concurrentes → solo uno obtiene el descuento.
- [ ] SEO: verificar con Google Search Console tras tener dominio. Validar structured data con la herramienta de Rich Results de Google.
- [ ] PWA: instalar desde Chrome en móvil y verificar íconos y splash.
- [ ] Bloqueo de cuenta: 5 intentos fallidos de login → cuenta bloqueada 15 min → intento extra no resetea el contador.

---

## 20. Arquitectura resumida

```
dizor/
├── backend/
│   ├── src/
│   │   ├── config/        — MongoDB
│   │   ├── controllers/   — lógica de negocio
│   │   ├── lib/           — logger (Winston)
│   │   ├── middlewares/   — auth, roles, errores, rate limit
│   │   ├── models/        — Mongoose schemas
│   │   ├── routes/        — Express routers
│   │   ├── services/      — email, auditoría, Cloudinary
│   │   ├── utils/         — AppError, catchAsync
│   │   └── validators/    — express-validator
│   └── logs/              — archivos de log (gitignored)
│
└── frontend/
    └── src/
        ├── app/           — Next.js App Router (páginas y layouts)
        ├── components/    — componentes reutilizables
        ├── context/       — AuthContext, CartContext, SiteConfigContext
        ├── lib/           — fetchAppearance, formatCurrency, orderLabels
        ├── services/      — llamadas al API
        └── styles/        — CSS modular por componente
```

---

*Proyecto Dizor — sombreros artesanales, Sandoná, Nariño.*  
*Desarrollado modularmente. Funcional en local. Listo para despliegue.*
