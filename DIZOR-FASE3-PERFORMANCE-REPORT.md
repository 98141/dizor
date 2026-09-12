# FASE 3 — PERFORMANCE REPORT

> Fecha: 2026-09-12  
> Alcance: arquitectura de carga Home + CSS splitting. **Sin rediseño visual.**  
> Fases 1 y 2: preservadas (Navbar, tejidos, HomeHero multi-imagen/LCP).

---

## 1. Resumen

Se modularizó la Home en Server Components con **Suspense/streaming** por sección below-the-fold, se deduplicó `getHomeContent` y fetches de catálogo con `React.cache()`, se **particionó el CSS** fuera del root layout, se retiró `priority` de Daily Discover, y se diferenció el JS de islands (`ProductCarousel`, `DailyDiscoverGrid`, `NewsletterSignup`) vía `next/dynamic` con SSR.

La apariencia visual no se rediseñó: mismos bloques, textos CMS, clases CSS y composición.

## 2. Arquitectura Home antes

```
page.js (monolito async)
  Promise.all([cms, daily, isNew, reviews, filters, appearance])  ← bloquea TODO
  → HomeHero (client)
  → Benefits inline
  → NewArrivals + ProductCarousel (client)
  → HomeCraftSection
  → Story / Discover / Personalize / Reviews / Inspire / Wholesale / Newsletter inline
Shop layout: Header + Announcement + Footer + Promo + Consent (todo en paralelo)
Root layout: TODO el CSS del proyecto
```

## 3. Arquitectura Home después

```
page.js (orquestador fino)
  await [getHomeContent(cache), appearance]     ← P0
  → HomeHero + HomeBenefits
  → Suspense → HomeNewArrivals (fetch isNew)
  → Suspense → HomeCraftBlock (daily + filters cache)
  → Suspense → HomeStory / Personalization / Inspiration / Wholesale / Newsletter (cms cache)
  → Suspense → HomeDiscover (daily cache)
  → Suspense → HomeReviews (reviews)
Shop layout: Footer en Suspense; CSS shop-only
Root: solo variables + globals + not-found
```

## 4. Componentes extraídos

| Componente | Tipo |
|---|---|
| `HomeBenefits` | Server |
| `HomeNewArrivals` | Server + dynamic `ProductCarousel` |
| `HomeCraftBlock` | Server → `HomeCraftSection` |
| `HomeStory` | Server |
| `HomeDiscover` | Server + dynamic `DailyDiscoverGrid` |
| `HomePersonalization` | Server |
| `HomeReviews` | Server |
| `HomeInspiration` | Server |
| `HomeWholesale` | Server |
| `HomeNewsletter` | Server + dynamic `NewsletterSignup` |
| `HomeSectionFallback` | Server (reserva altura) |
| `HomeHero` | Client (Fase 2, intacto) |

## 5. Server Components

Casi toda la Home markup: benefits, story, craft shell, personalization, reviews, inspiration, wholesale, newsletter shell, page orchestrator.

## 6. Client Components (hidratación)

| Componente | ¿Inmediato? |
|---|---|
| SiteHeader / SiteHeaderServer data | Sí (chrome) |
| HomeHero | Sí (P0) |
| PromoPopup / Consent / Analytics | Layout / consent-gated |
| ProductCarousel | Below-fold, chunk dynamic |
| DailyDiscoverGrid | Below-fold, chunk dynamic |
| NewsletterSignup | Below-fold, chunk dynamic |
| ViewItemListTracker | Con secciones de productos |
| AuthProvider / CartProvider | Root (sin cambios agresivos) |

## 7. Suspense/streaming implementado

| Sección | Motivo | Fallback | Efecto esperado |
|---|---|---|---|
| NewArrivals | Fetch `/products?isNew` independiente | `minHeight: 420` | Hero no espera novedades |
| CraftBlock | daily-random + filters | 480 | Stream tejidos |
| Story | Aísla CMS (ya cacheado → rápido) | 360 | Consistencia boundaries |
| Discover | daily-random | 520 | No compite con LCP |
| Personalization | CMS cache | 400 | — |
| Reviews | `/reviews` | 320 | Reviews no bloquean P0 |
| Inspiration | CMS + imágenes | 420 | — |
| Wholesale | CMS | 400 | — |
| Newsletter | CMS + client form | 280 | — |
| SiteFooter (shop/auth) | pages + visits | footer vacío 220px | HTML principal no espera footer |

**No** se usó IntersectionObserver (SSR/SEO preservados).

## 8. Fetches antes/después

| RECURSO | ANTES | DESPUÉS | CACHE | REVALIDATE |
|---|---|---|---|---|
| `/content/appearance` | root + home | igual | `cache()` | 30 |
| `/content/home` | page + announcement (posible doble) | mismos consumidores | **`cache()` nuevo** | 60 |
| `/products/filters` | page fetchJson + header `fetchCatalogFilters` | solo `fetchCatalogFilters` (craft + header) | `cache()` | 300 |
| `/products/daily-random` | Promise.all home | Craft + Discover | **`cache()`** | 60 |
| `/products?isNew` | Promise.all home | NewArrivals only | **`cache()`** | 60 |
| `/reviews` | Promise.all home | Reviews only | **`cache()`** | 60 |
| `/content/pages` + visits | Footer sync | Footer Suspense | pages `cache()` | 120 |
| marketing config | PromoPopup client | igual | — | client |
| auth `/me` | AuthProvider | igual | — | client |

