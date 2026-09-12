# FASE 10 — MOTION REPORT

## 1. Motion existente antes

| Elemento | Estado | Decisión |
|----------|--------|----------|
| Hero copy `homeFadeRise` (18px / 0.75s) | Existente | **AJUSTAR** (10px + tokens) |
| Hero crossfade 1.4s | Existente | **CONSERVAR** (token) |
| Hero Ken Burns 8s → 1.1 | Existente | **AJUSTAR** (scale máx 1.08 + tokens) |
| Hero reduced-motion | Existente | **CONSERVAR** |
| Navbar sticky/blur/altura | Existente | **AJUSTAR** (tokens) |
| Dropdown “Más” | Instantáneo (`hidden`) | **AJUSTAR** (opacity + 4px) |
| Mobile menu open | Instantáneo | **AJUSTAR** (fade breve) |
| ProductCard 2ª imagen + scale 1.02 | Existente | **AJUSTAR** (1.015 + tokens) |
| Discover/inspire/craft hover 1.03–1.04 | Existente | **AJUSTAR** (más sutil) |
| Favorito | Solo color | **NUEVO** (pop 1.08) |
| Story / editorial | Estático | **NUEVO** (reveal selectivo) |
| Catálogo grid reveals | N/A | **NO** (evitar) |
| Framer/GSAP/AOS | Ausente | **NO instalar** |

## 2. Filosofía aplicada

Motion sutil que refuerza fotografía y jerarquía.  
Si se nota primero la animación → es demasiado.

CSS-first. Sin librerías. Sin fade-up universal. Sin parallax. Sin bounce.

Máximo 2 familias de reveal: **editorial** y **photo**, solo en Story + Editorial Breaks.

## 3. Motion tokens

```css
--motion-fast: 160ms;
--motion-normal: 280ms;
--motion-slow: 480ms;
--motion-image: 700ms;
--motion-hero-crossfade: 1.4s;
--motion-hero-ken: 8s;

--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-standard: cubic-bezier(0.25, 0.1, 0.25, 1);
--ease-image: cubic-bezier(0.33, 0.05, 0.2, 1);
```

## 4. Archivos modificados

- `frontend/src/styles/base/variables.css`
- `frontend/src/styles/base/motion.css` *(nuevo)*
- `frontend/src/app/layout.js` (import motion.css)
- `frontend/src/components/motion/MotionReveal.jsx` *(nuevo)*
- `frontend/src/components/home/HomeStory.jsx`
- `frontend/src/components/home/HomeEditorialBreak.jsx`
- `frontend/src/components/layout/SiteHeader.jsx`
- `frontend/src/styles/layouts/public-header.css`
- `frontend/src/styles/pages/home.css`
- `frontend/src/styles/components/product-card.css`
- `frontend/src/styles/components/catalog-filters.css`
- `frontend/src/styles/pages/producto.css`
- `DIZOR-FASE10-MOTION-REPORT.md`

## 5. Navbar

- Transiciones de scroll/blur/logo con tokens.
- Dropdown “Más”: opacity + `translateY(-4px→0)`, sin `hidden` (usa `is-open` + `aria-hidden`).
- Active underline sutil (scaleX).
- Mobile menu: fade/slide 6px al abrir.
- Reduced-motion: sin transitions/animations.

## 6. Hero

- Sin nuevos efectos.
- Copy entrance: 10px, delays más cortos, `--ease-out`.
- Crossfade/Ken Burns vía tokens; Ken Burns tope **1.08** (antes 1.1).
- LCP: sin opacity:0 en imagen principal (igual que antes).

## 7. ProductCard

- Hover scale **1.015** (desktop fine pointer only).
- Crossfade 2ª imagen con `--motion-image`.
- Sin elevar card / sombra exagerada.

## 8. Home reveals

Solo:

- Story (texto editorial + foto)
- Editorial breaks (photo)

**NO** en Benefits, Novedades, Discover grid, Newsletter, Craft, Wholesale, Reviews.

## 9. Story

- Media: `motion-reveal--photo`
- Copy: `motion-reveal--editorial`
- Server Component intacto; wrapper client mínimo.

## 10. Editorial breaks

- Frame completo: reveal photo (scale 1.015→1).
- Sin texto/overlay añadido.

## 11. Inspiration

- Solo refinamiento hover scale 1.015 + tokens.
- Sin reveal al scroll.

## 12. Catalog

