# Dizor — UI/UX Architecture Audit

> **Tipo de documento:** baseline técnico (solo lectura).  
> **Fecha de auditoría:** 2026-09-12  
> **Alcance:** Navbar / Header + Home / Landing + performance de carga.  
> **Restricción aplicada:** no se modificó código de producto, no se instalaron paquetes, no se refactorizó. Este archivo es el único artefacto generado.

---

## 1. Resumen ejecutivo

Dizor es un e-commerce de sombreros artesanales construido con **Next.js 16 (App Router) + React 19** y **CSS plano** (sin Tailwind, sin SCSS modules). El header público es un único componente cliente (`SiteHeader`) sticky; la Home es un **Server Component** monolítico en `frontend/src/app/(shop)/page.js` que orquesta ~10 secciones alimentadas por CMS + APIs de productos/reseñas.

Hallazgos clave para el rediseño futuro:

| Hallazgo | Implicación |
|---|---|
| **No existe funcionalidad de Favoritos** en el frontend | El icono ❤️ no está implementado; habría que diseñarlo desde cero |
| **El carrito ya es visible en móvil** junto a hamburguesa, búsqueda y cuenta | El objetivo de “carrito siempre visible” ya está cubierto |
| Hero full-bleed a `100vh − header`, con fade-in CSS | Base sólida; sin video, slider ni parallax |
| Contenido Home 100% CMS + APIs en SSR | Rediseñar textos/imágenes no requiere tocar admin si se respetan los mismos slots |
| CSS global de casi todas las páginas en `app/layout.js` | Riesgo de peso CSS en carga inicial |
| Sin Framer Motion / GSAP / Swiper | Interactividad = CSS + algo de JS nativo |
| Tipografía de marca (`TT Tsars C`) referenciada pero **no cargada** | Hoy cae a Georgia/system |

---

## 2. Stack frontend detectado

| Capa | Tecnología | Evidencia |
|---|---|---|
| Framework | Next.js **16.2.6** (App Router, Turbopack en `dev`) | `frontend/package.json` |
| UI | React **19.2.4** | idem |
| Estilos | CSS global por archivos (sin Tailwind, sin CSS Modules, sin SCSS) | `frontend/src/styles/**` importados en `app/layout.js` |
| HTTP cliente | `axios` (cliente) + `fetch` nativo (SSR) | `services/*`, páginas server |
| Iconos | Emojis/unicode en header; `react-icons` está en deps pero **sin usos** en código | `SiteHeader.jsx`, grep sin matches |
| Imágenes | `next/image` + Cloudinary/Unsplash remotos; formatos AVIF/WebP | `next.config.mjs` |
| Estado global | Context API (`Auth`, `Cart`, `SiteConfig`) — **sin Redux/Zustand** | `frontend/src/context/*` |
| Animaciones | CSS `@keyframes` / `transition` — **sin** Framer Motion, GSAP, Swiper, AOS, React Spring | `package.json` + grep |
| Analytics | GA4 condicional + Consent Mode | `AnalyticsTracker.jsx` |
| Pagos (fuera de Home) | Wompi (CSP) | `next.config.mjs` |

---

## 3. Arquitectura del Navbar

### Componente principal

- **`SiteHeader`** → `frontend/src/components/layout/SiteHeader.jsx` (`"use client"`)
- Montado en:
  - `frontend/src/app/(shop)/layout.js` (tienda)
  - `frontend/src/app/(auth)/layout.js` (login/registro/cuenta)

No existe un archivo llamado `Navbar.jsx`. El header **es** `SiteHeader`.

### Componentes secundarios

| Pieza | Archivo | Rol |
|---|---|---|
| `SiteLogo` | `frontend/src/components/layout/SiteLogo.jsx` | Logo imagen o fallback texto |
| `SiteAnnouncement` | `frontend/src/components/layout/SiteAnnouncement.jsx` | Barra de avisos **encima** del header (CMS) |
| Overlay búsqueda móvil | inline en `SiteHeader` | Formulario fullscreen bajo el header |
| Menú móvil | inline en `SiteHeader` | Drawer bajo el header (no lateral) |
| Backdrop | inline en `SiteHeader` | Cierra menú/búsqueda |

### Estilos

- `frontend/src/styles/layouts/public-header.css` — header, menú, búsqueda, WhatsApp float
- Tokens: `frontend/src/styles/base/variables.css` (`--header-height: 72px`, `--container-max: 1200px`, `--bp-md: 768px`)

### Hooks / estado local (dentro de `SiteHeader`)

| Estado | Propósito |
|---|---|
| `mobileOpen` | Menú hamburguesa |
| `mobileSearchOpen` | Overlay de búsqueda móvil |
| `scrolled` | `window.scrollY > 8` → clase `is-scrolled` |
| `search` (hook `useHeaderSearch`) | Input con debounce 300 ms hacia `/catalogo?term=` |

### Contextos / stores

| Contexto | Uso en header |
|---|---|
| `useAuth` (`AuthContext`) | `isAuthenticated`, `user` → link cuenta vs login |
| `useCart` (`CartContext`) | `itemCount`, `hydrated` → badge del carrito |
| `useSiteConfig` (vía `SiteLogo`) | `siteName`, `logoUrl` |

No hay store de favoritos. No hay store de categorías en el header.

### Rutas / navegación hardcodeadas

```text
NAV_LINKS (SiteHeader.jsx):
  /catalogo
  /catalogo?featured=true   → "Destacados"
  /catalogo?isNew=true      → "Novedades"
  /personalizar
  /pedido-mayor
```

Acciones:

- Cuenta: `/cuenta` o `/login`
- Carrito: `/carrito`
- Logo: `/`

### Autenticación

- Solo lectura de sesión vía `AuthContext` (carga `getMe` al montar la app).
- No hay dropdown de usuario; un icono 👤 lleva a cuenta o login.
- En menú móvil aparece el texto “Mi cuenta” / “Iniciar sesión”.

### Categorías

