# FASE 4 — HOME EDITORIAL REPORT

## 1. Resumen visual

Se rediseñó el **cuerpo** de la Home con ritmo editorial (producto → historia → prueba social → inspiración → conversión), sin tocar Navbar/Hero/arquitectura Fase 3.

Cambios clave: Benefits más compactos; Novedades con peek horizontal y layouts para pocos productos; Tejidos asimétricos en desktop y una imagen por tarjeta en móvil; Historia/Inspiración con contenedor wide; Reviews adaptativas por cantidad; Discover responsive a 1–5 ítems.

## 2. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/styles/pages/home.css` | Ritmo, containers wide, Benefits→Newsletter |
| `frontend/src/app/(shop)/page.js` | `minHeight` de Suspense fallbacks |
| `frontend/src/components/home/HomeBenefits.jsx` | Clases por cantidad |
| `frontend/src/components/home/HomeNewArrivals.jsx` | Sección arrivals + intro compacta |
| `frontend/src/components/home/ProductCarousel.jsx` | `data-count` / clases 1–5 |
| `frontend/src/components/home/HomeCraftSection.jsx` | Wide + track `--nN`; galería desktop-only |
| `frontend/src/components/home/HomeStory.jsx` | Contenedor wide / proporciones |
| `frontend/src/components/home/DailyDiscoverGrid.jsx` | Grid `--nN` por cantidad |
| `frontend/src/components/home/HomePersonalization.jsx` | Wide + sección personalize |
| `frontend/src/components/home/HomeWholesale.jsx` | Wide + sección wholesale |
| `frontend/src/components/home/HomeReviews.jsx` | Layout `--n1`…`--n4` |
| `frontend/src/components/home/HomeInspiration.jsx` | Mosaico `--n1`…`--n5` + wide |

**No modificados (Fases 1–3 intactas):** Navbar, HomeHero, CMS models, Auth/Cart/Checkout, root CSS splitting.

## 3. Benefits

- Padding reducido; tipografía más densa.
- Desktop: fila 4 columnas (o auto-fit si hay menos de 4).
- Mobile: scroll horizontal con separadores, sin cards pesadas.
- Datos CMS sin cambios.

## 4. Novedades

- Mobile: card ~78vw + peek del siguiente (`scroll-snap`).
- Desktop: 3–4 visibles según viewport.
- Con 1–3 productos: track centrado, anchos acotados (sin hueco vacío).
- Controles ← → solo si hay overflow; focus visible en track.

## 5. Product presentation

- Ajustes **solo en contexto Home carousel** (borde/fondo transparentes, hover zoom imagen).
- `ProductCard` global no rediseñado; catálogo no depende de esas reglas.

## 6. Nuestros tejidos

- Desktop: grid `--n1`…`--n4` (3 = asimétrico featured + 2).
- Mobile: tarjetas grandes scroll-snap.
- **Una imagen principal en móvil**; galería multi-imagen solo ≥900px (sin scroll anidado).
- Lógica Fase 1 (`HomeCraftBlock` / matching) intacta.

## 7. Historia

- Contenedor `home-container--wide`.
- Desktop: foto ~4:5 + texto con `max-width` tipográfico.
- Mobile: imagen protagonista → copy.
- Copy/CTA/CMS sin cambios.

## 8. Descubre hoy

- Clases `home-discover__grid--n1`…`--n5`.
- Featured protagonista con 4–5; layouts centrados con 1–2.
- Mobile (≥3): scroll horizontal featured + resto.
- **Sin `priority`** en imágenes.

## 9. Personalización

- Wide container; servicio premium (copy + lista + CTA + foto).
- Mobile: content → CTA → foto (`order`).
- Funcionalidad / WhatsApp / rutas intactas.

## 10. Reseñas

- `n1`: testimonial centrado, tipografía grande (sección no gigante).
- `n2`: 2 columnas desktop.
- `n3`/`n4`: grid desktop; mobile scroll horizontal.
- Solo datos existentes (estrellas, texto, nombre, ciudad). Sin fotos inventadas.

## 11. Inspiración

- Mosaico dinámico 1–5 en desktop.
- Mobile: scroll horizontal de imágenes grandes (~78vw).
- CMS `homeImages.inspiracion` reutilizado; sin Shop the Look.

## 12. Por mayor

- Misma familia visual que personalización + `home-section--wholesale`.
- Imagen editorial + propuesta + bullets + CTA.
- Lógica de contacto intacta.

## 13. Newsletter

- Jerarquía/espaciado/input+CTA más cómodos; form horizontal ≥640px.
- Sin popups; `NewsletterSignup` sin cambios de lógica.

## 14. Responsive desktop

Pensado para 1024 / 1200 / 1440:

- Productos en `--container-max` (~1200).
- Story / craft / inspire / servicios en **wide ~1400**.
- Grids editoriales evitan colapso raro a 1024 (breakpoint craft/story 900px).

## 15. Responsive mobile

Pensado para 360 / 390 / 430:

- Carruseles con peek donde aplica.
- Sin grids de 3 productos diminutos en novedades.
- CTAs/newsletter con altura táctil razonable.
- Overflow horizontal intencional solo en tracks con `overscroll-behavior-x`.

## 16. Imágenes / CMS

- Reuso de `HomeImage` multi por sección; sin modelos nuevos.
- Tejidos: multi-imagen desktop; móvil 1 imagen.
- Inspiration/Story aprovechan arrays CMS existentes.
- Below-the-fold: sin `priority`; `sizes` revisados en craft/story/inspire.

## 17. Performance preservada

Confirmado expresamente:

- **Hero priority intacto** (`HomeHero` → `priority={index === 0}`).
- **DailyDiscover sin priority**.
- **Suspense intacto** (mismas boundaries en `page.js`).
- **CSS splitting intacto** (`home.css` importado solo desde Home).
- **No se añadió librería motion** (sin Framer / GSAP / Swiper).
- Server Components + `React.cache` + `next/dynamic` islands sin regresión a monolito.

## 18. Fallback heights ajustados

| Sección | Antes | Ahora |
|---------|-------|-------|
| Novedades | 420 | 460 |
| Tejidos | 480 | 520 |
| Historia | 360 | 440 |
| Descubre | 520 | 560 |
| Personalización | 400 | 460 |
| Reseñas | 320 | 280 |
| Inspiración | 420 | 480 |
| Por mayor | 400 | 460 |
| Newsletter | 280 | 260 |

## 19. Build

`npm run build` (frontend) → **PASS** (Next.js 16.2.6, compile OK).

## 20. Lint

ESLint sobre archivos modificados de Home → **PASS** (`--max-warnings 0`).

## 21. Pendientes

Para revisión visual humana antes de Fase 5+:

- [ ] Comparar 1440 / 1200 / 1024 / 768 / 430 / 390 / 360 (ritmo, peek, huecos).
- [ ] Validar con 1–2 novedades y 1 reseña en CMS real.
- [ ] Validar tejidos con 2 vs 3 vs 4+ y galería desktop.
- [ ] Confirmar Inspiration con 1 / 3 / 5 fotos.
- [ ] Catálogo: hover ProductCard global sin regresiones (home override aislado).

**STOP — no iniciar Fases 5–9** hasta feedback visual desktop + mobile.