- Sin reveals en grid al filtrar.
- Drawer/panel filtros: entrada breve opacity + 6px.
- Chips: transition color/border rápida.

## 13. PDP

- Thumbs: border transition.
- Add to cart: hover + `:active` 1px (sin confetti / fly-to-cart).
- Feedback textual existente conservado.

## 14. Buttons / links

- Hero CTAs con tokens.
- Links `.home-text-link`: underline animado (background-size), no en todo el sitio.

## 15. Favorites

- `favorite-pop` scale 1→1.08→1 (~160ms).
- `:active` scale 0.96.
- Reduced-motion: sin animación.

## 16. Mobile

- Menos motion que desktop.
- Menú hamburguesa: entrada breve.
- Product hover no aplica sin fine pointer.
- Scroll-snap existente intacto.

## 17. Reduced Motion

Cobertura:

- `motion.css` reveals + favorite + text-link
- Hero / home hovers
- Navbar / dropdown / mobile nav
- ProductCard
- PDP skeleton estático + add-btn

Contenido visible de inmediato (sin esperar animación).

## 18. Accessibility

- Dropdown: `aria-expanded` / `aria-hidden`.
- Focus outlines intactos.
- Sin bloquear input ni reordenar DOM.
- Teclado usable con reduced-motion.

## 19. Performance

- Sin librerías nuevas.
- Solo `transform` / `opacity` en reveals.
- Un `IntersectionObserver` por wrapper; se desconecta al primer intersect.
- Sin scroll listeners globales.
- Hero LCP no retrasado.
- Lazy images intactas.

## 20. JS añadido

| Archivo | Rol |
|---------|-----|
| `MotionReveal.jsx` | Client island mínimo (IO + clase) |

Sin Framer / GSAP / AOS / Swiper.

## 21. Build

`npm run build` — **PASS** (Next.js 16.2.6 / Turbopack).

## 22. Lint

`npx eslint` sobre `MotionReveal.jsx`, `HomeStory.jsx`, `HomeEditorialBreak.jsx`, `SiteHeader.jsx`, `layout.js` — sin warnings nuevos.

## 23. Riesgos

1. Reveal con `opacity:0` inicial en Story/Editorial (below-fold) — si IO falla, reduced-motion fuerza visible; en JS off raro el contenido queda invisible → aceptable con JS on (Next).
2. Dropdown sin `hidden`: tabs podrían llegar si visibility falla — mitigado con `pointer-events` + `aria-hidden`.
3. Underline animado en links Home puede verse distinto en story (fondo oscuro) — verificado con `currentColor`.

## 24. Pendientes

- Revisión visual humana Home / Catálogo / PDP.
- QA formal (Fase 11) **no iniciada**.

---

### Tabla motion

| COMPONENT | TRIGGER | ANIMATION | DURATION | EASING |
|-----------|---------|-----------|----------|--------|
| Hero copy | mount | opacity + Y 10px | ~480ms + delays | ease-out |
| Hero slide | timer | opacity crossfade | 1.4s | ease-image |
| Hero Ken Burns | active slide | scale 1.04→1.08 | 8s | ease-image |
| Navbar scroll | scroll class | bg/blur/logo height | 280ms | standard |
| Nav underline | hover/active | scaleX | 160ms | ease-out |
| Dropdown Más | open | opacity + Y -4→0 | 160ms | ease-out |
| Mobile nav | open | opacity + Y -6 | 280ms | ease-out |
| ProductCard img | hover desktop | opacity / scale 1.015 | 700ms | ease-image |
| Favorite | toggle on | scale pop 1.08 | 160ms | ease-out |
| Story copy | IO | opacity + Y 8 | 480ms | ease-out |
| Story / editorial photo | IO | opacity + scale 1.015→1 | 700ms | ease-image |
| Filters panel | open | opacity + Y -6 | 280ms | ease-out |
| Chips | hover | border/color | 160ms | standard |
| PDP thumb | active | border-color | 160ms | standard |
| Add to cart | active | translateY 1px | 160ms | ease-out |
| Text links Home | hover | underline grow | 280ms | ease-out |
| Discover/inspire | hover | scale ≤1.02 | 700ms | ease-image |

### Confirmaciones

- Sin librerías de motion.
- Sin fade-up universal.
- Arquitectura SSR Home / CSS splitting / tipografía Fase 9 / categorías / favoritos lógica: intactas a nivel funcional.
- Fase 11 QA **no** iniciada.