- **No hay menú de categorías/tejidos en el navbar.**
- Los tejidos se muestran en Home (sección Colección) y se filtran en catálogo vía query `weaveType`.

### Búsqueda

- Desktop: input visible en la barra.
- Móvil: botón ⌕ abre overlay.
- Debounce 300 ms; analytics `trackSearch` solo en submit.
- Navega a `/catalogo?term=…` (preserva otros params si ya está en catálogo).

### Iconografía

Unicode / emoji, no SVG de librería:

- ☰ menú
- ⌕ búsqueda
- 👤 cuenta
- 🛒 carrito

### Badges

- Único badge: `site-header__cart-badge` con `itemCount` (tras `hydrated`).

### Comportamiento dinámico

1. Sticky (`position: sticky; top: 0; z-index: 100`).
2. Al scroll: fondo translúcido + `backdrop-filter: blur(12px)` + sombra.
3. Active states en links según pathname + searchParams.
4. Cierre de menú/búsqueda al cambiar de ruta.
5. `document.body.style.overflow = hidden` con menú/búsqueda abiertos.
6. `Suspense` wrapper por `useSearchParams`.

---

## 4. Navbar Desktop

Breakpoint desktop efectivo: **`min-width: 768px`** (`public-header.css`).

### Distribución (izquierda → derecha)

```text
[ Logo ]  [ Nav: Catálogo · Destacados · Novedades · Personalizar · Por mayor ]
          [ Buscador max 320px ]                    [ 👤 ] [ 🛒±badge ]
```

- Hamburguesa: **oculto**
- Botón búsqueda móvil: **oculto**
- Menú móvil / overlay / backdrop: **forzados a no mostrarse**

### Layout / jerarquía

| Propiedad | Valor actual |
|---|---|
| Altura | `var(--header-height)` = **72px** |
| Ancho contenido | `max-width: 1200px` centrado |
| Padding horizontal | `var(--space-md)` |
| Gap interno | `var(--space-md)` |
| Logo imagen | altura **60px**, max-width 200px |
| Nav | `font-size: 0.9rem`, gap `var(--space-lg)` |
| Acciones | icon buttons 40×40, borde 1px |
| Alineación | flex, `align-items: center`, `justify-content: space-between`; actions con `margin-left: auto` |

### Scroll / sticky

- Sticky desde el inicio.
- Clase `is-scrolled` tras 8px: blur + sombra blanca semitransparente.

### Dropdowns / hover / animaciones

- **Sin dropdowns** de categorías ni cuenta.
- Hover en links: color primary.
- Active: underline 2px + font-weight 600.
- Transiciones cortas (0.15–0.25s) en color, borde, background.

### Densidad informativa

Media-alta en desktop: 5 links + búsqueda + 2 iconos. No hay favoritos ni selector de idioma/moneda.

---

## 5. Navbar Mobile / Responsive

Breakpoint móvil: **`max-width: 767px`**.

### Layout móvil

```text
[ ☰ ]  [ Logo ]                    [ ⌕ ] [ 👤 ] [ 🛒 ]
         ↓ (si open)
    [ Menú vertical: nav links + cuenta ]
         ↓ (si search open)
    [ Overlay búsqueda bajo el header ]
```

### Qué desaparece / se transforma

| Elemento | Comportamiento &lt;768px |
|---|---|
| Nav horizontal | Oculto → pasa al menú hamburguesa |
| Buscador inline | Oculto → botón ⌕ + overlay |
| Hamburguesa | Visible (izquierda) |
| Logo | Centro-izquierda (tras ☰); img 40px / max 150px |
| Cuenta 👤 | **Permanece visible** en barra |
| Carrito 🛒 | **Permanece visible** en barra |
| Favoritos | N/A (no existe) |
| Categorías | N/A (no están en nav) |

### Menú hamburguesa

- No es drawer lateral: panel **absolute** bajo el header, full width, scroll interno.
- Backdrop fixed rgba(0,0,0,0.5).
- Incluye los 5 `NAV_LINKS` + enlace de cuenta.

### Tablet (768–1023)

- A partir de 768px se usa layout desktop (nav + search visibles).
- No hay breakpoint intermedio específico del header (solo 768).

---

## 6. Favoritos y Carrito

### ❤️ Favoritos

**Estado actual: no implementados.**

Evidencia: búsqueda en todo `frontend/` por `favorit`, `wishlist`, `heart`, etc. → **0 resultados**.

| Pregunta | Respuesta |
|---|---|
| ¿Hay icono en navbar? | No |
| ¿Hay página `/favoritos`? | No |
| ¿Hay contexto/store? | No |
| ¿Hay API de favoritos en frontend? | No detectada en servicios usados por shop |

**Para añadirlos en el futuro (estimación de dificultad: media):**

Archivos que probablemente habría que tocar:

1. `SiteHeader.jsx` + `public-header.css` (icono visible desktop/móvil)
2. Nuevo contexto o extensión de Auth (si requieren login)
3. Nueva ruta app + servicios API backend (si aún no existe endpoint)
4. Posiblemente `ProductCard` / ficha producto (toggle)
5. Analytics events

**Riesgos:** acoplamiento con auth; hidratación SSR/cliente; densidad del header móvil (ya hay ☰ + ⌕ + 👤 + 🛒).

### 🛒 Carrito

**Ya visible en móvil y desktop** en `site-header__actions`.

| Aspecto | Detalle |
|---|---|
| Implementación | `Link` a `/carrito` + badge `itemCount` |
| Estado | `CartContext` (`localStorage` `dizor_cart_v1`, sync servidor si autenticado) |
| Badge | Solo si `hydrated && itemCount > 0` |
| Archivos | `SiteHeader.jsx`, `CartContext.jsx`, `cartService.js`, estilos header |

**Dificultad de “mantenerlo visible”:** baja — **ya lo está**. Un rediseño solo debe preservar el slot en la barra de acciones.

**Dependencias / riesgos al rediseñar el header:**

- No romper `hydrated` (evitar flash del badge).
- No ocultar el badge en CSS móvil.
- `CartProvider` envuelve toda la app desde root layout → cualquier cambio de estructura de providers afecta carrito global.

