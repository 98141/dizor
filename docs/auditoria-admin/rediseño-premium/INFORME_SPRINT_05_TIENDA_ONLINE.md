# Informe Sprint 05 — Tienda online

Presentación Operativo Premium Híbrido de las seis secciones de Tienda online, y paginación real del listado administrativo de reseñas. No cambia slugs, Cloudinary, permisos, la tienda pública ni Marketing.

El diagnóstico previo está en `docs/auditoria-admin/rediseño-premium/SPRINT_05_DIAGNOSTICO.md`. Las capturas nuevas están en `docs/auditoria-admin/rediseño-premium/evidencias-sprint-05/`.

## 1. Auditoría inicial

Tienda online vive en `ContentWorkspace.jsx`, con las pestañas de `CONTENT_TABS`. Inicio, Pedidos, Productos, Atención al cliente y `admin-buttons.css` sí están en el árbol. Marketing comparte el archivo y no se rediseñó.

La carga del CMS sigue bloqueando el formulario si el GET falla. Apariencia sigue en `useConfirmedSettings`: una lectura inválida no deja guardar.

## 2. Inventario de subsecciones

Doce secciones de texto: Hero, Anuncio, Beneficios, Novedades, Colecciones, Historia, Personalización, Por mayor, Voces, Selección, Inspiración y Newsletter.

Ocho secciones de imagen: Hero, Historia, Personalización, Por mayor, Colecciones, Inspiración (máximo 5), Pausa editorial 1 y Pausa editorial 2 (máximo 2).

El modelo de inicio también guarda `featuredSection` y `bestsellerSection`. Esta pantalla no las editaba y este sprint no las agrega.

## 3. Mapa de campos

La matriz completa está en el diagnóstico. Hero agrupa claim, título, subtítulo y dos pares de CTA con enlace. Anuncio admite hasta 3 ítems. Beneficios, hasta 4. Personalización y Por mayor, hasta 5 bullets. El cuerpo de una página informativa sigue siendo el texto con `#`, listas y tallas. El slug lo genera el servidor.

## 4. Contratos de imágenes

Cada foto conserva url, `publicId`, texto alternativo, orden, activo, título, enlace, tejido y encuadre. Hero: la de menor orden es la principal (LCP). Colección exige tejido. La subida sigue yendo a Cloudinary por el servicio existente. Las pruebas no suben archivos reales: el mock responde en local.

## 5. Arquitectura real de reseñas

Antes, `GET /api/admin/reviews` devolvía hasta 100 registros (tope 200), ordenados solo por `createdAt`, sin total ni página.

Ahora, si la petición no trae `page`, la respuesta anterior se mantiene. Si trae `page`, el tamaño solo puede ser 10 o 20; otro valor responde 400. El filtro se aplica antes de contar y de paginar. El orden es `createdAt` descendente y, si la fecha coincide, `_id` descendente. La respuesta añade `total`, `page`, `pages` y `limit`. Si la página pedida se pasa, el servidor devuelve la última válida.

No se creó un índice. El existente `{ aprobado: 1, createdAt: -1 }` sigue. Un índice futuro útil, sin aplicarlo, sería el mismo más `_id` descendente.

No hay un tercer estado de moderación: solo pendiente (`aprobado: false`) y aprobada. La reseña de marca nace aprobada y marcada con `isBrandReview`.

## 6. Cambios de frontend

Los estilos nuevos están en `admin-store.css` y solo actúan dentro de `.st-store`. Las pestañas de Tienda online usan la clase `st-tab` para no heredar el botón de formulario del sprint 04. La activa lleva borde dorado.

En escritorio las subsecciones pueden ocupar dos filas compactas, para que Newsletter no quede fuera de vista. En móvil, por debajo de 759 px, la barra vuelve a una sola fila con desplazamiento.

## 7. Cambios de backend

- `backend/src/services/reviewListQuery.js`: reglas de límite y página.
- `backend/src/controllers/reviewController.js`: las usa en el listado administrativo.
- `backend/test/review-list-query.test.js`: el contrato sin página y el rechazo de tamaños inválidos.

No hay migración ni índice nuevo. El catálogo público de reseñas no se tocó.

## 8. Página de inicio

El formulario deja de ser una sola columna. Claim y título, y cada CTA con su enlace, comparten fila cuando hay ancho. El subtítulo ocupa el ancho de lectura. A la derecha, en escritorio, hay un borrador de los textos de la sección. Dice que no es la tienda pública y no guarda solo. El guardado sigue siendo «Guardar inicio».

## 9. Imágenes

La subida agrupa archivo, texto alternativo y «Subir a Cloudinary». La galería muestra una miniatura de 112 px, el nombre o el alt, el `publicId`, el orden, Activa o Inactiva y, en Hero, Principal (LCP). Subir y Bajar quedan a la vista. Alt, tejido, título, enlace, encuadre, Guardar datos, Activar o Desactivar y Eliminar están en «Editar datos». «Ver imagen» abre la foto grande y se cierra con Cerrar. No se reordena ni se borra nada al cambiar de sección.

## 10. Banners

En escritorio el listado y el formulario van en dos columnas. En móvil el formulario está oculto hasta «Nuevo banner» o Editar. Cada banner muestra imagen, título, ubicación legible (Inicio o Catálogo) y Activo o Inactivo. Editar y Eliminar conservan la confirmación de borrado que ya existía.

## 11. Páginas informativas

