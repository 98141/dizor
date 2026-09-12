# DIZOR — FINAL QA REPORT

**Fase 11 — QA final, accesibilidad, SEO, performance y cierre**  
**Fecha:** 2026-09-12  
**Estado final:** **READY WITH MINOR ISSUES**

---

## 1. Executive summary

El rediseño (Fases 1–10) está **funcionalmente estable** en rutas críticas, con build de producción OK, SEO técnico básico válido (metadata, canonicals, sitemap, robots, JSON-LD) y Lighthouse local razonable en Home desktop.

Se corrigieron bugs reales hallados en QA (soft-404 SEO, assets 404, a11y, Escape mobile, inputs iOS, empty state favoritos). Quedan limitaciones conocidas no bloqueantes: HTTP 200 soft-404 en PDP inexistente por streaming/`loading.js` del segmento shop (mitigado con `noindex`), lint legacy del repo, y performance mobile de Catálogo/PDP por debajo del Home en entorno local.

No se introdujeron features ni rediseño.

---

## 2. Environment tested

| Campo | Valor |
|-------|--------|
| OS | Windows 10 |
| Frontend | Next.js **16.2.6** / React **19.2.4** |
| Medición | `next build` + `next start` puerto **3001** |
| API | `localhost:5000` (CORS origin configurado a `:3000`) |
| Smoke paralelo | `next dev` puerto **3000** |
| Lighthouse | CLI 13.4.1 + Chrome headless |
| Fecha medición LH | 2026-09-12 |
| Throttling | Presets Lighthouse desktop / mobile (simulado) |
| Nota | **Localhost ≠ producción** (CPU, red, CDN, Cloudinary, CORS) |

---

## 3. Routes tested

### Públicas / críticas

| ROUTE | STATUS | CONSOLE | VISUAL | RESULT |
|-------|--------|---------|--------|--------|
| `/` | 200 | Ver §27 | OK | PASS |
| `/catalogo` | 200 | OK | OK (1 producto en data local) | PASS |
| `/producto/producto-prueba` | 200 | OK | OK | PASS |
| `/producto/slug-inexistente…` | **200*** UI 404 | noindex | Not-found UI | PASS* (soft 404) |
| `/favoritos` | 200 | OK | Empty state | PASS |
| `/carrito` | 200 | OK | Empty state | PASS |
| `/checkout` | 200 | OK | Render | PASS (sin pago real) |
| `/login` | 200 | OK | OK | PASS |
| `/register` | 200 | OK | OK | PASS |
| `/cuenta` | 200 | OK | OK | PASS |
| `/personalizar` | 200 | OK | OK | PASS |
| `/pedido-mayor` | 200 | OK | OK | PASS |
| `/guia-de-tallas` | 200 | OK | OK | PASS |
| `/politica-de-cookies` | 200 | OK | OK | PASS |
| `/politica-de-privacidad` | 200 | OK | OK | PASS |
| `/seguimiento` | 200 | OK | OK | PASS |
| `/robots.txt` | 200 | — | — | PASS |
| `/sitemap.xml` | 200 | — | 10 URLs (data local) | PASS |
| `/ruta-inexistente…` | **404** | — | Not-found | PASS |

\*Soft 404: ver §33 / §35.

### Admin (smoke)

| ROUTE | STATUS | RESULT |
|-------|--------|--------|
| `/admin` | 200 | PASS (auth gate UI) |
| `/admin/productos` | 200 | PASS |
| `/admin/catalogo` | 200 | PASS (categorías; no hay `/admin/categorias`) |
| `/admin/contenido` | 200 | PASS |
| `/admin/home-imagenes` | 200 | PASS |

---

## 4. Responsive matrix

Validado vía browser automation + CSS audit en anchos típicos (énfasis 390–1440).

| Breakpoint | Navbar | Home | Catálogo | PDP | Notas |
|------------|--------|------|----------|-----|-------|
| 1440 / 1280 | Desktop nav | OK | Sidebar filtros | — | OK |
| 1200 / 1024 | Transición | OK | OK | — | OK |
| 900 / 768 | Hamburger | Scroll-snap sections | Drawer filters | — | OK |
| 430 / 390 / 375 / 360 | Compact header | OK | Cards 2-col | — | Sin overflow horizontal evidente |

**Atención:** header mobile muestra logo texto si no hay `logoUrl` CMS (tras fix).

---

## 5. Navbar

- Categorías dinámicas + “Más” + static Novedades / Personaliza / Por mayor: OK.
- Tejidos **no** en navbar (decisión Fase 7/post): OK.
- Favoritos / carrito badges: OK.
- Body lock mobile: OK.
- **Fix QA:** Escape cierra menú mobile + búsqueda + “Más”.
- Active underline / scroll sticky: OK (Fase 10).