---

## 7. Arquitectura de Home

### Ruta y componente padre

| Pieza | Ruta real |
|---|---|
| URL | `/` |
| Page | `frontend/src/app/(shop)/page.js` → `HomePage` (async Server Component) |
| Layout padre shop | `frontend/src/app/(shop)/layout.js` |
| Root | `frontend/src/app/layout.js` (providers + CSS global + metadata) |

### Árbol de montaje real

```text
RootLayout (providers Auth/Cart/SiteConfig, Analytics)
└── ShopLayout
    ├── PromoPopup
    ├── SiteAnnouncement
    ├── SiteHeader
    ├── <main>
    │   └── HomePage  ← secciones 1–10
    ├── SiteFooter
    ├── WhatsAppFloatingButton
    ├── CookieConsentBanner
    └── CookiePreferencesPanel
```

### Fuentes de datos (SSR, `Promise.all`)

| Fuente | Endpoint / API | Uso |
|---|---|---|
| CMS home | `GET /content/home` (`getHomeContent`) | Textos + flags de secciones + `homeImages` |
| Productos del día | `GET /products/daily-random?limit=5` | “Descubre hoy” |
| Novedades | `GET /products?isNew=true&limit=12` | Carrusel novedades |
| Reseñas | `GET /reviews?limit=4` | Voces |
| Filtros | `GET /products/filters` | Tipos de tejido (fallback colecciones) |
| Apariencia | `GET /content/appearance` (`fetchAppearance`, cached) | `siteName`, colores |

Además, **fuera de la page pero en el layout**:

- `SiteAnnouncement` vuelve a llamar `getHomeContent()` (sin `React.cache` compartido en `cmsService` → posible doble fetch).
- `SiteFooter`: páginas CMS, appearance, visit count.
- `PromoPopup` (cliente): `getMarketingConfig()` tras montar.

---

## 8. Mapa de secciones de Home

Orden real en el DOM (después del layout chrome):

```text
Home (/)
├── [Layout] PromoPopup
├── [Layout] SiteAnnouncement
├── [Layout] SiteHeader
├── 1. Hero (inline en page.js)
├── 2. Beneficios / features (condicional)
├── 3. Novedades + ProductCarousel (condicional)
├── 4. Colecciones / tejidos
├── 5. Historia
├── 6. Descubre hoy + DailyDiscoverGrid (condicional)
├── 7. Personalización
├── 8. Voces / reseñas (condicional)
├── 9. Inspiración mosaico (condicional si hay imágenes)
├── 10. Pedido al por mayor
├── 11. Newsletter + NewsletterSignup
├── [Layout] SiteFooter
├── [Layout] WhatsAppFloatingButton
└── [Layout] Cookie consent UI
```

### Detalle por bloque

#### 1. Hero

| Campo | Valor |
|---|---|
| Componente | Inline en `HomePage` (no hay `Hero.jsx`) |
| Archivo | `frontend/src/app/(shop)/page.js` |
| Estilos | `.home-hero*` en `home.css` |
| Datos | `home.hero`, `homeImages.hero[0]` |
| CTA | Primary → catálogo; secondary opcional |
| Media | `next/image` fill + `priority` |
| Animación | `.home-anim` fade/rise escalonado |

#### 2. Beneficios

| Campo | Valor |
|---|---|
| Condición | `features.length > 0` (hasta 4) |
| Datos | `home.features` (icon/title/text) |
| Responsive | Grid 2 cols → 4 en ≥1024; móvil scroll horizontal snap |

#### 3. Novedades

| Campo | Valor |
|---|---|
| Componente cliente | `ProductCarousel` → `ProductCard` |
| Datos | productos `isNew` + textos `home.newSection` |
| Interacción | scroll horizontal + flechas si overflow |
| Analytics | `ViewItemListTracker` |

#### 4. Colecciones / tejidos

| Campo | Valor |
|---|---|
| Datos | weaveTypes (daily o filters) + `homeImages.coleccion` |
| UI | 3 cards editoriales; 1 featured en desktop |
| Hover | scale 1.06 en imagen |

#### 5. Historia

| Campo | Valor |
|---|---|
| Datos | `home.historia` + imagen |
| UI | banda negra primary; grid texto/imagen ≥900px |

#### 6. Descubre hoy

| Campo | Valor |
|---|---|
| Componente | `DailyDiscoverGrid.jsx` |
| Datos | daily-random (máx 5) |
| UI | 1 featured + grid; blur placeholder; `priority` en featured |

#### 7. Personalización

| Campo | Valor |
|---|---|
| Datos | `home.personalizacion` |
| CTA | link + hint WhatsApp |
| Layout | reutiliza clases `.home-personalize*` |

#### 8. Voces

| Campo | Valor |
|---|---|
| Datos | `/reviews?limit=4` + `home.reseñasSection` |
| UI | grid 1→2→4 columnas |

#### 9. Inspiración

| Campo | Valor |
|---|---|
| Condición | solo si hay `homeImages.inspiracion` |
| UI | mosaico hasta 5 celdas; links Instagram opcionales |

#### 10. Por mayor

| Campo | Valor |
|---|---|
| Reutiliza | mismo layout que Personalización |
| Datos | `home.porMayor` + `homeImages.pormayor` |

#### 11. Newsletter

| Campo | Valor |
|---|---|
| Componente | `NewsletterSignup` (cliente) |
| API | `subscribeNewsletter` vía `marketingService` |
| Source | `"home"` |

---

## 9. Hero / Primer impacto

### Control

No hay componente dedicado. El Hero vive **inline** en `HomePage` (`page.js` líneas del bloque `{/* 1. HERO full-bleed */}`).

### Dimensiones

| Viewport | Altura |
|---|---|
| Desktop / Mobile | `min-height: calc(100vh - var(--header-height))` → ~viewport completo bajo el header (72px) |
| Padding inner | 4rem / 5rem en ≥1024 |

