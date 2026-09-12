# FASE 9 — TYPOGRAPHY SYSTEM REPORT

## 1. Estado tipográfico anterior

- Variables: `--font-serif` declaraba `"TT Tsars C", "Playfair Display", Georgia…` sin archivos cargados.
- Body global: **Arial** hardcodeado en `globals.css` (ignoraba `--font-body`).
- UI secundaria: Verdana en `--font-sans`, poco aplicada de forma consistente.
- Escala: tamaños ad hoc (`clamp`, `0.62rem`, `0.68rem`…) sin tokens.
- Tracking: eyebrows/hero brand a **0.28em** (patrón tipográfico genérico/IA).
- Sin archivos `.woff` / `.woff2` / `.ttf` / `.otf` en el repositorio.
- Sin `next/font` activo (README menciona Geist; no se usa).

## 2. Problemas detectados

| Problema | Impacto |
|----------|---------|
| TT Tsars C ausente | Display caía a Playfair (no cargada) → Georgia |
| Playfair en stack | Look “lujo genérico” aunque no se cargara |
| Arial vs Verdana | Identidad de body inconsistente vs manual |
| Tracking alto en uppercase | Apariencia template / IA |
| Sin escala tokenizada | Difícil coherencia Home / Catálogo / PDP |
| Meta/badge ~0.62rem | Legibilidad límite en móvil |
| Pesos 700/800 dispersos | Menos sofistificación |

## 3. Dirección de marca elegida

**Artesanal · editorial · cálida · contemporánea · sin folclorismo.**

- Display: clásico editorial (no romanticismo de boda, no serif de startup luxury).
- Body/UI: humana, legible, no geométrica (Verdana = secundaria del manual).
- Identidad vía escala, tracking moderado, pesos reducidos y ritmo — no solo “fuente bonita”.
- Máximo 2 familias (display + body/ui).

## 4. Fuentes disponibles en repositorio

- **Ningún archivo de fuente local.**
- Fuentes de sistema utilizadas como stack legal/seguro.

## 5. Situación TT Tsars C

**TT Tsars C pendiente de archivo/licencia.**

- Confirmado: no existe `.woff` / `.woff2` / `.ttf` en el repo.
- NO se descargó.
- NO se usó CDN.
- Stack preparado: primer nombre `"TT Tsars C"` en `--font-display`.
- Cuando se entregue legalmente → integrar con `next/font/local` (pesos mínimos, `display: swap`) sustituyendo solo el loader; variables ya apuntan a `--font-display`.

## 6. Familia Display

```
"TT Tsars C", Georgia, "Palatino Linotype", "Book Antiqua", "Times New Roman", serif
```

- Alias: `--font-serif` → `--font-display` (compatibilidad).
- **Sin Playfair / Cormorant.**

## 7. Familia Body/UI

```
Verdana, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif
```

- `--font-body` = `--font-ui` = `--font-sans` (alias).
- Body unificado (ya no Arial suelto).

## 8. Pesos utilizados

| Peso | Token | Uso |
|------|-------|-----|
| 400 | `--weight-regular` | Display, títulos, precios |
| 500 | `--weight-medium` | UI, nav, botones, labels |
| 600 | `--weight-semibold` | Énfasis puntual |
| 700 | `--weight-bold` | Solo donde ya existía y es necesario |

No se cargan familias web → no hay coste de peso de archivo.

## 9. Escala tipográfica

| ROLE | MOBILE | DESKTOP | WEIGHT | LINE-HEIGHT | TRACKING |
|------|--------|---------|--------|-------------|----------|
| Display LG (Hero H1) | ~2.15rem | ~3.55rem | 400 | 1.12 | -0.012em |
| Display MD / H1 | ~1.95rem | ~3.1rem | 400 | 1.28 | -0.012em |
| Display SM / section H2 | ~1.7rem | ~2.4rem | 400 | 1.28 | -0.012em |
| Product title | ~1.06rem | ~1.06rem+ | 400 | 1.28 | -0.012em |
| Body | 0.9375rem | 0.9375rem | 400 | 1.55 | 0 |
| UI / buttons | 0.8125–1rem | igual | 500 | 1.28–1.55 | 0–0.03em |
| Eyebrow / meta | 0.75rem | 0.75rem | 500 | 1.28 | **0.08em** |
| Brand wordmark | clamp | clamp | 400 | — | 0.12em |
| Price | ~1.06–1.75rem | igual | 400 | — | 0 + tabular-nums |

