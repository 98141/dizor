# FASE 6 — PRODUCT & CONVERSION REPORT

## 1. Resumen

Se rediseñó **ProductCard** como base visual única (Home editorial + catálogo + relacionados PDP), con fotografía protagonista, hover de segunda imagen bajo demanda, badges editoriales (máx. 2), precio más legible, swatches discretos y CTA tipográfico sutil “Ver pieza”.

**DailyDiscover** se mantuvo como composición editorial propia (no forzada a ProductCard), con badges Nuevo/Agotado alineados visualmente.

No se implementó Quick Add ni Favoritos. No se tocaron Navbar, Hero, editorial breaks ni backend.

## 2. ProductCard antes

- Borde + radius + elevación al hover.
- Una sola imagen (`width`/`height`, no `fill`).
- Badges: Agotado / Nuevo / −% (sin Destacado; hasta 3 visibles).
- Meta: tejido + estilo siempre.
- Swatches: hasta 5.
- Texto “Sin stock” duplicado con badge.
- Sin segunda imagen.
- Consumidores: Home carousel, catálogo, relacionados PDP.

## 3. ProductCard después

- Jerarquía: imagen → badge → meta mínima → nombre (clamp 2) → swatches → precio → CTA visual.
- `presentation="editorial"` (Home) vs default (catálogo/relacionados).
- Segunda imagen en desktop solo si existe; montaje en `mouseenter`/`focus` (sin precarga masiva).
- Badges máx. 2 — prioridad: **Agotado > Nuevo > Destacado**; oferta si cabe.
- Sin ratings inventados; sin tallas en card; sin quick-add; sin corazones.

## 4. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/products/ProductCard.jsx` | Rediseño completo |
| `frontend/src/styles/components/product-card.css` | Estilos nuevos |
| `frontend/src/components/home/ProductCarousel.jsx` | `presentation="editorial"` |
| `frontend/src/components/home/DailyDiscoverGrid.jsx` | Badges Nuevo/Agotado |
| `frontend/src/styles/pages/home.css` | Overrides carousel + badge Discover |
| `frontend/src/styles/components/catalog-filters.css` | Grid productos / gaps / 4 cols relacionados |

## 5. Imagen principal

- `next/image` con `fill` + `object-fit: cover` + aspect-ratio **4/5**.
- Fondo neutro `#f0ebe3` mientras carga (shimmer blur existente).
- Fallback URL `/icon-512.png` solo si faltara `mainImage`.
- `sizes` por contexto (editorial vs catálogo).

## 6. Segunda imagen / hover

- Solo si `images[]` tiene URL distinta de `mainImage`.
- Desktop: `@media (hover: hover) and (pointer: fine)` — crossfade + scale 1.02.
- Mobile: sin hover; imagen principal estable.
- Network: la 2ª imagen **no se monta** hasta hover/focus → no compite con Hero en first load.
- `prefers-reduced-motion`: sin scale.

## 7. Badges

| Condición | Badge |
|-----------|--------|
| `!inStock` | Agotado (único) |
| `isNew` | Nuevo |
| `isFeatured` && !isNew | Destacado |
| promo real + cupo | −N% |

Estilo editorial (fondo semi-blanco / tipografía pequeña). Máx. 2.

## 8. Precio

- Actual en serif, tamaño legible.
- Anterior tachado solo si `onPromotion` + `discountPercent` + `effectivePrice < salePrice`.
- Sigue `formatCOP`.

## 9. Variantes

- Swatches de color únicos (activos), máx. **4** + `+N`.
- No interactivos (info visual).
- Tallas: **no** se muestran en card (permanecen en PDP).

## 10. Stock

- Badge Agotado + imagen atenuada.
- PDP sigue accesible (links activos).
- Eliminado texto redundante “Sin stock”.

## 11. Home presentation

- Novedades: `presentation="editorial"`; layouts Fase 4 (peek / count) intactos.
- Descubre hoy: markup propio conservado + badges coherentes; **sin priority**.

## 12. Catalog presentation

- Grid 2 → 3 columnas (1024+); gaps más respirados.
- Relacionados PDP: 4 columnas desde 1280px.
- `priority` solo en el **primer** producto del grid (LCP catálogo).

## 13. Responsive

Validar: 1440 / 1200 / 1024 / 768 / 430 / 390 / 360.

- Mobile: CTA tipográfico oculto (ruido); 2 columnas en catálogo.
- Desktop: hover 2ª imagen + “Ver pieza” al hover de card.

## 14. Accessibility

- Links imagen + título con `select_item` (sin preventDefault).
- `aria-label` en imagen; focus visible en card/`focus-within`.
- Swatches no son botones.
- CTA “Ver pieza” es decorativo (`aria-hidden`); navegación real = links.
- Badges no interactivos.

## 15. Analytics

- `trackSelectItem` preservado en clicks de imagen y título.
- Sin eventos duplicados nuevos.
- List trackers Home/catálogo/relacionados sin cambios de contrato.

## 16. Performance

Confirmado:

- Hero priority intacto.
- Product images **sin** priority masivo (solo 1º del catálogo).
- Suspense Home intacto.
- CSS splitting intacto (`product-card.css` vía shop layout).
- Sin librerías nuevas.
- 2ª imagen lazy/on-demand.

## 17. Casos cubiertos (lógica)

| Caso | Comportamiento |
|------|----------------|
| 1 imagen | Sin clase secondary; scale suave hover |
| 2+ imágenes | Crossfade desktop on-demand |
| Sin / con colores | Swatches o nada |
| Nuevo / Destacado / Agotado / Promo | Badges según prioridad |
| Nombre largo | line-clamp 2 |
| Promo real | precio + tachado + badge % |
| Sin reviews en listado | no se inventan estrellas |

## 18. Build

`npm run build` → **PASS**

## 19. Lint

ESLint archivos Phase 6 → **PASS**

## 20. Riesgos

- Primera entrada de hover puede mostrar 2ª imagen con leve delay de red (trade-off consciente vs precarga).
- Fotos temporales con fondos distintos: cover + 4/5 mitiga, no unifica magia de estudio.
- Dos links al mismo PDP (imagen + título): patrón e-commerce habitual; no anidados.

## 21. Pendientes

- Revisión visual humana Home + catálogo (desktop/mobile).
- Fase 7 Favoritos (no corazones en card).
- Posible unificar tipografía precio Discover ↔ ProductCard en pulido menor.
- PDP galería / conversión profunda: fuera de alcance.

## 22. Recomendación Quick Add futuro

**No conviene ahora.** Los productos Dizor suelen requerir **color y/o talla** (variantes) y algunos permiten **personalización**. Un “Agregar” desde card sin variante inequívoca genera errores de carrito o UX frustrante.

Quick Add solo tendría sentido si:

- existe variante única activa en stock, **o**
- se abre un sheet mínimo de variante antes de add.

Eso sería una fase de conversión posterior, no Fase 6.

---

**STOP — no iniciar Fases 7–10** hasta revisión visual de capturas Home + catálogo.
