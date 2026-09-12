# DIZOR — PREPRODUCTION CLOSURE

**Fecha:** 2026-09-12  
**Sprint:** Cierre técnico post-QA (sin rediseño / sin features)

---

## 1. Estado inicial

Referencia: **READY WITH MINOR ISSUES** (`DIZOR-FINAL-QA-REPORT.md`).

Corrección editorial previa: `DIZOR-IMAGE-COMPOSITION-REFINEMENT.md` + ajustes posteriores (fondo blanco, sin borde/marco).

---

## 2. Cambios aplicados (este sprint)

| Ítem | Acción |
|------|--------|
| Pluralización catálogo + aria carrito/favoritos | **FIXED** |
| Logo / favicon / OG | Revisado; sin inventar assets |
| Imágenes editoriales | Validadas (estado actual) |
| Hard 404 PDP | Investigado → **POST-LAUNCH** |
| Lint legacy repo | No tocado |
| Config producción | Documentada |
| Safari/iOS | Checklist humana |

---

## 3. Pluralización

| Ubicación | Antes | Después |
|-----------|-------|---------|
| `CatalogoContent.jsx` subtítulo genérico | `· ${total} productos` | `· ${total} producto(s)` con `total === 1` |
| Categoría / búsqueda | Ya pluralizaban | Intactos |
| `SiteHeader` aria carrito | siempre `productos` | `producto` / `productos` |
| `SiteHeader` aria favoritos | siempre `guardados` | `guardado` / `guardados` |

---

## 4. Logo / favicon / OG

| Asset | Comportamiento actual | Producción |
|-------|----------------------|------------|
| **Logo** | CMS `appearance.logoUrl`; si vacío/falla → texto **Dizor** (`SiteLogo.jsx`). No hay request a `/images/logo-dizor-horizontal.png`. | Configurar logo en Admin → Apariencia / Contenido |
| **Favicon** | CMS `faviconUrl` o fallback **`/icon-512.png`** (existe en `public/`) | Subir favicon definitivo en CMS o dejar icon-512 |
| **OG** | Home/catálogo/PDP usan metadata + `/icon-512.png` o imagen de producto | Ideal: imagen OG dedicada en CMS cuando exista |

**No se inventaron ni descargaron assets.**

---

## 5. Corrección imágenes editoriales

Estado al cierre (Home CSS):

- Story / Personalización / Wholesale / Inspiration: `object-fit: contain`, fondos **blancos** (`--color-bg`), **sin borde/marco**
- Ratios y alturas moderadas (sin min-height agresivos 4:5)
- Decoración CSS sutil solo en Personalización / Wholesale (`::before`/`::after`)
- Editorial breaks: cover suavizado (pausa fotográfica)

Productos: **no tocados** en este sprint.

---

## 6. Inspiration

- Mosaico protagonista + 4 conservado
- `contain` + fondo página blanco
- Sin matte arena, sin border
- Letterbox inevitable si el ratio CMS ≠ frame → **recomendación de assets** (ver §17)

---

## 7. Product freeze confirmation

**Confirmado:** `ProductCard.jsx` y `product-card.css` **sin cambios** en este sprint (`git status` limpio sobre esos paths).

Novedades / Catálogo / relacionados: no se modificó su CSS de producto.

---

## 8. Soft 404 PDP

**POST-LAUNCH BACKLOG**

| Hallazgo | Detalle |
|----------|---------|
| UI | Not-found + `noindex` |
| HTTP | **200** (smoke 2026-09-12) |
| Causa | `(shop)/loading.js` inicia streaming → status no puede pasar a 404 |
| Fix simple | Retirar `loading.js` del shop (afecta UX de carga de todo el segmento) |
| Decisión | **NO implementar** (rompe/altera streaming Fase 3) |

Mitigación actual (`noindex`) **aceptable para cierre**.

---

## 9. Configuración de producción