---

## 6. Home

- Hero + benefits + novedades + tejidos + story + discover + personalización + reviews + inspiration + wholesale + newsletter + footer: render OK con data local.
- Empty CMS sections: no se observaron huecos rotos en dataset actual.
- Motion Fase 10 + reduced-motion: conservado.
- **Fix QA:** benefits `h3`→`h2` (orden de headings).

---

## 7. Catalog

- Sin filtros / sort / chips / limpiar: OK.
- Canonical fijo `/catalogo` (no indexa cada combo de query como URL canónica distinta).
- **Sin `noindex` por query** — estrategia: canonical + no listar filtros en sitemap.
- Drawer mobile / filtros desktop: OK.
- Contador productos: OK (“1 productos” con data escasa — copy plural genérico, P3).

---

## 8. PDP

- Producto real: galería / precio / CTA / favorito: OK en smoke.
- Recomendaciones: presentes cuando API las envía.
- **Fix QA:** `notFound()` también en `generateMetadata`; eliminado `producto/[slug]/loading.js` para reducir soft-404; `not-found` metadata `noindex,nofollow`.
- Soft 404 HTTP 200 puede persistir por `(shop)/loading.js` (streaming).

---

## 9. Favorites

- Empty state + CTA catálogo: OK.
- **Fix QA:** texto vacío duplicado eliminado.
- Guest localStorage + auth sync: no regresión de lógica (no tocada).
- Navbar count: coherente en smoke.

---

## 10. Cart

- Empty state: OK.
- Persistencia / badge: no regresiones de lógica (no tocada).
- Checkout no ejecutado con pago real (política QA).

---

## 11. Checkout

- Ruta responde, `robots: noindex`.
- Validaciones / Wompi: **no modificadas**; sin transacción real.

---

## 12. Forms

- Auth / newsletter / personalizar / pedido mayor: inputs base ≥16px (`--text-md` / fixes).
- **Fix QA:** search header, sort catálogo, newsletter home/footer → `font-size: 1rem` (evitar zoom iOS).

---

## 13. Accessibility

### Automatizado (Lighthouse)

| Page | A11y score |
|------|------------|
| Home desktop | 92 |
| Home mobile | 92 |
| Catalog mobile | 96 |
| PDP mobile | 96 |

### Fixes aplicados en QA

- Color dots: `role="img"` + `aria-label`.
- ProductCard / Discover: badges `aria-hidden`; sin `aria-label` conflictivo en wrap.
- Cookie link: “Política de cookies” (texto descriptivo).
- Contraste eyebrow: `--color-accent-text` `#9e6104` → `#8a5503`.
- Benefits heading order.

### Pendiente / residual

- Algunos contrastes arena/oro sobre fondos claros pueden seguir cerca del umbral AA en tipografías muy pequeñas.
- Filtros desktop+mobile duplicados en DOM (patrón drawer): revisar `hidden`/`inert` post-launch si auditorías lo marcan.

---

## 14. Keyboard

- Tab / links / botones: OK en smoke.
- Escape navbar: **corregido**.
- Cookie banner / favorito: focus visible presente.
- Sin focus trap accidental detectado en menú.

---

## 15. Reduced motion

- Estrategia Fase 10 + `@media (scripting: none)` en reveals.
- Hero Ken Burns / auto animations reducidos vía CSS existente.
- Contenido no queda en `opacity: 0` con reduced-motion.

---

## 16. SEO

- Root: title template, description, OG, Twitter card, Organization + WebSite JSON-LD.
- Home / Catálogo / PDP / Personalizar / Por mayor: metadata + canonical.
- PDP: Product schema + BreadcrumbList.
- Catálogo: CollectionPage (sin ItemList dinámico — correcto).
- Auth/cart/checkout/favoritos/admin: `noindex` vía layout o metadata.

---

## 17. Sitemap

- Estáticas: `/`, `/catalogo`, `/personalizar`, `/pedido-mayor`, `/guia-de-tallas`.
- Productos activos + CMS pages publicadas.
- **No** incluye filtros ni admin.
- **No** incluye URLs de categoría dedicadas (solo query en catálogo) — documentado en backlog.
- Conteo local observado: **10** `<loc>` (depende de API/data).

---

## 18. Robots

- Allow `/`; disallow admin, vendedor, api, checkout, carrito, **favoritos** (añadido en QA), pedido, solicitud, seguimiento, auth.
- Sitemap URL desde `NEXT_PUBLIC_SITE_URL` (en local apunta a localhost — OK para prod con env correcto).

---

## 19. Metadata