No hay altura distinta explícita para móvil; el mismo `min-height` aplica. El título usa `clamp` más agresivo bajo 768px.

### Contenido visual

| Elemento | ¿Existe? | Detalle |
|---|---|---|
| Imagen de fondo | Sí (si CMS tiene URL) | `next/image` fill, `object-fit: cover`, `priority`, `sizes="100vw"` |
| Fallback sin imagen | Sí | Gradiente primary → primary-soft |
| Overlay | Sí | Gradiente horizontal negro 62%→20% |
| Video background | **No** | — |
| Slider / carousel | **No** | Una sola imagen |
| Autoplay | **No** | — |
| Parallax | **No** | — |
| Zoom continuo | **No** | — |

### Textos (CMS con fallbacks)

1. Brand claim (serif, tracking amplio) — default siteName / “DIZOR”
2. H1 title
3. Subtitle
4. CTA primary + secondary opcional

### Movimiento actual

- Entrada: `homeFadeRise` (opacity 0→1, translateY 18px→0), delays 0.1 / 0.28 / 0.46 / 0.64 s
- Respeta `prefers-reduced-motion: reduce` (animación desactivada)
- **Sin** scroll effects, microinteracciones de hover en el hero, ni transición entre slides

### Carga de imagen

- `priority` → eager / LCP candidate
- Formato servido vía optimizador Next (AVIF/WebP si el origen lo permite)
- Sin `fetchPriority` explícito adicional (Next lo gestiona con `priority`)
- Sin blur placeholder en el Hero (sí en product grids)

---

## 10. Responsive Home

Breakpoints relevantes en `home.css` / variables:

| Token / media | Uso típico |
|---|---|
| 640px | padding container, grids 2 cols |
| **768px** | colecciones editoriales, discover grid, inspire mosaic, header desktop |
| 900px | story / personalize 2 columnas |
| 1024px | padding container 3rem, benefits 4 cols, section padding |

### Lectura por anchos solicitados (por implementación, no test visual automatizado)

| Ancho | Comportamiento esperado |
|---|---|
| **1440px** | Contenedor 1200px centrado; hero full-bleed; grids desktop completos |
| **1024px** | Layout desktop; benefits 4 cols; tipografía clamp alta |
| **768px** | Límite header desktop; colecciones featured; discover 3-col; inspire mosaic |
| **430 / 390 / 360** | Header móvil; benefits carousel; colecciones 3 cols estrechas (nombres ellipsis); carousel productos ~44vw; secciones padding 2.5rem; hero título clamp |

### Riesgos responsive observados en código

- Colecciones en móvil: 3 columnas muy estrechas (nombres ~0.78rem + ellipsis) → densidad alta.
- Benefits en móvil: scroll horizontal (descubrimiento no obvio sin affordance).
- Carrusel novedades: sin flechas en móvil (solo swipe).

---

## 11. Interactividad y animaciones actuales

### Inventario Navbar + Home

| COMPONENTE | ARCHIVO | INTERACCIÓN | TECNOLOGÍA |
|---|---|---|---|
| SiteHeader | `SiteHeader.jsx` + `public-header.css` | Sticky + blur al scroll | JS scroll listener + CSS |
| SiteHeader | idem | Menú móvil open/close + backdrop | React state + CSS |
| SiteHeader | idem | Overlay búsqueda móvil | React state |
| SiteHeader | idem | Hover / active links y botones | CSS transition |
| SiteHeader | idem | Debounce búsqueda | `setTimeout` 300 ms |
| SiteAnnouncement | `site-announcement.css` | Fade rotatorio (solo móvil, multi-item) | CSS keyframes |
| Hero | `home.css` | Fade-rise entrada textos/CTAs | CSS `@keyframes homeFadeRise` |
| Collection cards | `home.css` | Hover scale imagen 1.06 | CSS transition |
| Discover cards | `home.css` + `DailyDiscoverGrid.jsx` | Hover scale 1.06 | CSS |
| Inspire cells | `home.css` | Hover scale 1.04 + sombra | CSS |
| ProductCard | `product-card.css` | Hover lift + sombra | CSS |
| ProductCarousel | `ProductCarousel.jsx` | Scroll horizontal + botones | JS `scrollBy` + ResizeObserver |
| Benefits (móvil) | `home.css` | Scroll-snap horizontal | CSS |
| NewsletterSignup | `NewsletterSignup.jsx` | Submit async + feedback | React state |
| PromoPopup | `PromoPopup.jsx` | Modal diferido (delay CMS) | React + sessionStorage |
| WhatsApp float | `public-header.css` | Hover scale 1.1 | CSS |
| Cookie banner | consent components | Panel preferencias | React |

### Librerías de animación / sliders

**Ninguna** de: Framer Motion, GSAP, Swiper, React Spring, AOS.

Todo es **CSS animations/transitions** + JS DOM nativo puntual.

---

## 12. Tipografía y sistema visual

### Familias declaradas (`variables.css`)

| Token | Stack | Estado real |
|---|---|---|
| `--font-serif` | `"TT Tsars C", "Playfair Display", Georgia, Times, serif` | **TT Tsars no se carga** (sin `@font-face` / `next/font`). Playfair tampoco vía Google Fonts. Efectivo: **Georgia/system serif** |
| `--font-sans` | Verdana, Segoe UI, system-ui | Usado en eyebrows / botones home |
| Body global | `Arial, sans-serif` (`globals.css`) | Body real del documento |

### Jerarquía Home

| Rol | Estilo |
|---|---|
| Brand hero | serif, clamp ~1.5–2.25rem, tracking 0.22em, uppercase |
| H1 hero | serif, clamp ~2–3.25rem (móvil ~1.75–2.25) |
| Section H2 | serif, clamp ~1.75–3rem (móvil ~1.4–1.6) |
| Eyebrow | sans, 0.7rem, tracking 0.28em, accent-text |
| Lead / body | ~0.875–0.95rem, muted, line-height 1.75 |
| Botones | sans, 0.875rem, weight 500, radio-radius 0 |

### Color (marca)