Variables que el código consume (sin secretos):

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SITE_URL` | metadataBase, robots, sitemap, JSON-LD |
| `NEXT_PUBLIC_API_URL` | Fetch SSR/CSR API |
| `NEXT_PUBLIC_WOMPI_ENV` | sandbox / production |
| `VITE_PUBLIC_KEY` / claves Wompi | Checkout (ver `.env.example`) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 (solo con consentimiento) |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | Solo dev |
| Backend `CLIENT_URL` | CORS (`origin`) — **debe coincidir con el dominio del front** |

Imágenes: `next.config.mjs` → `res.cloudinary.com`, `images.unsplash.com`.

---

## 10. Safari/iOS checklist

**REQUIERE DISPOSITIVO REAL** (no verificado en este sprint).

- [ ] Navbar sticky + `backdrop-filter`
- [ ] Menú mobile open/close + Escape + body lock
- [ ] Inputs ≥16px (sin zoom iOS) — search / sort / newsletter / auth
- [ ] Home `svh` / scroll-snap benefits & craft
- [ ] Inspiration scroll horizontal
- [ ] Editorial breaks crop
- [ ] Catálogo drawer + grid 2 col
- [ ] PDP galería / cantidad / favorito / add to cart
- [ ] Cookie banner

---

## 11. Regression Home

Validación acotada post-imágenes (código + smoke local):

| Breakpoint | Esperado |
|------------|----------|
| 1440–1024 | Story/Personalize/Inspire/Wholesale sin marco arena; Hero intacto |
| 768 | Layout apilado servicios; inspire scroll |
| 430–360 | Sin overflow horizontal; contain + fondo blanco |

Revisión visual humana recomendada en esos anchos antes de staging.

---

## 12. Route smoke

Entorno: `localhost:3000` (dev), 2026-09-12

| Route | Status |
|-------|--------|
| `/` | 200 |
| `/catalogo` | 200 |
| `/producto/producto-prueba` | 200 |
| `/producto/slug-inexistente-closure` | 200* (soft 404) |
| `/favoritos` | 200 |
| `/carrito` | 200 |
| `/login` | 200 |
| `/checkout` | 200 |
| `/admin` | 200 |
| `/ruta-no-existe-closure` | **404** |

\*UI not-found + noindex.

---

## 13. Performance preserved

Confirmado por alcance del sprint:

- [x] Hero priority intacto (no tocado)
- [x] Lazy below-fold intacto
- [x] Suspense Home intacto
- [x] CSS splitting intacto
- [x] ProductCard intacto
- [x] Sin nuevas librerías
- [x] Sin priority en imágenes editoriales

---

## 14. Build

`npm run build` — **PASS** (Next.js 16.2.6)

---

## 15. Lint

| Ámbito | Resultado |
|--------|-----------|
| **SPRINT FILES** (`CatalogoContent.jsx`, `SiteHeader.jsx`) | PASS (`--max-warnings 0`) |
| **LEGACY REPO** (`npm run lint` global) | Sigue con errores/warnings legacy (no limpiados) |

---

## 16. Antes de go-live

1. `NEXT_PUBLIC_SITE_URL` = dominio HTTPS real  
2. Backend `CLIENT_URL` = mismo origen del front (CORS)  
3. Logo + favicon en CMS Apariencia  
4. Wompi keys + `NEXT_PUBLIC_WOMPI_ENV=production` cuando toque  
5. GA4 ID + probar consentimiento  
6. Checklist Safari/iOS en dispositivo real  
7. Lighthouse / CWV en **staging**, no localhost  

---

## 17. Post-launch backlog

- Hard 404 HTTP en PDP (proxy o retirar `loading.js` shop con cuidado)
- Lint legacy (AuthContext / CartContext / hooks)
- TT Tsars C cuando exista licencia/archivo
- Landings SEO por categoría + sitemap
- Optimización Catálogo/PDP mobile con métricas reales
- Focal point CMS para fotos editoriales
- Subir fotos Inspiration en ratio unificado (4:5 / 3:4) para eliminar letterbox

**OPCIONAL**

- OG image dedicada  
- Renombrar BEM `tejidos*` residual en header  

---

## 18. Final recommendation

# READY FOR STAGING

**Justificación**

- Build PASS  
- Sin P0  
- Pluralización corregida  
- Assets con fallback robusto  
- Imágenes editoriales en estado acordado (contain, blanco, sin marco)  
- ProductCard congelado  
- Rutas críticas OK  
- Soft 404 mitigado con noindex  

**No READY FOR PRODUCTION** todavía: faltan confirmación de variables/CORS prod, assets de marca en CMS, Safari real y Lighthouse en staging.

---

**STOP.** Sin nuevas fases automáticas. Esperar revisión humana.
