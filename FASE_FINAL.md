# Dizor — Fase final (entrega)

Documento de cierre del desarrollo modular. Tú te encargas de APIs en producción, revisión de privilegios en rutas y validación final.

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
npm run seed:marketing     # popup + textos marketing
npm run dev

# Terminal 2 — Tienda
cd frontend
npm install
cp .env.example .env       # o verifica NEXT_PUBLIC_API_URL
npm run dev
```

- Tienda: http://localhost:3000  
- API: http://localhost:5000/api  
- Admin: http://localhost:3000/admin (superadmin del seed)

---

## 2. Variables de entorno

### Backend (`backend/.env`)

| Variable | Uso |
|----------|-----|
| `MONGO_URI` | MongoDB |
| `JWT_SECRET` | Sesión |
| `CLIENT_URL` | CORS + enlaces en emails |
| `RESEND_API_KEY` | Correos (auth, carrito abandonado) |
| `EMAIL_FROM` | Remitente |
| `ADMIN_NOTIFY_EMAIL` | Alertas admin |
| `CLOUDINARY_CLOUD_NAME` | Subida imágenes productos |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |
| `WOMPI_PRIVATE_KEY` | Payment links |
| `WOMPI_EVENTS_SECRET` | Webhook checksum |
| `WOMPI_ENV` | `sandbox` o `production` |

### Frontend (`frontend/.env`)

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_API_URL` | Debe ser `http://localhost:5000/api` en local |

---

## 3. Módulos entregados

| Fase | Contenido |
|------|-----------|
| 1 | Auth, roles, cuenta, Resend |
| 2 | Catálogo público, producto, filtros |
| 3 | Carrito, checkout, pedidos, seguimiento |
| 4 | Admin/vendedor pedidos y pagos |
| 5 | Admin catálogo, productos, taxonomías |
| 6 | Perfil, direcciones, usuarios, configuración tienda |
| 7 | Solicitudes personalización / mayor |
| 8 | CMS: home, banners, páginas, footer |
| 9 | Marketing: newsletter, popup, carritos abandonados, CSV |
| Final | Cloudinary upload + Wompi payment links + webhook |

---

## 4. Marketing — cómo probar

1. `npm run seed:marketing` en backend (o `/admin/marketing` → activar popup).
2. Footer: formulario newsletter (botón claro sobre fondo verde).
3. Popup: tras ~4–5 s en la tienda (una vez por sesión; borra `sessionStorage` clave `dizor_promo_popup_seen` para repetir).
4. Carrito: invitado puede dejar email para recordatorio.
5. Admin `/admin/marketing`: configuración, suscriptores, export CSV, enviar recordatorios.
6. Cron recordatorios (opcional): `npm run marketing:reminders` en backend.

**API pública**

- `GET /api/marketing/config`
- `POST /api/marketing/newsletter` `{ email, name?, source? }`
- `POST /api/marketing/abandoned-cart` `{ email, items: [{ productId, variantId, quantity }] }`

---

## 5. Cloudinary

- Variables en `.env` del backend.
- Editar producto → **Subir a Cloudinary** (requiere producto guardado).
- Sin Cloudinary: seguir usando URL de imagen manual.

---

## 6. Wompi

1. Cuenta sandbox/producción en [comercios.wompi.co](https://comercios.wompi.co).
2. `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_ENV=sandbox`.
3. Webhook en dashboard: `https://TU-DOMINIO/api/webhooks/wompi`
4. Checkout → método Wompi → redirección a `checkout.wompi.co`.
5. Pago aprobado → webhook marca pedido `paymentStatus: pagado`.

---

## 7. Rutas admin sensibles (revisar tú)

Prioridad alta para auditoría de privilegios:

- `/api/admin/users` — solo superadmin
- `/api/admin/catalog` — staff; escritura admin/superadmin
- `/api/admin/orders` — admin + vendedor (alcance pedidos)
- `/api/admin/settings` — admin
- `/api/admin/content` — admin
- `/api/admin/marketing` — admin
- `/api/admin/special-requests` — staff

Públicas sin auth: products, content, marketing/config, marketing/newsletter, cart validate, checkout guest.

---

## 8. Scripts útiles

```bash
# Backend
npm run seed:superadmin
npm run seed:catalog
npm run seed:settings
npm run seed:cms
npm run seed:marketing
npm run marketing:reminders
npm run fix:slugs
```

---

## 9. Build producción

```powershell
cd frontend
npm run build

cd ../backend
npm start
```

---

## 10. Pendiente solo en tu lado

- [ ] Desplegar MongoDB, API y Next.js
- [ ] Configurar Resend, Cloudinary, Wompi en producción
- [ ] Endurecer rate limits y CORS (`CLIENT_URL` producción)
- [ ] Revisar roles en cada ruta `/api/admin/*`
- [ ] Programar `marketing:reminders` (cron diario)
- [ ] Dominio SSL para webhook Wompi

---

*Proyecto Dizor — sombreros artesanales, Sandoná, Nariño.*