## 9. Duplicaciones eliminadas

1. **`getHomeContent`**: envuelto en `React.cache()` → Announcement + Home + secciones = 1 fetch/request.
2. **`/products/filters`**: Home ya no usa `fetchJson` paralelo; reutiliza `fetchCatalogFilters`.
3. **`daily-random`**: Craft + Discover comparten `fetchDailyRandom` cacheado.

## 10. CSS antes/después

### Salieron de `app/layout.js`

Admin, checkout, carrito, producto, home, auth-card/form, cuenta, marketing, cookie, header/footer, announcement, product-card, catalog-filters, special-requests, todos los admin-*.

### Dónde quedaron

| Destino | CSS |
|---|---|
| `app/layout.js` | `variables`, `globals`, `not-found` |
| `app/(shop)/layout.js` | header, footer, announcement, product-card, catalog-filters, marketing, cookie, special-requests, auth-form |
| `app/(auth)/layout.js` | header, footer, auth-card, auth-form, cuenta, cookie |
| `app/(shop)/page.js` | `home.css` |
| `app/(shop)/producto/layout.js` | `producto.css` (**nuevo layout**) |
| `app/(shop)/carrito/layout.js` | carrito + marketing |
| `app/(shop)/checkout/layout.js` | checkout |
| `app/admin/layout.js` | admin-* + auth-form/card + special-requests |
| `app/vendedor/layout.js` | admin-layout + admin-orders + auth-form |

## 11. JS / dynamic imports

- `ProductCarousel` ← `HomeNewArrivals`
- `DailyDiscoverGrid` ← `HomeDiscover`
- `NewsletterSignup` ← `HomeNewsletter`

Todos con `ssr: true` (HTML SEO intacto; chunk cliente diferible).

## 12. Estrategia de imágenes

- Hero slide 0: `priority` (Fase 2).
- Hero secundarias: diferidas (Fase 2).
- Below-fold: lazy default `next/image`.
- **DailyDiscover featured: se quitó `priority`** (below-fold; no compite con LCP).

## 13. Hero / LCP

**Fase 2 intacta:** `HomeHero.jsx` sin cambios de comportamiento; multi-imagen, crossfade, LCP priority, reduced-motion.

## 14. Prevención de CLS

- Fallbacks con `minHeight` por sección.
- Footer placeholder `minHeight: 220`.
- Sin skeletons brillantes.
- Sin IO que monte/desmonte bloques grandes.

## 15. Responsive

Sin cambios de breakpoints visuales. Validar manualmente 1440→360 que los fallbacks no produzcan saltos notables (reservas de altura aproximadas).

## 16. Rutas verificadas (smoke HTTP local)

Tras cambios: `/`, `/catalogo`, `/carrito`, `/login`, `/admin`, `/admin/productos/nuevo` — comprobar en entorno del usuario tras HMR/restart.

Build incluye todos los segmentos de ruta.

## 17. Build

`npm run build` → **OK** (exit 0), Next 16.2.6 Turbopack.

## 18. Lint

Archivos nuevos de Home / page / cmsService / homeFetches → **sin errores nuevos**.  
Warnings/errores preexistentes en admin (p. ej. HomeImagesTab `setState` in effect) no introducidos por esta fase.

## 19. Métricas

**REQUIERE MEDICIÓN EN PRODUCCIÓN** (Lighthouse mobile/desktop: LCP, CLS, INP, FCP, TTFB, CSS/JS transferidos). No se inventaron valores.

## 20. Riesgos encontrados

1. Fallbacks de altura son aproximados → posible micro-CLS si la sección real es mucho más alta/baja.
2. CSS de `content-page` vive en `site-announcement.css` (histórico) → sigue cargando en shop (aceptable).
3. `auth-form.css` también en shop (formularios personalizar/mayor) → peso menor en Home.
4. Turbopack a veces cachea mal rutas anidadas (incidente previo) → restart `.next/dev` si 404.

## 21. Pendientes

- Medición Web Vitals real pre/post.
- Tipografía TT Tsars (archivo licencia ausente).
- Refinar alturas de fallback con datos de layout reales.
- Evaluar si `auth-form` puede limitarse a layouts de formularios.
- Fase 4 visual (no iniciada).

## 22. Archivos modificados / creados

**Creados:**  
`HomeBenefits`, `HomeNewArrivals`, `HomeCraftBlock`, `HomeStory`, `HomeDiscover`, `HomePersonalization`, `HomeReviews`, `HomeInspiration`, `HomeWholesale`, `HomeNewsletter`, `HomeSectionFallback`, `lib/homeFetches.js`, `app/(shop)/producto/layout.js`

**Modificados:**  
`app/(shop)/page.js`, `app/layout.js`, `app/(shop)/layout.js`, `app/(auth)/layout.js`, `app/admin/layout.js`, `app/vendedor/layout.js`, `app/(shop)/carrito/layout.js`, `app/(shop)/checkout/layout.js`, `services/cmsService.js`, `DailyDiscoverGrid.jsx`, `styles/pages/home.css`

**Sin tocar visualmente:** ProductCard, Hero behavior, Navbar Fase 1, checkout logic, favoritos.
