# FASE 7 — DYNAMIC CATALOG REPORT

## 1. Arquitectura anterior

- **Navbar:** categorías de producto hardcodeadas (p. ej. “Sombreros” → `/catalogo`). Tejidos ya dinámicos vía `GET /products/filters`.
- **Filtros catálogo:** ya consumían `categories` / `weaveTypes` / `styles` / etc. del mismo endpoint; la UI no era la fuente de verdad, pero el Navbar **sí** estaba desacoplado.
- **URLs:** filtros en `searchParams` (`category`, `weaveType`, `style`, `size`, `color`, precio, flags, `term`, `sort`, `page`).
- **Listado:** `GET /api/products` con filtros AND entre dimensiones; `category` solo acepta ObjectId válido.
- **Admin:** taxonomía CRUD (`categories`, `weaveTypes`, `styles`, …) con `isActive` y `sortOrder`.

## 2. Fuente de verdad elegida

**`GET /api/products/filters`** → payload `{ filters: { categories, colors, sizes, weaveTypes, styles } }`.

- Solo taxonomías **`isActive: true`**.
- Orden backend: **`sortOrder`, luego `name`**.
- Frontend: `fetchCatalogFilters` (`React.cache` + `revalidate: 300`).
- Helpers puros: `src/lib/catalogTaxonomy.js` (`getActiveCategories`, `categoryHref`, `taxonomyId`).
- **Navbar** (`SiteHeaderServer`) y **Home craft** reutilizan el mismo fetch cacheado.
- **Catálogo** sigue usando `getCatalogFilters` en cliente / SSR existente; misma API, sin endpoint duplicado.

No se creó un endpoint público solo de categorías.

## 3. Modelo de Category real

Campos (`backend/src/models/category.js`):

| Campo | Tipo | Notas |
|-------|------|--------|
| `_id` | ObjectId | id canónico |
| `name` | String | requerido, max 80 |
| `slug` | String | único, auto desde nombre |
| `description` | String | opcional, max 500 |
| `isActive` | Boolean | default `true` |
| `sortOrder` | Number | default `0` |
| timestamps | createdAt / updatedAt | |

Sin campo `image` en el modelo actual.

## 4. Relación Product ↔ Category

- Producto tiene **una** categoría: `category: ObjectId ref Category` (**required**).
- No hay multi-categoría.
- Dimensiones separadas (no son categorías): `weaveType`, `style`, más variantes size/color.

## 5. Archivos modificados

**Frontend**

- `src/lib/catalogTaxonomy.js` *(nuevo)*
- `src/lib/fetchCatalogFilters.js`
- `src/components/layout/SiteHeader.jsx`
- `src/components/layout/SiteHeaderServer.jsx`
- `src/components/catalog/CatalogoContent.jsx`
- `src/components/catalog/CatalogFilters.jsx`
- `src/styles/components/catalog-filters.css` (chips)
- `src/styles/layouts/public-header.css` (sección móvil Catálogo)

**Backend**

- `src/controllers/taxonomyAdminController.js` — bloqueo de delete de categoría con productos asociados

**No tocados (confirmado):** Hero, Home editorial, ProductCard Fase 6, Cart/Checkout, Favoritos, PDP.

## 6. Navbar desktop

Orden:

1. Categorías activas (dinámicas, por `sortOrder`/`name`)
2. Si hay **más de 5** → resto en dropdown **“Más”** (mismo patrón que Tejidos)
3. Estáticos: Novedades · Personaliza · Por mayor
4. Dropdown **Tejidos** (sigue siendo tejido, no categoría)

Links: `/catalogo?category=<ObjectId>`. Active state por igualdad del param `category` (no por label).

## 7. Navbar mobile

Barra intacta: `☰ | Logo | búsqueda | favoritos | carrito`.

En hamburguesa:

- Sección **Catálogo** → categorías dinámicas + “Todo el catálogo”
- Luego estáticos / Tejidos acordeón / Cuenta

Body lock y cierre al navegar se mantienen.

## 8. Filtros catálogo

- Sidebar desktop + drawer mobile (Fase 6) sin rediseño grande.
- Bloque **Categoría** = misma lista activa que Navbar (`filters.categories`).
- Toggle mobile: **`Filtros`** o **`Filtros (N)`** (N = dimensiones activas; **no** cuenta `sort`/`page`).
- Chips de resumen bajo toolbar; quitar individual + “Limpiar todo”.
- Vacío: mensaje claro + CTA “Limpiar filtros”.

## 9. Categorías dinámicas

Crear/activar en admin → aparece en Navbar + filtros tras revalidate/cache (300s o nuevo request).

Desactivar → deja de salir en `/products/filters` → desaparece de nav/filtros públicos.

Renombrar → se refleja por `name` en UI; slug se regenera en save admin.

## 10. Tejidos / estilos / tallas / colores

- Siguen siendo taxonomías independientes desde la misma API de filtros.
- **No** se mezclan tejidos dentro de categorías.
- Forma/estilo = `styles` activos (datos reales, no hardcode).
- Las opciones del panel listan taxonomías activas; **no** se filtran aún por “solo valores presentes en el resultado actual” (limitación previa del endpoint).

## 11. URLs / searchParams

**Decisión:** mantener **`category=<ObjectId>`**.