Tokens: `--text-xs` … `--text-display-lg`, `--leading-*`, `--tracking-*`, `--measure`.

## 10. Eyebrows

- Tracking de **0.28em → 0.08em** (`--tracking-label`).
- Uppercase conservado solo en labels cortos.
- Color: `--color-accent-text` (contraste AA).

## 11. Headings

- Familia display + peso regular + tracking leve negativo.
- `text-wrap: balance` en H1/H2 globales y títulos clave.
- Hero H1 sigue contundente vía `--text-display-lg`.

## 12. Body

- Verdana como base.
- Lead Home / subtítulos / PDP description: `--leading-relaxed` + `--measure` donde aporta.

## 13. Product typography

- Nombre: display regular.
- Meta: UI uppercase con tracking moderado (legible ≥12px).
- Badge / CTA “Ver pieza”: mismo sistema de labels.

## 14. Price

- Display regular (no 800/900).
- `font-variant-numeric: tabular-nums` en card y PDP.

## 15. Navbar

- Nav desktop: UI medium, `0.03em`, sin aumento agresivo de tamaño.
- Logo fallback: display + `--tracking-brand` (0.12em).
- Sección móvil “Catálogo”: label con tracking moderado.
- Lógica de categorías / favoritos **intacta**.

## 16. Buttons

- Home CTA / PDP add: UI medium, **sin uppercase forzado**.
- Tracking normal.

## 17. Forms

- `input/select/textarea`: `--text-md` (16px) → evita zoom iOS.
- Auth titles: display tokens.

## 18. Footer

- Brand: display + tracking brand.
- Group headings: UI label moderado.
- Layout sin rediseño.

## 19. Home

- Hero tipografía tokenizada (sin rediseño de comportamiento).
- Section headings / leads / voices / craft CTAs alineados.
- Eyebrows suavizados.

## 20. Catalog

- Título / subtítulo / group titles / toggle filtros con tokens.
- Sidebar funcional intacto.

## 21. PDP

- Title, price, breadcrumb, attrs, description, add-to-cart tipográficos.
- Sin rediseño de layout.

## 22. Responsive

- Escala vía `clamp` en display tokens.
- Validación visual pendiente del usuario en 1440 / 1024 / 768 / 390 / 360.

## 23. Accessibility

- Body ≥ ~15px.
- Labels/meta ≥ 12px.
- Contraste oro texto: `--color-accent-text` conservado.
- Focus visible no tocado negativamente.

## 24. Performance

- **0 KB** de fuentes web nuevas.
- Sin Google Fonts runtime.
- Sin CLS de font-face nuevo.
- Stack sistema inmediato.
- CSS splitting / Suspense / Hero behavior **intactos**.

## 25. Archivos modificados

- `frontend/src/styles/base/variables.css`
- `frontend/src/styles/base/globals.css`
- `frontend/src/styles/pages/home.css`
- `frontend/src/styles/components/product-card.css`
- `frontend/src/styles/layouts/public-header.css`
- `frontend/src/styles/layouts/public-footer.css`
- `frontend/src/styles/components/catalog-filters.css`
- `frontend/src/styles/pages/producto.css`
- `frontend/src/styles/pages/favoritos.css`
- `frontend/src/styles/components/auth-card.css`
- `DIZOR-FASE9-TYPOGRAPHY-SYSTEM-REPORT.md` (este)

Admin: hereda aliases (`--font-serif` → display) sin rediseño editorial forzado.

## 26. Build

```
frontend npm run build → PASS
```

## 27. Lint

Cambios principalmente CSS; sin errores de JS nuevos introducidos en esta fase.

## 28. Pendientes

1. Entregar **TT Tsars C** licenciada → `next/font/local` (Regular + opcional Medium).
2. Revisión visual humana Home / Catálogo / PDP (desktop + mobile).
3. Ajuste fino de tracking/medida tras feedback.
4. **No iniciar Fase Motion** hasta esa revisión.

### Confirmaciones

- Sin librerías nuevas.
- Sin descarga de fuentes.
- Sin Playfair/Cormorant/Inter/Poppins/Montserrat como protagonistas.
- Navbar / categorías / favoritos / Hero logic / ProductCard logic / CSS splitting: intactos a nivel funcional.
