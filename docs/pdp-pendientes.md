# PDP — pendientes

Registro de lo que quedó abierto tras la auditoría y la implementación de la página de producto (noviembre 2026). Ningún cambio se ha publicado; todo está en la rama `develop`, sin commit.

## Datos (administrador)

- [ ] **Colores especiales con hex decorativo.** «Surtido» (abanicos) y «Multicolor Personalizado» tienen un código hex que no representa el producto. La PDP ya los muestra como texto con muestra multicolor (`isMixedColor` en `frontend/src/lib/productVariants.js`), pero el catálogo aún pinta el punto de color. Quitar el hex en Admin → Colores. Si se crean otros nombres de color especiales, añadirlos a `isMixedColor`.
- [ ] **Alt con nombre de archivo** en 3 productos (`pavas`, `bolsos`, `sombrero-borsalino-superfino`: «WhatsApp Image 2026-…»). La PDP los sustituye solo en pantalla; corregirlos en el administrador.
- [ ] **Fotos de baja resolución.** Las del Bolso Ébano (y variantes Ébano) miden 853×1280 px; el zoom del visor amplía algo más que la resolución real. Subir originales de ≥ 1600 px en el lado largo.
- [ ] **Stock de marcador** (9999/10000) en el Borsalino Superfino.
- [ ] **Anuncio superior** «Prueba uno catalogo» con aspecto de contenido de prueba (global, no PDP).

## Backend (sin cambios en este sprint, por decisión)

- [ ] `GET /api/products/:slug` incrementa `viewsCount` en cada consulta, incluidas las de bots, previsualizaciones y pruebas. Durante la auditoría se sumaron ~43 vistas en Atlas; no se compensaron por decisión del dueño.
- [ ] `GET /api/products/daily-random` (home) hace *get-or-create* de `DailyProductPick`: una lectura que puede escribir.
- [ ] El limitador global de la API (300 peticiones / 15 min por IP) lo comparten el servidor de desarrollo y cualquier prueba automatizada local.

## PDP — validación pendiente

- [ ] Probar en Safari de un iOS real (las pruebas usaron emulación de Chromium).
- [ ] Medir LCP con `next build` + `next start` (los valores medidos fueron en modo desarrollo).
- [ ] Formulario de reseña con sesión real y verificación de compra real (se validó con una API simulada).
- [ ] Recorrido de punta a punta del enlace «Inicia sesión para escribir tu reseña» (`/login?next=…#escribir-resena`).

## PDP — detalles menores

- [ ] Con 3 productos relacionados (abanicos), en móvil se ven 2 + 1 (regla ya existente).
- [ ] En nombres muy largos, la miga de pan parte la línea con «/» al principio.
- [ ] El desplazamiento de la barra compacta del header (93 px) está fijo en `producto.css`; si cambia la altura del header, hay que actualizarlo.
- [ ] El enlace «Ver política» del aviso de consentimiento (componente compartido) mide 16 px de alto; está dentro de texto corrido (excepción de WCAG 2.5.8), pero podría ampliarse.
- [ ] La descripción larga no interpreta énfasis (`**texto**`) ni enlaces Markdown: el parser compartido (`frontend/src/lib/simpleContentBlocks.jsx`) solo admite párrafos, `#` títulos, listas, listas numeradas e imágenes. Hoy ningún producto los usa; si el administrador empieza a usarlos, ampliar el parser con cuidado (lo usan también las páginas del CMS).
- [ ] 46 avisos de lint anteriores, en 27 archivos ajenos a la PDP.

## Descripción editorial abierta — revisar

- [ ] Al quedar todo visible, la descripción ocupa más altura: en móvil (390 px) entre ~900 px (bolsos) y ~1.400 px (sombreros con «Tallas»). La galería *sticky* (escritorio) y la barra de compra móvil compensan, pero conviene validarlo con usuarios.
- [ ] El acento de «Material y origen» (icono de fibra) se activa cuando el título contiene «material», «materiales» u «origen». Un título distinto con el mismo contenido se mostraría como un apartado normal.
- [ ] No se usan dos columnas internas: la columna de compra mide ~400–466 px y dos columnas comprometerían la lectura. Reevaluarlo solo si cambia la proporción de la rejilla.
- [ ] Si la descripción larga empieza con un texto idéntico a la descripción corta, esa introducción no se repite (comparación sin tildes, mayúsculas ni espacios). Hoy ningún producto lo cumple.

## Reseñas — revisar

- [ ] Redacción de los textos fijos: subtítulo de la sección y las tres notas del bloque «Tu experiencia».
- [ ] Decisión de producto: la calificación ya no viene preseleccionada en 5 estrellas.
- [ ] El promedio se calcula con las reseñas que devuelve la API (máx. 50).
- [ ] El título «Reseñas de nuestros clientes» incluye también las reseñas publicadas por la tienda (llevan su etiqueta).