Negro `#1A1A1A`, Arena `#F5C37B`, Oro `#B87305`, Blanco, Gris `#E6E6E6` — documentados en `variables.css`. Appearance CMS puede sobreescribir primary/accent/bg en runtime.

### Espaciado

- Secciones: 4–4.5rem desktop / 2.5rem móvil
- Container max: **1200px**
- Densidad: editorial (mucho whitespace entre secciones; hero ocupa casi un viewport)

---

## 13. Performance relevante para el rediseño

Ver sección completa **Performance & Loading Strategy** al final. Resumen:

- CSS de admin/checkout/producto importado globalmente en root → peso CSS inicial alto.
- Home monta **todas** las secciones en el HTML SSR (sin lazy de componentes below-the-fold).
- Hasta ~6 fetches SSR en Home + announcement + footer + marketing popup.
- Hero con `priority` (bien para LCP); grids below-the-fold también se solicitan en SSR.
- `react-icons` en package.json sin uso (peso de deps, no necesariamente de bundle si tree-shake / unused).
- Imagen guía de tallas en `public` (~858 KB) no es de Home, pero indica poco control de peso en assets estáticos.
- Logo/favicon por defecto referenciados pero **ausentes** en `public/images/` (dependen de CMS o fallback texto).

Métricas LCP/CLS/INP/FCP/TTFB: **Requieren medición posterior** (no medidas en esta auditoría).

---

## 14. Componentes reutilizables

| Elemento | Clasificación | Nota |
|---|---|---|
| `SiteLogo` + SiteConfig | ✅ conservar | Fallback imagen→texto sólido |
| `CartContext` / badge carrito | ✅ conservar | Contrato estable |
| `AuthContext` link cuenta | ✅ conservar | |
| Tokens `variables.css` (color/espacio) | ✅ conservar | Base de marca |
| `ProductCard` | 🟡 mejorar | Base catálogo/home; visual puede modernizarse |
| `ProductCarousel` | 🟡 mejorar | Funcional; UI de controles básica |
| `DailyDiscoverGrid` | 🟡 mejorar | Buen layout editorial |
| `NewsletterSignup` | 🟡 mejorar | OK funcional |
| `SiteHeader` estructura/acciones | 🟡 mejorar | Lógica reutilizable; UI candidata a rediseño |
| `SiteAnnouncement` | 🟡 mejorar | Útil; visual simple |
| Hero inline en `page.js` | 🔴 rediseño | Extraer componente + enriquecer motion/media |
| Secciones Home monolíticas en `page.js` | 🔴 rediseño | Conviene modularizar por sección |
| Iconografía emoji del header | 🔴 rediseño | Poco premium; migrar a SVG |
| Tipografía efectiva (sin TT Tsars) | 🔴 rediseño | Cargar fuentes de marca |
| CSS global all-pages en root | 🔴 rediseño (arquitectura) | Code-split CSS por ruta |

---

## 15. Dependencias y riesgos

### Navbar — coupling

| Área | Coupling |
|---|---|
| Autenticación | `AuthContext` + rutas `/login` `/cuenta` |
| Carrito | `CartContext` badge; no debe deshidratarse mal |
| Búsqueda | Router + query `term` + analytics `trackSearch` |
| Rutas nav | Hardcode `NAV_LINKS` — cambiar labels/hrefs afecta SEO interno y active states |
| Apariencia | Logo/nombre vía `SiteConfigProvider` ← appearance API |
| Announcement | Comparte CMS home; altura extra empuja el sticky header |

### Home — coupling

| Área | Coupling |
|---|---|
| CMS textos | Admin `HomeTextsTab` / `PATCH /admin/content/home` |
| CMS imágenes | Admin `HomeImagesTab` + secciones hero/historia/… |
| Productos | APIs public products; flags `isNew`, daily-random |
| Categorías/tejidos | `products/filters` + matching por `weaveType` en URLs de imágenes |
| Analytics | `ViewItemListTracker`, GA consent |
| Marketing | Newsletter + PromoPopup (layout) |
| WhatsApp | `getWhatsAppUrl` en personalización y float |

**Riesgo principal de rediseño:** romper el contrato de campos CMS (`hero`, `features`, `newSection`, `craftSection`, `historia`, `personalizacion`, `porMayor`, `inspiracion`, `reseñasSection`, `randomProductsSection`, `newsletterSection`, `announcement`) o los `section` ids de imágenes (`hero`, `historia`, `personalizacion`, `pormayor`, `coleccion`, `inspiracion`).

---

## 16. Mapa de archivos

### NAVBAR / CHROME

```text
frontend/src/components/layout/SiteHeader.jsx
frontend/src/components/layout/SiteLogo.jsx
frontend/src/components/layout/SiteAnnouncement.jsx
frontend/src/components/layout/SiteFooter.jsx
frontend/src/components/layout/WhatsAppFloatingButton.jsx
frontend/src/components/layout/TrackedWhatsAppLink.jsx
frontend/src/components/layout/VisitCounter.jsx
frontend/src/components/layout/CookieSettingsLink.jsx
frontend/src/styles/layouts/public-header.css
frontend/src/styles/layouts/public-footer.css
frontend/src/styles/layouts/site-announcement.css
frontend/src/context/AuthContext.jsx
frontend/src/context/CartContext.jsx
frontend/src/context/SiteConfigContext.jsx
frontend/src/lib/fetchAppearance.js
frontend/src/lib/analytics/events.js          (trackSearch, etc.)
frontend/src/app/(shop)/layout.js
frontend/src/app/(auth)/layout.js
```

### HOME

```text
frontend/src/app/(shop)/page.js                 ← HomePage
frontend/src/styles/pages/home.css
frontend/src/components/home/ProductCarousel.jsx
frontend/src/components/home/DailyDiscoverGrid.jsx
frontend/src/components/products/ProductCard.jsx
frontend/src/styles/components/product-card.css
frontend/src/components/marketing/NewsletterSignup.jsx
frontend/src/components/marketing/PromoPopup.jsx
frontend/src/components/analytics/ViewItemListTracker.jsx
frontend/src/services/cmsService.js
frontend/src/services/marketingService.js
frontend/src/lib/whatsapp.js
frontend/src/lib/imagePlaceholder.js
frontend/src/lib/formatCurrency.js
```

