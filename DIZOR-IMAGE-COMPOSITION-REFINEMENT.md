# DIZOR — Image Composition Refinement (Fase 11.1)

## 1. Causa real del zoom/crop

No era un bug de Cloudinary ni de `sizes` en sí. La causa era **layout**:

| Sección | Causa principal |
|---------|-----------------|
| Story | Desktop `aspect-ratio: 4/5` + `min-height: 28rem` + `object-fit: cover` → marco vertical alto que fuerza crop agresivo |
| Personalización / Wholesale | `aspect-ratio: 4/5` + `min-height: 26rem` + cover → misma lógica |
| Inspiration | Celdas `4/5` (y mosaicos con `min-height` 30–34rem) + cover → todas las fotos forzadas a portrait |
| Editorial breaks | Mobile `4/5`; desktop panorámico (menos crítico) |

`fill` + `cover` dentro de wrappers demasiado altos/verticales es lo que “hace zoom” visualmente.

## 2. Reglas anteriores

- Story desktop: **4:5**, min-height **28rem**, cover
- Personalize/Wholesale: **4:5**, min-height **26rem**, cover
- Inspiration: **4:5** / mosaico alto, cover, hover scale **1.015**
- Editorial n1 mobile: **4:5**
- Secciones servicio: contenedor hasta **1400px**, mucho blanco plano

## 3. Reglas nuevas

- Story / Personalize / Wholesale / Inspiration: **`object-fit: contain`** en frame editorial (letterbox arena o oscuro en Story)
- Story: marco **5:4**, `max-height` acotado, sin min-height forzado
- Personalize: marco **4:3**, max-height ~20–22rem; grid ~**55/45**; contenedor **≤1200px**
- Wholesale: marco **3:2**, max-height ligeramente menor
- Inspiration: ratios **4:3** (no 4:5); mosaicos más bajos; hover scale **1.012**
- Editorial breaks: mobile menos portrait; desktop panorámico con `max-height` menor; **cover**
- Decoración CSS `::before`/`::after` en personalize/wholesale (sin assets)

## 4. Story

- Grid desktop: `1.05fr / 1fr`, max-width composición **1280px**
- Imagen: **5:4**, `max-height: min(24rem, 42vh)`
- Padding sección desktop: **4rem** (antes 5rem)
- Copy / MotionReveal: intactos

## 5. Personalization

- Imagen menos dominante; frame **5:4** + borde editorial
- Fondo: trama vertical tipo urdimbre + glow arena + círculo incompleto (CSS)
- Proporción texto/imagen ~55/45

## 6. Inspiration

- Estrategia elegida: **A — contain** dentro de frame editorial
- Letterbox: off-white/arena `#f3efe8` (no negro)
- Desktop mosaico 3/5: `min-height` bajado (~22–28rem vs 28–34rem)
- Mobile: card **~82vw**, ratio **4:3**

## 7. Wholesale

- Misma familia layout que personalize, con variación:
  - trama horizontal
  - arco incompleto
  - ratio **4:3**
- Sin copia idéntica de decoración

## 8. Editorial Breaks

- Solo ajuste de crop: mobile **3:4** / n2 **4:3**; desktop `max-height` algo menor
- Sigue siendo pausa fotográfica full-bleed; sin texto

## 9. Estrategia object-fit

| Superficie | Fit |
|------------|-----|
| Story / Personalize / Wholesale / Inspiration | `contain` (frame editorial / letterbox) |
| Editorial breaks | `cover` (pausa full-bleed; ratios suavizados) |
| ProductCard / catálogo / PDP | **sin cambios** |

## 10. Estrategia aspect-ratio

- Story: **5:4**
- Personalize: **5:4**
- Wholesale: **4:3**
- Inspiration cells: **4:3** (n1: **16:10** / mobile n1 **3:2**)
- Editorial n1 mobile: **3:4**; desktop panorámico

## 11. Fondos/decoración añadida

Solo CSS en:

- `.home-section--personalize::before|::after`
- `.home-section--wholesale::before|::after`

Líneas de trama + elipse arena + círculo/arco. Opacity baja. Sin requests nuevos.

## 12. Desktop

- Composiciones más compactas; menos altura por foto
- Inspiration: foto completa visible (contain)
- Story/servicio: más escena visible por ratio horizontal

## 13. Mobile

- Inspiration scroll horizontal con frame 4:3 y ~82vw
- Story/personalize sin min-heights enormes
- Editorial mobile menos portrait extremo

## 14. Performance

- Sin librerías
- `next/image` + lazy intactos
- Sin priority nueva
- Sin assets decorativos
- CSS splitting Home intacto

## 15. Confirmación ProductCard intacto

**Confirmado:** no se modificaron:

- `ProductCard.jsx`
- `product-card.css`
- catálogo / PDP / relacionados / filtros / favoritos / Novedades ProductCarousel

## 16. Archivos modificados

- `frontend/src/styles/pages/home.css`
- `frontend/src/components/home/HomeStory.jsx`
- `frontend/src/components/home/HomePersonalization.jsx`
- `frontend/src/components/home/HomeWholesale.jsx`
- `frontend/src/components/home/HomeInspiration.jsx`
- `frontend/src/components/home/HomeEditorialBreak.jsx`
- `DIZOR-IMAGE-COMPOSITION-REFINEMENT.md`

## 17. Build

`npm run build` — **PASS**

## 18. Lint

ESLint archivos JSX tocados — **PASS** (`--max-warnings 0`)

## 19. Pendientes CMS/focal-point

**POST-LAUNCH BACKLOG**

- Focal point / `object-position` por imagen (desktop + mobile) en CMS
- Orientación metadata (portrait/landscape) para celdas Inspiration adaptativas sin contain universal
- Opcional: hard-crop Cloudinary `c_fill` con gravity face si se quiere cover “inteligente” en Story

---

### Validación visual

Capturas generadas (Cursor screenshots):

**Desktop ~1440**
- `fase11.1-story-desktop.png`
- `fase11.1-personalize-desktop.png`
- `fase11.1-inspire-desktop.png`
- `fase11.1-wholesale-desktop.png`

**Mobile ~390**
- `fase11.1-story-mobile.png`
- `fase11.1-personalize-mobile.png`
- `fase11.1-inspire-mobile.png`
- `fase11.1-wholesale-mobile.png`

Revisar en UI Cursor antes de más correcciones.