El listado es lo primero: título, `/pagina/{slug}`, Publicada o Borrador, y si entra en el footer. «Nueva página» o Editar abren el formulario. El cuerpo, el SEO de 70 y 160 caracteres, la imagen y la publicación no cambian de contrato. Cancelar cierra el editor. «Ver en tienda» sigue apuntando al slug guardado.

## 12. Paginación de reseñas

La pantalla pide 10 por página y permite 20. Muestra página, total, Anterior y Siguiente. La URL guarda `reviewView`, `reviewPage` y `reviewSize` junto a `tab`, sin pisar otras pestañas. Tras moderar se recarga la página actual. Si el servidor corrige una página fuera de rango, la URL se alinea con esa página.

La lista es una tabla en escritorio y fichas en móvil. El comentario largo se resume y «Ver comentario» abre el texto entero. La reseña de marca no está abierta: el botón «Escribir reseña de marca» la despliega. Comprador y Marca se leen, no solo se colorean.

## 13. Apariencia

Identidad, logo, colores y favicon van en cuatro paneles, dos por fila en escritorio. Cada color muestra muestra, selector y valor. El tema público no cambia mientras se edita. «Guardar apariencia» sigue dependiendo de la carga confirmada: si la lectura falla, el formulario no queda editable.

## 14. Componentes reutilizados

`AuthFormField`, `AuthSubmitButton`, `AdminFeedback`, `AdminConfirmModal`, `SettingsLoadState`, `CmsImageField` y los botones `.admin-btn` del sprint 04. No hay un sistema visual nuevo.

## 15. Experiencia móvil

Probado a 1440, 1024, 820, 390 y 360. La página no crece de ancho. En móvil los banners no obligan a pasar por un formulario vacío. Las páginas se consultan desde la lista. Las reseñas van paginadas.

## 16. Accesibilidad

Las pestañas de sección conservan su nombre. Ver imagen, Subir, Bajar, Editar y Eliminar llevan el recurso en el nombre accesible. El formulario de marca usa `aria-expanded` y `aria-controls`. El foco visible de las pestañas es el anillo de 3 px. El estado de una reseña se escribe, además del color. No se declara conformidad WCAG completa.

## 17. Archivos modificados

- `frontend/src/styles/pages/admin-store.css`
- `frontend/src/app/admin/layout.js`
- `frontend/src/components/admin/ContentWorkspace.jsx`
- `frontend/src/components/admin/HomeTextsTab.jsx`
- `frontend/src/components/admin/HomeImagesTab.jsx`
- `frontend/src/components/admin/ReviewsTab.jsx`
- `backend/src/services/reviewListQuery.js`
- `backend/src/controllers/reviewController.js`
- `backend/test/review-list-query.test.js`
- `frontend/test/sprint05-tienda-browser.cjs`

## 18. Pruebas

`node backend/test/review-list-query.test.js`: 2 pruebas, en verde. Cubren el límite antiguo sin `page` y el rechazo de un tamaño distinto de 10 o 20.

`node frontend/test/sprint05-tienda-browser.cjs`: 10 comprobaciones, en verde, sin errores de página ni peticiones externas. Recorre inicio, error y reintento del CMS, imágenes y reorden, banners, páginas, reseñas con fecha igual, apariencia y anchos de 1440 a 360. Los datos son ficticios. No hay subida real a Cloudinary.

## 19. Regresión

La tienda pública no importa `admin-store.css` ni `admin-buttons.css`. El formulario de inicio no se monta si el CMS falla, y el reintento no escribe. Apariencia sigue en la máquina de carga confirmada. No se volvió a ejecutar la suite Next con Mongo de F5 ni la de F6. Esas suites no se alteraron.

ESLint marca `react-hooks/set-state-in-effect` en el `useEffect` que llama a `load()` de imágenes y de reseñas. Ese efecto ya existía para disparar la carga. No cambié la forma de cargar para silenciarlo.

## 20. Capturas

En `evidencias-sprint-05/`: `inicio-1440`, `inicio-390`, `inicio-360`, `inicio-historia-1440`, `imagenes-1440`, `imagenes-390`, `banners-1440`, `banners-nuevo-390`, `paginas-1440`, `resenas-1440`, `resenas-marca-1440`, `resenas-390`, `apariencia-1440`, `apariencia-390`. El resultado está en `navegador.json`.

El estado anterior de banners y apariencia quedó registrado en las evidencias de la fase 6, no en una pasada «antes» de este sprint.

## 21. Problemas corregidos

El título del banner se partía letra por letra y el botón «Nuevo banner» se montaba sobre la ficha. La ficha ahora deja las acciones debajo del título y el texto parte por palabras. En móvil, las pestañas de Tienda online vuelven a una fila con desplazamiento, en lugar de tres filas de botones.

## 22. Riesgos pendientes

- La suite F5/F6 con base temporal no se repitió.
- Quien llame al listado de reseñas sin `page` sigue recibiendo hasta 100. Solo el administrador nuevo envía página.
- El índice recomendado no está creado. Con muchas reseñas de la misma fecha, el desempate por `_id` puede ser más lento.
- `featuredSection` y `bestsellerSection` siguen fuera del editor.

## 23. Recomendaciones

El siguiente módulo no debería crear otra familia de botones ni otra barra de pestañas. Si el volumen de reseñas crece, el índice `{ aprobado: 1, createdAt: -1, _id: -1 }` puede añadirse en una migración aparte, no en caliente.
