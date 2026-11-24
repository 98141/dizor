# Sprint 05 — Diagnóstico de Tienda online

Auditoría hecha sobre el árbol actual, antes de cambiar la presentación. No se usó una base real.

## Lo que ya está implementado

Inicio, Pedidos, Productos, Atención al cliente y `admin-buttons.css` están en el código, no solo en los informes. Los botones del panel viven en `.admin-shell .admin-main > main`. La tienda pública no carga esa hoja.

Tienda online sigue en `ContentWorkspace.jsx`, con las pestañas de `CONTENT_TABS` (`area: "store"`): Página de inicio, Imágenes, Banners, Páginas informativas, Reseñas y Apariencia. Marketing (Popup, Newsletter, Carritos) comparte el mismo archivo y no entra en este sprint.

Rutas: `/admin/contenido?tab=…`. `/admin/resenas` y `/admin/home-imagenes` siguen redirigiendo y conservan los parámetros extra.

Permiso de la pantalla: `superadmin` y `admin`. El vendedor no entra.

## Mapa por sección

### Página de inicio

Componente: `HomeTextsTab.jsx`. Datos: `GET/PATCH /api/admin/content/home`. Modelo: `homeContent.js`, documento `key: "default"`.

Doce subsecciones reales en el editor. El modelo también guarda `featuredSection` y `bestsellerSection`; esta pantalla no las edita y el sprint no las agrega.

| Sección | Clave | Campos que el editor muestra | Límites |
| --- | --- | --- | --- |
| Hero | `hero` | brandClaim, title, subtitle, ctaLabel, ctaHref, secondaryCtaLabel, secondaryCtaHref | Textos. La imagen no se edita aquí |
| Anuncio | `announcement.items` | text, linkHref, activo | Máximo 3 |
| Beneficios | `features` | title, text | Máximo 4. `icon` existe en el modelo y no se edita |
| Novedades | `newSection` | eyebrow, title, subtitle, linkLabel, linkHref, isActive | Productos «Nuevo» salen del catálogo |
| Colecciones | `craftSection` | eyebrow, title, subtitle, linkLabel | Los tejidos salen del catálogo |
| Historia | `historia` | eyebrow, title, body, ctaLabel, ctaHref | Imagen en la otra pestaña |
| Personalización | `personalizacion` | eyebrow, title, body, bullets, ctaLabel, ctaHref, whatsappHint, imageOnLeft | Máximo 5 bullets |
| Por mayor | `porMayor` | eyebrow, title, body, bullets, ctaLabel, ctaHref, imageOnLeft | Máximo 5 bullets |
| Voces | `reseñasSection` | eyebrow, title, isActive | La moderación está en Reseñas |
| Selección | `randomProductsSection` | eyebrow, title, subtitle, linkLabel, linkHref, itemLinkLabel, isActive | Hasta 5 productos, renovación en la tienda |
| Inspiración | `inspiracion` | eyebrow, title, subtitle, instagramUrl, ctaLabel | Mosaico en Imágenes, máximo 5 |
| Newsletter | `newsletterSection` | eyebrow, title, subtitle | El pie de Marketing es otro documento |

Guardado: un solo «Guardar inicio». Limpia bullets vacíos y corta a 5. No hay autoguardado. La carga del CMS usa generación: una respuesta vieja no pisa una nueva. Si el GET falla, el formulario no se monta (`F5` / comprobación A26).

Riesgo: envolver campos no puede quitar `name` ni las etiquetas «Marca / claim» y los botones `.cms-tabs--sub`.

### Imágenes

Componente: `HomeImagesTab.jsx`. Endpoints: `GET/POST /api/admin/home-images`, `PATCH /:id`, `PATCH /reorder`, `DELETE /:id`. Almacén: Cloudinary (`uploadHomeImages`, `publicId`). Sin credenciales en este sprint; la subida de prueba no puede ser real.