### CMS / ADMIN (acoplados, no UI pública)

```text
frontend/src/components/admin/HomeTextsTab.jsx
frontend/src/components/admin/HomeImagesTab.jsx
frontend/src/services/adminCmsService.js
frontend/src/services/adminHomeImageService.js
frontend/src/app/admin/contenido/page.js
frontend/src/app/admin/home-imagenes/page.js
```

### SISTEMA VISUAL / ROOT

```text
frontend/src/app/layout.js
frontend/src/styles/base/variables.css
frontend/src/styles/base/globals.css
frontend/next.config.mjs
frontend/package.json
```

### CONSENT / ANALYTICS (carga Home)

```text
frontend/src/components/analytics/AnalyticsTracker.jsx
frontend/src/components/consent/CookieConsentBanner.jsx
frontend/src/components/consent/CookiePreferencesPanel.jsx
frontend/src/styles/components/cookie-consent.css
frontend/src/styles/components/marketing.css
```

---

## 17. Problemas encontrados

### Navbar

- P0 — Tipografía/iconografía poco premium (emojis; sin icon set coherente).
- P1 — Sin favoritos (si el negocio los requiere, gap funcional).
- P1 — Sin menú de categorías/tejidos en nav (descubrimiento depende de Home/catálogo).
- P1 — Sin dropdown de cuenta (logout/pedidos no accesibles desde header).
- P2 — Logo default `/images/logo-dizor-horizontal.png` ausente en `public` (fallback texto).
- P2 — `react-icons` instalado y no usado.

### Hero / primer impacto

- P1 — Sin motion más allá del fade inicial; percepción estática tras ~1s.
- P1 — Una sola imagen fija; sin storytelling dinámico.
- P2 — Hero no extraído a componente (mantenibilidad).
- P2 — Sin blur placeholder mientras carga la imagen LCP.

### Home

- P1 — Página monolítica (~650+ líneas) dificulta iterar UI por sección.
- P1 — Posible doble fetch `getHomeContent` (page + announcement).
- P2 — Beneficios móvil sin indicador de scroll.
- P2 — Colecciones móvil muy comprimidas (3 columnas).

### Mobile

- P1 — Barra de acciones ya densa (4 controles); sumar ❤️ requiere rediseño de densidad.
- P2 — Menú hamburguesa no es drawer lateral (patrón OK, pero menos “app-like”).

### Performance / arquitectura

- P0 — Import global de CSS de admin/checkout/etc. en root layout.
- P1 — Sin lazy de secciones below-the-fold.
- P1 — Fuente de marca no cargada.
- P2 — Asset `guia-tallas.png` ~858 KB (síntoma de peso de imágenes).

---

## 18. Oportunidades de mejora

### Navbar

**Problemas:** iconografía, densidad móvil futura, falta de categorías/favoritos, cuenta plana.

**Oportunidades:**

- Sustituir emojis por SVG de marca.
- Preservar carrito (+ badge) siempre visible; planificar slot favoritos.
- Evaluar mega-menu o panel de tejidos.
- Dropdown cuenta autenticada.
- Refinar estado scrolled (altura compacta).

**Responsive / UX / visual:** alinear con un header más editorial (menos bordes en icon buttons, más respiración, mejor jerarquía logo).

### Hero / primer impacto

**Problemas:** estático tras animación inicial; dependencia total de una imagen CMS.

**Oportunidades:**

- Extraer `HomeHero`.
- Motion de entrada más rico (sin bloquear LCP).
- Posible video corto / ken burns sutil / slideshow controlado.
- Reforzar propuesta de valor y CTAs.
- Placeholder / LQIP para imagen.

### Home

**Problemas:** monolito; secciones condicionadas por CMS pueden dejar “saltos” si faltan datos.

**Oportunidades:**

- Modularizar secciones.
- Lazy mount below-the-fold.
- Mejorar affordances de carousels.
- Revisar orden editorial vs conversión.

### Mobile

**Problemas:** densidad de iconos; grids apretados.

**Oportunidades:**

- Rediseñar actions bar (prioridad: ☰ · logo · ❤️ · 🛒; búsqueda en menú o expandible).
- Colecciones: 1 columna o carousel en vez de 3 cols.
- Indicators en benefits strip.

---

## 19. Priorización P0 / P1 / P2

### P0 — crítico antes o al inicio del rediseño

1. Definir si Favoritos es requisito de producto (hoy no existe).
2. Planificar carga tipográfica de marca (TT Tsars u alternativa licenciada).
3. Separar CSS por rutas (no cargar admin CSS en Home).
4. Preservar contrato CMS al rediseñar.

### P1 — importante en la primera oleada UI

1. Rediseño visual Navbar (iconos, spacing, scrolled).
2. Extraer y enriquecer Hero.
3. Modularizar secciones Home.
4. Lazy loading de secciones / imágenes below-the-fold.
5. Decuplicar `getHomeContent`.
6. Slot favoritos + carrito visibles en móvil (carrito ya OK).
7. Medición real LCP/CLS/INP.

### P2 — refinamiento

1. Affordances carousels/benefits.
2. Dropdown cuenta.
3. Menú categorías.
4. LQIP hero.
5. Limpiar `react-icons` o empezar a usarlo.
6. Assets públicos faltantes (logo/favicon default).

---

## 20. Recomendaciones para la siguiente fase

1. **No implementar aún** — validar este baseline con stakeholders (¿favoritos? ¿video hero? ¿mega-menu?).
2. Fase siguiente sugerida: **diseño + wireframes** Navbar móvil (acciones visibles) y Hero above-the-fold, sin tocar CMS schema.
3. Luego: **extracción de componentes** (`HomeHero`, `HomeBenefits`, …) sin cambio visual.
4. Después: **rediseño visual incremental** sección por sección.
5. En paralelo: **performance** (CSS splitting, lazy sections, fonts, medición Lighthouse/Web Vitals).
6. Mantener `CartContext` badge y rutas `NAV_LINKS` estables o versionar redirects.