- Favicon fallback: **fix** `/icon-512.png` (antes `/images/favicon-dizor.png` → 404).
- OG imagen catálogo/PDP: `/icon-512.png` si no hay asset propio.
- PDP inexistente: robots `noindex` (Next + metadata not-found).

---

## 20. Performance measurements

Solo datos reales Lighthouse sobre `next start :3001` (2026-09-12).  
**INP** no reportado por este run CLI; se usa **TBT**.

| PAGE | DEVICE | PERFORMANCE | LCP | CLS | INP/TBT | FCP |
|------|--------|-------------|-----|-----|---------|-----|
| `/` | desktop | **98** | 0.8 s | 0.087 | TBT 20 ms | 0.4 s |
| `/` | mobile | **86** | 3.1 s | 0.075 | TBT 320 ms | 1.4 s |
| `/catalogo` | mobile | **77** | 4.3 s | 0 | TBT 370 ms | 1.2 s |
| `/producto/producto-prueba` | mobile | **74** | 4.5 s | 0 | TBT 370 ms | 1.2 s |

Best-practices Home: **96**. SEO Home/Catálogo: **92**; PDP SEO LH: **83** (meta description audit falló en ese run — ver §35; generateMetadata sí define description en código).

---

## 21. LCP analysis

- Home desktop: LCP sub-segundo en local (muy bueno; no extrapolable a 3G real).
- Home mobile ~3.1 s: hero imagen candidata típica.
- Catálogo/PDP mobile ~4.3–4.5 s: imagen producto + JS client (filtros/PDP) + throttling LH.
- Consola LH en :3001 incluyó CORS a API (`Allow-Origin: :3000`) y 404 de logo/favicon **antes** de fixes — puede haber sesgado ligeramente TBT/errores.

---

## 22. CLS analysis

- Home: CLS ~0.075–0.087 (bajo; cookie banner / fuentes / fallbacks Suspense posibles contribuyentes).
- Catálogo/PDP mobile: CLS **0** en medición.
- Fallbacks Suspense Home (Fase 3) no ajustados pixel-perfect — sin CLS crítico observado.

---

## 23. JS/CSS/bundle

- Sin librerías nuevas en Fase 11.
- Motion: CSS + `MotionReveal` mínimo (Fase 10).
- Lint global: **36 errors / 14 warnings** preexistentes (AuthContext/CartContext `set-state-in-effect`, etc.) — no refactor masivo.
- Archivos tocados en QA: lint limpio tras fix logo eslint.

---

## 24. Images

- `next/image` + Cloudinary en contenido CMS/productos.
- Hero priority conservado.
- Below-fold lazy intacto.
- **Fix:** no solicitar logo/favicon locales inexistentes.
- `public/images/`: solo `guia-tallas.png` + `.gitkeep` (logo/favicon deben venir de CMS o añadirse al repo).

---

## 25. Fonts

- Fase 9: system / stacks CSS (`--font-display`, Verdana UI); TT Tsars C pendiente de archivo.
- Sin pesos webfont huérfanos detectados en repo.
- `font-display`: N/A sin `next/font` local aún.

---

## 26. Network

- Fase 3: CSS splitting shop, fetch cache home, Suspense — intactos.
- Visitas / auth / marketing: client fetch (CORS correcto en :3000).
- Third-party: GA solo tras consentimiento; Cloudinary en imágenes; Wompi no cargado above-fold en Home.

---

## 27. Console

En `:3000` (origen CORS esperado): sin errores sistemáticos de hidratación en smoke.

En `:3001` (medición): CORS esperado + 404 assets **pre-fix**. Post-fix favicon/logo: no deben 404.

Warnings legacy React Compiler eslint: documentados, no introducidos por Fase 11.

---

## 28. Analytics/Consent

- Consent Mode v2 default denied.
- `gtag` remoto solo con consentimiento.
- Banner: Aceptar / Rechazar / Configurar + link política.
- Pageviews sanitizan query sensible (`urlSanitizer`).

---

## 29. Cross browser

- Automatizado: Chromium/Chrome.
- CSS modernos usados: `svh`, `backdrop-filter`, `aspect-ratio`, `scroll-snap`, `text-wrap` (según hojas).
- **Safari/iOS real:** pendiente revisión humana (documentado).
- Firefox/Edge: no bloqueo conocido; verificar `backdrop-filter` navbar.

---

## 30. Admin smoke

- Rutas admin cargan (gate auth).
- No se ejecutaron create/delete destructivos en data real.
- Coherencia categorías admin ↔ navbar ↔ filtros: arquitectura Fase 7 intacta.

---

## 31. Build

```
npm run build → PASS
Next.js 16.2.6 (Turbopack)
```

Sin errores de compilación. Warnings npm `devdir` del entorno local (ajeno al proyecto).

