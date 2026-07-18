# Decisiones — Rediseño Home Dizor (patrón MACANA)

## Alcance entregado
- Home editorial con composición MACANA y **tokens Dizor** (`variables.css` / apariencia CMS).
- CMS de imágenes del home (Cloudinary) en `/admin/home-imagenes`.
- Productos aleatorios cacheados 24h + carrusel bajo Historia.
- Sistema de reseñas con moderación admin/superadmin.
- Personalizar → `/personalizar`; por mayor → `/pedido-mayor` (enlaces en sección Personalización y nav existente).

## Imágenes del home
- Modelo `HomeImage`: `url`, `publicId`, `altText`, `seccion` (`hero|historia|personalizacion|inspiracion|coleccion`), `orden`, `activo`, `titulo`, `linkHref`.
- Upload obligatorio desde dispositivo → carpeta Cloudinary `dizor/home`.
- `GET /api/content/home` incluye `homeImages` agrupadas; la primera imagen activa de hero/historia/personalizacion tiene prioridad sobre `imageUrl` legacy del `HomeContent`.
- Fallback UI: bloque “Imagen próximamente” sin romper layout.
- Colecciones: si hay imágenes `coleccion`, se usan; si no, fallback a tejidos del catálogo con placeholder.

## Ventana 24h de productos random
- Endpoint: `GET /api/products/daily-random?limit=10` (máx. 10).
- Modelo `DailyProductPick` con `dateKey` = `YYYY-MM-DD` en zona **America/Bogota**.
- Primera request del día genera `$sample` de productos activos y persiste IDs; el resto del día reutiliza la misma lista.
- Carrera concurrente: índice único en `dateKey` + relectura si `11000`.

## Reseñas
- Modelo `Review`: `product`, `user`, `authorName`, `city`, `rating` (1–5), `comment`, `aprobado`, `isBrandReview`, `createdBy`.
- Cliente autenticado: solo con compra verificada (`paymentStatus: pagado` o estados de pedido avanzados); nace `aprobado: false`; una reseña por (user, product).
- Rechazar = eliminar (permite volver a escribir).
- Admin/superadmin: aprobar, rechazar, crear reseña de marca auto-aprobada.
- Home: subset de aprobadas (`GET /api/reviews?limit=4`).
- Campo `city` opcional para UI tipo “voces”; no era obligatorio en pedidos.

## Textos CMS
- Nuevas secciones en `HomeContent`: `personalizacion`, `inspiracion`, `reseñasSection`, `randomProductsSection`, `newsletterSection`; hero con `brandClaim` + CTA secundario.
- Legacy docs se rellenan en `getOrCreateHomeContent`.
- Newsletter `source: "home"` añadido al enum del modelo.

## Roles
- En Dizor el rol es `superadmin` (no `super_admin`); endpoints admin usan `admin` + `superadmin`.