Secciones (`HOME_IMAGE_SECTIONS`): hero, historia, personalizacion, pormayor, coleccion, inspiracion (máx. 5), editorial1 y editorial2 (máx. 2). Hero, historia, personalización y por mayor no tienen tope de cantidad en el controlador. Colección exige `weaveType`. Hero: la de menor `orden` es la principal (LCP). Cada imagen tiene url, publicId, altText, orden, activo, titulo, linkHref, weaveType, focalX, focalY.

La lista trae todas las imágenes del home y filtra en el cliente por sección. El volumen es el de las fotos del inicio, no un catálogo infinito. No se pagina.

Riesgo: no reordenar ni borrar al cambiar el diseño. Los botones «Subir a Cloudinary», «Guardar datos», «Subir», «Bajar», «Activar», «Desactivar» y «Eliminar» se conservan. El texto «Subir imagen» tiene que seguir visible (recorrido A22).

### Banners

En `ContentWorkspace`. `GET/POST /api/admin/content/banners`, `PATCH/DELETE /:id`. Campos: title, subtitle, imageUrl, linkHref, ctaLabel, placement (`home_mid`, `catalog_top`), sortOrder, isActive. Imagen por `uploadCmsImage` o URL. El formulario estaba siempre abierto al lado de la lista.

### Páginas informativas

`GET/POST /api/admin/content/pages`, `GET/PATCH/DELETE /:id`. Campos: title, excerpt, imageUrl, imageAlt, body (texto con `#`, listas y tallas; no es HTML libre), isPublished, showInFooter, sortOrder, seoTitle (70), seoDescription (160). El slug lo genera el servidor desde el título. «Ver en tienda» abre `/pagina/{slug}`. El formulario estaba siempre visible antes de la tabla.

### Reseñas

`ReviewsTab.jsx`. `GET /api/admin/reviews?aprobado=true|false` devolvía hasta 100, tope 200, orden `createdAt: -1`, sin página ni total. No había `slice` en React, pero una sola respuesta podía traer todo el tope.

Estados reales: `aprobado` verdadero o falso. No hay un tercer estado. `isBrandReview` distingue la voz de marca. El cliente crea pendientes. La marca se publica ya aprobada (`POST /admin/reviews/brand`). Aprobar: `PATCH /:id/approve`. Rechazar o eliminar: `DELETE /:id`. No hay edición de una reseña ya creada.

El índice actual es `{ aprobado: 1, createdAt: -1 }`. No se crea otro índice en este sprint. Recomendación futura, sin aplicarla: el mismo índice más `_id` descendente.

La paginación sí hace falta en el endpoint. Sin `page`, la respuesta anterior se mantiene (límite 100, tope 200) para no romper un consumidor que no envía página.

### Apariencia

`useConfirmedSettings` + `readAppearance` / `validAppearance`. Campos, todos string: siteName, logoUrl, primaryColor, accentColor, bgColor, faviconUrl. `GET/PATCH` de ajustes de tienda. Si la lectura falla o viene incompleta, no hay formulario editable. Eso es F5-A01 y no se toca. El guardado sigue pasando por la máquina de carga confirmada.

## Pruebas que no se pueden romper

- A22: botones `.cms-tabs--sub` de inicio e imágenes, textos «Marca / claim» y «Subir imagen».
- A26: error de CMS sin formulario y sin escrituras hasta reintentar.
- Navegación: seis enlaces «Secciones de Tienda online», texto «Escribir reseña de marca», rutas históricas.
- Apariencia: `input[name=siteName]` y «Guardar apariencia».
- Botones de la tienda pública fuera de alcance.

## Riesgos

- `button` sin clase dentro del `main` ya hereda el botón secundario del sprint 04. Las pestañas de Tienda online necesitan una clase propia para no verse como botones de formulario.
- Ocultar las subsecciones en un `select` rompería A22. La fila única con desplazamiento conserva los botones.
- Compilar el workspace arrastra Marketing aunque no se rediseñe. Los hooks de configuración se cargan igual; el mock de prueba tiene que devolver una configuración válida.