---

# Performance & Loading Strategy

## Estado actual

La Home es un **Server Component** que resuelve datos en el servidor y envía HTML completo de casi todas las secciones. El cliente hidrata: header, carousels/grids cliente, newsletter, promo popup, analytics, consent, WhatsApp.

**No hay** estrategia de “cargar sección al acercarse al viewport” para componentes de Home.  
**Sí hay** optimización de imágenes vía `next/image` (lazy por defecto salvo `priority`) y formatos AVIF/WebP.

## Recursos cargados inicialmente

### Al entrar a `/` (primera visita)

| Recurso | Qué incluye |
|---|---|
| JS framework + layout | Next runtime, providers Auth/Cart/SiteConfig, `SiteHeader`, consent, analytics bootstrap |
| CSS | **Casi todos** los CSS de la app (home, producto, admin, checkout, carrito, …) vía `app/layout.js` |
| HTML Home | Hero + todas las secciones con datos SSR (aunque below-the-fold) |
| Imágenes | Hero `priority`; featured daily `priority`; resto `next/image` lazy nativo |
| Fuentes | Solo system/Arial/Georgia — **sin descarga de web fonts** |
| Iconos | Emojis (sin sprite); WhatsApp SVG inline |
| Videos | Ninguno |
| APIs SSR | appearance, home CMS, daily-random, products isNew, reviews, filters (+ announcement/footer) |
| APIs cliente post-mount | `getMe` (auth), marketing config (popup), GA si hay consentimiento |

### Contenido below-the-fold que hoy se descarga/renderiza desde el inicio

- HTML + datos de novedades, colecciones, historia, discover, personalización, reseñas, inspiración, por mayor, newsletter.
- Imágenes de esas secciones entran en el documento; el browser puede diferir fetch por lazy de `next/image`, pero el **JS/CSS/HTML** de esas secciones ya viaja en la respuesta inicial.

## Lazy loading existente

### Imágenes

| Mecanismo | ¿Usado en Home? |
|---|---|
| `next/image` lazy default | Sí (colecciones, historia, personalización, inspire, product cards sin priority) |
| `priority` / eager | Hero; featured de `DailyDiscoverGrid` |
| `loading="lazy"` en `<img>` | No en Home (sí en admin/otros) |
| `placeholder="blur"` + shimmer | ProductCard, DailyDiscoverGrid — **no** en Hero |
| `srcset` / `sizes` | Sí vía Next (`sizes` explícitos en varios bloques) |
| Intersection Observer manual | No (salvo ResizeObserver en carousel) |
| Preload / fetchpriority manual | No explícito |

**Candidatos a eager (above-the-fold):** logo header, Hero, (opcional) primer benefit si entra en viewport.  
**Candidatos a lazy estricto:** inspire mosaic, por mayor, newsletter side assets, productos del carousel no visibles, colecciones no visibles.

### Componentes / scroll

- **No** hay Intersection Observer para montar secciones.
- **No** hay `React.lazy` / `next/dynamic` en Home.
- Toda la Home se monta en el árbol desde el primer paint SSR.

## Code splitting

| Técnica | Estado |
|---|---|
| Route-based (App Router) | **Sí** — cada `page.js` es un segmento; catálogo/checkout/admin no se navegan hasta visitarlos |
| `React.lazy` / `Suspense` de secciones | **No** en Home (Suspense solo en header por `useSearchParams`) |
| `next/dynamic` | **No** detectado en Home |
| CSS por ruta | **No** — CSS global en root |

Al entrar a Home, el **bundle de rutas no visitadas no debería incluir** el JS de páginas admin/checkout (App Router). Sí incluye:

- Layout shop compartido (header/footer/marketing/consent).
- Client components importados por Home (`ProductCarousel`, `DailyDiscoverGrid`, `ProductCard`, `NewsletterSignup`, trackers).
- Providers globales (Auth, Cart).

## Routes — ¿Home arrastra otras áreas?

| Área | ¿En bundle inicial de Home? |
|---|---|
| Catálogo page | No (ruta aparte); sí hay **links** y búsqueda que navegan ahí |
| Detalle producto | No como page; sí `ProductCard` compartido |
| Favoritos | No existe |
| Carrito page | No; sí `CartContext` + link header |
| Checkout | No |
| Login/registro | No como page; sí auth provider + link |
| Admin | No como page; **sí CSS admin** en root (problema) |

## Imágenes (Home)

| Aspecto | Hallazgo |
|---|---|
| Origen | Principalmente Cloudinary (`res.cloudinary.com`) vía CMS |
| Formatos entrega | Next negocia AVIF/WebP |
| Responsive | `fill` + `sizes` en hero/grids; ProductCard width/height 400×500 |
| Pesos originales | **No medidos aquí** (dependen de CMS/Cloudinary en runtime) — Requiere medición posterior |
| Riesgo | Imágenes CMS sin límite de peso en frontend; Hero full-bleed es el LCP candidate |

Asset local pesado (fuera de Home pero síntoma): `frontend/public/images/guia-tallas.png` ≈ **858 KB**.

## Above the fold vs below the fold

### Above the fold (prioridad percibida)

1. Announcement (si activo)
2. SiteHeader (logo, actions)
3. Hero (imagen + copy + CTAs)
4. Posiblemente inicio de Beneficios en pantallas altas

### Below the fold

Novedades → Colecciones → Historia → Discover → Personalización → Voces → Inspiración → Por mayor → Newsletter → Footer.

**Hoy:** recursos below-the-fold **compiten** en HTML/CSS/JS inicial y en el waterfall de datos SSR (`Promise.all` espera todas las APIs antes de enviar la page).

## Peticiones API (entrada a Home)