---

## 32. Lint

| Ámbito | Resultado |
|--------|-----------|
| Archivos tocados Fase 11 | PASS (`--max-warnings 0`) |
| `npm run lint` global | **FAIL legacy**: 36 errors / 14 warnings (contexts, hooks) |

No se hizo cleanup masivo de lint legacy (fuera de alcance de cierre).

---

## 33. Bugs found

### P0 critical
*(ninguno abierto tras fixes)*

### P1 high
1. **Soft 404 PDP** — UI not-found con HTTP 200 por streaming/`(shop)/loading.js` (mitigado `noindex`; hard 404 ideal pendiente).
2. **404 favicon/logo locales** — corregido (fallback icon-512 + logo texto sin request fantasma).

### P2 medium
3. Escape no cerraba menú mobile — **fixed**.
4. Inputs &lt;16px (search/sort/newsletter) — **fixed**.
5. Favoritos empty message duplicado — **fixed**.
6. A11y color-dots / heading-order / link cookie / contraste eyebrow — **fixed**.
7. Conflicting robots index+noindex en 404 — **fixed** metadata not-found.

### P3 polish
8. Plural “1 productos”.
9. Naming CSS legacy `tejidos*` en dropdown “Más”.
10. Catálogo sin `noindex` en query strings (canonical only).
11. Lint legacy repo-wide.
12. PDP LH meta-description audit intermitente bajo streaming.

---

## 34. Bugs fixed (Fase 11)

| Fix | Archivos |
|-----|----------|
| `/favoritos` en robots disallow | `robots.js` |
| `notFound()` en metadata PDP + quitar loading PDP | `producto/[slug]/page.js`, delete `loading.js` |
| not-found `robots: noindex` | `not-found.js` |
| Escape mobile menu/search | `SiteHeader.jsx` |
| Inputs 16px | `public-header.css`, `catalog-filters.css`, `home.css`, `marketing.css` |
| Favoritos empty duplicate | `FavoritosContent.jsx` |
| Logo sin 404 local | `SiteLogo.jsx` |
| Favicon fallback | `layout.js` |
| A11y dots/badges/headings/cookie/contrast | ProductCard, DailyDiscover, HomeBenefits, CookieConsentBanner, `variables.css` |
| Motion no-JS visible | `motion.css` (`scripting: none`) — ya en Fase 10/ajuste |

---

## 35. Known limitations

1. Soft 404 HTTP 200 en producto inexistente mientras exista `(shop)/loading.js` (comportamiento Next streaming). Mitigación: `noindex`.
2. Mediciones localhost + CORS en puerto alterno.
3. TT Tsars C no embebida aún.
4. Logo/favicon de marca no versionados en `public/images` (dependen de CMS).
5. Sitemap sin landing por categoría ObjectId.
6. Lint global no limpio.
7. Checkout/Wompi no re-testeados end-to-end con dinero real.

---

## 36. Production recommendations

### Antes de go-live
1. `NEXT_PUBLIC_SITE_URL` = dominio real (sitemap/robots/canonical).
2. Subir logo + favicon en Admin Apariencia (o assets en `public/images`).
3. Verificar CORS API solo con orígenes de producción.
4. Lighthouse sobre **staging/producción** (Home/Catálogo/PDP mobile).
5. Prueba manual Safari iOS: navbar blur, inputs, scroll-snap, favoritos guest.

### POST-LAUNCH BACKLOG (no bugs)
- Hard 404 PDP vía proxy/existencia pre-stream o retirar `(shop)/loading.js` selectivamente.
- `noindex` condicional en `/catalogo?*` con filtros no canónicos (si Search Console muestra soft duplicates).
- Entradas de categoría en sitemap si se crean landings SEO.
- Embebido TT Tsars C + `next/font/local`.
- Cleanup lint React Compiler en contexts.
- Pluralización “1 producto”.
- Renombrar BEM `tejidos*` residual en header.

---

## 37. Final status

# READY WITH MINOR ISSUES

**Justificación**

- Rutas críticas responden y renderizan.
- Sin P0 abiertos tras QA.
- P1 soft-404 mitigado para SEO (`noindex`); assets 404 corregidos.
- Carrito / favoritos / catálogo / home operativos.
- Accesibilidad básica mejorada; scores LH a11y ≥92.
- SEO técnico básico válido (robots, sitemap, metadata, schema).
- Performance Home local sólida; Catálogo/PDP mobile mejorables en prod real pero sin regresión crítica de arquitectura.
- Build PASS.

**No se inicia más desarrollo automáticamente.**  
Revisión humana visual + Safari/iOS + Lighthouse staging recomendada antes de declarar READY absoluto.