- El listado público solo aplica filtro si el valor es ObjectId válido; un slug se ignora → resultados incorrectos.
- Migración a slug pospuesta (compatibilidad + SEO gradual).
- `slug` existe en Category para uso futuro / admin.

Params relevantes: `term`, `category`, `weaveType`, `style`, `size`, `color`, `minPrice`, `maxPrice`, `inStock`, `onPromotion`, `featured`, `isNew`, `sort`, `page`.

## 12. Filtros combinados

Backend aplica **AND** entre dimensiones (categoría ∩ tejido ∩ estilo ∩ …).

Dentro de una dimensión: un valor (radio/select). Comportamiento previo conservado.

## 13. Active filters

- Contador: una unidad por param de filtro; precio min/max = 1.
- Chips con nombres resueltos desde opciones.
- Limpiar: quita filtros, **conserva `sort`**, vuelve a `/catalogo` (+ sort).

## 14. Back / Forward / Refresh

Estado en URL → historial del navegador y refresh preservan combinación (p. ej. categoría + tejido). Entrar a PDP y volver mantiene query del catálogo si el enlace fue desde esa URL.

## 15. Admin categorías

- CRUD taxonomía existente; `isActive` / `sortOrder` / slug.
- **Delete:** si hay productos con esa `category`, responde **400** y pide desactivar o reasignar.
- Producto admin: categoría por ObjectId (required) — sin migración destructiva.

## 16. Categorías vacías/inactivas

| Caso | Comportamiento |
|------|----------------|
| Inactiva | No en filters públicos → no Navbar / no filtros |
| Activa sin productos | **Sí aparece** en Navbar/filtros (API no cuenta productos). Catálogo puede mostrar 0 + limpiar |
| Preferencia sprint | No se ocultaron vacías (no hay conteo fiable en el mismo endpoint sin query extra) |

Pendiente opcional: filtrar nav a categorías con `count > 0`.

## 17. Cache / fetches

- `fetchCatalogFilters` + `React.cache` + revalidate 300.
- Header server y craft home comparten dedupe por request.
- Helpers de taxonomía en módulo puro para no arrastrar `cache`/fetch al Client Bundle del Header.

## 18. SSR / performance

- `SiteHeaderServer` sigue siendo Server Component que hidrata datos en client Header.
- Catálogo dinámico (`ƒ /catalogo`) intacto.
- Confirmado: CSS splitting, Hero, Home, ProductCard Fase 6, sin librerías nuevas.

## 19. SEO

- Metadata/canonical del layout de catálogo sigue apuntando a **`/catalogo`** (página base).
- Categorías vía query **no** generan rutas indexables propias en este sprint.
- Recomendación: indexar `/catalogo` (+ quizá futuras `/catalogo/[slug]` si se migra); **no** indexar cada combinación color/talla/sort.
- Riesgo bajo de explosion indexable mientras el canonical sea único.

## 20. Accessibility

- Links de categoría con `aria-current` cuando activos.
- Chips: botones con `aria-label` “Quitar filtro …”.
- Drawer/mobile: labels previos; Escape cierra dropdowns Más/Tejidos.
- Contador de filtros no depende solo de color.

## 21. Responsive

Diseño previo de catálogo + nav; overflow de categorías vía “Más” en desktop. Mobile sin iconos nuevos de categoría. Validar visualmente en 1440→360 (checklist entrega).

## 22. Casos probados (lógica / build)

Cubiertos por código + build; validación visual pendiente en entorno local con datos reales:

1. Catálogo sin filtros  
2–3. Cambio de categoría vía Navbar  
4–9. Combinaciones categoría + tejido/forma/talla/color/precio/promo  
10. Sort + filtros  
11. Búsqueda en `/catalogo` **preserva** otros params  
12. Vacío + limpiar  
13. Limpiar conserva sort  
14–16. Back / forward / refresh (URL)  
17. Link Navbar  
18–20. Admin: inactiva / nueva / reasignación (delete bloqueado con productos)

## 23. Build

```
npm run build  →  PASS (Next.js 16.2.6)
```

## 24. Lint

```
eslint (archivos Fase 7)  →  PASS (--max-warnings 0)
```

Notas: sync URL→state marcado con eslint-disable local (patrón intencional).

## 25. Riesgos

1. Cache 300s: categoría nueva puede tardar hasta 5 min en Navbar (o hasta redeploy/revalidate).
2. Categorías activas vacías siguen visibles.
3. URLs con ObjectId menos legibles; slugs no filtrables aún.
4. Filtros muestran todas las taxonomías activas, no solo las “factibles” bajo la selección actual.
5. “Más” aparece solo con >5 categorías; 6–8 OK, muchas seguirían en un solo dropdown simple.

## 26. Pendientes

- Opcional: ocultar categorías sin productos en Navbar.
- Opcional: `category=slug` con resolución backend + redirects id→slug.
- Opcional: faceted filters (opciones dependientes del resultado).
- Opcional: metadata dinámica por categoría (sin indexar color/talla).
- Favoritos: **fuera de scope** (siguiente fase).

---

**Confirmaciones finales**

- CSS splitting intacto  
- Hero intacto  
- Home editorial intacta  
- ProductCard Fase 6 intacto  
- Sin librerías nuevas  
- Fase Favoritos **no** iniciada  