| Endpoint | Quién | Cuándo | Bloqueante SSR | Visible-dependent | Caché / dedupe |
|---|---|---|---|---|---|
| `/content/appearance` | Root layout + Home + Footer | SSR | Sí | No | `React.cache` en `fetchAppearance` + revalidate 30 |
| `/content/home` | HomePage | SSR | Sí | No | revalidate 60; **sin** `cache()` wrapper |
| `/content/home` | SiteAnnouncement | SSR | Sí | No | mismo fetch — **posible duplicado** |
| `/products/daily-random?limit=5` | HomePage | SSR | Sí | No | revalidate 60 |
| `/products?isNew=true&limit=12` | HomePage | SSR | Sí | No | revalidate 60 |
| `/reviews?limit=4` | HomePage | SSR | Sí | No | revalidate 60 |
| `/products/filters` | HomePage | SSR | Sí | No | revalidate 300 |
| `/content/pages` | Footer | SSR | Sí (footer) | No | revalidate 120 |
| visit count | Footer | SSR | Sí (footer) | No | servicio visits |
| `/auth/me` (vía axios) | AuthProvider | Cliente mount | No | No | por sesión |
| marketing config | PromoPopup | Cliente mount | No | No | session flag popup |
| newsletter POST | Solo al submit | On demand | No | — | — |
| GA4 gtag | AnalyticsTracker | Tras consentimiento | No | No | script `afterInteractive` |

No hay deduplicación explícita de favoritos/carrito API en Home (carrito es localStorage).

## Renderizado React

| Riesgo | Detalle |
|---|---|
| Contextos amplios | `AuthProvider` + `CartProvider` envuelven toda la app → rerenders de consumidores al login/cart |
| SiteHeader | Escucha scroll (setState) → rerender header en cada cruce de umbral (mitigado: boolean scrolled) |
| Home Server | Sin estado; listas `.map` de hasta 12 productos + 5 daily + 4 reviews + 5 inspire — tamaño moderado |
| Client islands | Carousel ResizeObserver; grids estáticos tras hydrate |
| Props innecesarias | No se detectó anti-patrón grave; ProductCard recibe productos completos (variants para swatches) |

## Dependencias externas (carga)

| Tercero | ¿Carga inicial? |
|---|---|
| GA4 (googletagmanager) | Solo si ID configurado **y** consentimiento |
| Cloudinary imágenes | Sí, según CMS |
| Wompi | No en Home (CSP preparada) |
| Google Fonts | **No** |
| Chat widgets | No (solo WhatsApp link) |
| Framer/GSAP/Swiper | No |
| `react-icons` | Dep instalada; sin imports |

## Fuentes

| Pregunta | Respuesta |
|---|---|
| Familias cargadas vía red | **0 web fonts** |
| Pesos | N/A |
| `font-display` | N/A |
| Preload fonts | No |
| Bloqueo de render por fonts | No (system fonts) — pero **no hay tipografía de marca real** |

## Métricas Web

| Métrica | Estado |
|---|---|
| LCP | Requiere medición posterior (candidato: imagen Hero) |
| CLS | Requiere medición posterior (header sticky, announcement, promo popup, badge carrito post-hydrate) |
| INP | Requiere medición posterior |
| FCP | Requiere medición posterior |
| TTFB | Requiere medición posterior (depende de `Promise.all` SSR + API) |

## Skeletons y percepción de velocidad

| Mecanismo | ¿Dónde? |
|---|---|
| `loading.js` skeleton grid | `app/(shop)/loading.js` — navegaciones shop, no necesariamente first paint Home document |
| Blur shimmer | ProductCard / DailyDiscoverGrid |
| Skeleton producto | `producto/[slug]/loading.js` |
| Hero skeleton | **No** |
| Optimistic UI Home | **No** |

Oportunidad: skeleton/LQIP del Hero y placeholders de secciones while streaming (si se adopta streaming/Suspense por sección).

## Clasificación conceptual P0 / P1 / P2 (carga futura)

### P0 — cargar inmediatamente

- CSS crítico de layout + home above-the-fold (idealmente no admin CSS)
- JS mínimo layout + header
- Appearance (logo/nombre/colores)
- CMS hero + announcement
- Imagen Hero (`priority`)
- Auth hydrate ligero / cart hydrate local

### P1 — inmediatamente después

- Beneficios (si entran en primer scroll)
- Primeros productos novedades (o defer si lejos)
- Cart badge sync
- Consent banner

### P2 — bajo demanda (scroll / interacción)

- Discover, historia, personalización, voces, inspiración, por mayor, newsletter
- PromoPopup (ya diferido por timer — OK)
- GA4 (ya diferido por consent — OK)
- Imágenes mosaico / secciones medias

## Riesgos si se añade más motion

1. Bundle JS si se introduce Framer/GSAP sin code-split.
2. Main-thread jank en móvil con scroll animations en muchas secciones.
3. LCP degradado si el Hero pierde `priority` o se anima la imagen LCP.
4. CLS si announcement/popup/fonts llegan tarde.
5. Más imágenes/video sin lazy → contención de red con LCP.

## Oportunidades (solo diagnóstico)

1. Envolver `getHomeContent` en `React.cache`.
2. Importar CSS por layout/ruta.
3. `dynamic()` / Suspense por sección below-the-fold.
4. Cargar fuentes de marca con `next/font` + `display: swap`.
5. Medir pesos reales Cloudinary y fijar transforms.
6. Mantener carrito visible; diseñar favoritos sin saturar P0 JS.

## Archivos a tocar eventualmente (cuando se implemente, no ahora)

```text
frontend/src/app/layout.js                      # CSS splitting
frontend/src/app/(shop)/layout.js
frontend/src/app/(shop)/page.js                 # modularizar + Suspense
frontend/src/services/cmsService.js             # cache()
frontend/src/styles/pages/home.css
frontend/src/components/layout/SiteHeader.jsx
frontend/src/styles/layouts/public-header.css
frontend/src/components/home/*                  # nuevos / dynamic
frontend/next.config.mjs                        # si se ajustan images
```

---

*Fin del baseline. Próximo paso acordado: diseño/planificación controlada — sin implementación en esta fase.*
