# Informe Sprint 09 — Creación y edición de productos

Dirección visual: **Operativo Premium Híbrido**. Alcance: `Nuevo producto` y `Editar producto`, que comparten un solo componente (`ProductForm.jsx`).

No hubo commit, push, despliegue, cambio de `.env`, base real, Cloudinary real, migración, índice, correo, pago ni cambio de backend. No se tocaron modelos, endpoints, SKU, máquina de inventario, precios, SEO público ni la tienda.

## 1. Diagnóstico anterior

Estado Git al empezar: solo los cambios sin confirmar del Sprint 08 (propios); ninguno ajeno. Capturas del estado previo en `evidencias-sprint-09/antes/`, sobre Next de producción, Express y Mongo temporal con los mismos datos ficticios.

| Problema del enunciado | Lo que mostraba el código |
| --- | --- |
| Formulario largo, todo abierto | Cinco `<section>` siempre visibles; navegación por anclas de texto pequeño. |
| Campos pequeños a ancho completo | Precio, costo y descuento en filas de 100 %; material solo en su fila. |
| Descripción sin jerarquía | `textarea` de 12 filas fijas y un párrafo de ayuda siempre visible. |
| Acciones repetidas por imagen | «Hacer principal» y «Eliminar» bajo cada una de las 10 miniaturas (20 botones). |
| Variantes siempre expandidas | Cada variante mostraba 6 campos, un `<details>` de ajuste y «Desactivar variante». |
| Guardado solo al final | Botón al pie del formulario: 3.754 px de página en escritorio. |
| Errores difíciles de localizar | Un único mensaje arriba; los `required` nativos fallaban en silencio si el campo no estaba a la vista. |
| Respuesta perdida | Un error sin respuesta permitía volver a enviar a ciegas. |

Altura medida antes (página completa):

| Caso | 1440 px | 390 px | 360 px |
| --- | --- | --- | --- |
| Nuevo producto vacío | 2.658 | 3.378 | 3.433 |
| Editar: 3 variantes, 10 imágenes, descripción extensa | 3.754 | **5.986** | 6.106 |
| Editar: 9 variantes | 5.351 | **8.465** | — |

Restricciones encontradas que condicionaron el diseño (pruebas anteriores que no se modificaron):

- `frontend/test/stock-adjustment.test.cjs` ejecuta `ProductForm.jsx` con un React mínimo (`useState`, `useRef`, `useEffect`), solo resuelve `react`, `next/link`, `next/navigation` y el servicio de catálogo, y espera encontrar en el primer render los campos «Stock variante N», «Cantidad del ajuste», «Motivo del ajuste» y el botón «Registrar ajuste».
- El cierre independiente F1 lee el fuente: `readOnly={!!variant.id}`, la función `handleStockAdjustment` con bloqueo antes de `handleSubmit` y `disabled=` en el botón del ajuste.
- La suite del catálogo (F4/Sprint 03) usa «Información general», «Guardar cambios», `#name`, «Stock variante 1» de solo lectura, «Talla/Color variante 1» no obligatorios y etiqueta de todos los controles.
- Navegación F5 (P07) vuelve con «← Volver a la lista filtrada».

## 2. Arquitectura del editor

Un solo componente para crear y editar. `ProductEditor.jsx` sigue siendo el envoltorio: lee `returnTo` (con `catalogReturn`, sin cambios) y ahora también `section`, e inyecta dos piezas que `ProductForm` no puede importar por la restricción anterior: `AdminConfirmModal` y el renderizador real de la descripción (`ProductDescription`, el mismo de la ficha pública).

- **Cinco secciones** en acordeón: Información general, Imágenes, Precio y promoción, Presentaciones y variantes, Publicación y posicionamiento. Una abierta a la vez; las demás muestran un resumen en su cabecera.
- **Todo sigue montado.** Una sección o variante cerrada solo lleva `hidden`. El estado es un único objeto `form`, como antes: cambiar de sección no borra campos, no reinicia imágenes, no regenera SKU y no guarda nada.
- **Resumen contextual** a la derecha cuando el contenido mide ≥ 60 rem (1440 y 1024 px con barra lateral): imagen principal, nombre, Activo/Inactivo y etiquetas, precio, variantes activas/inactivas, número de imágenes y «Requiere atención» (nombre, categoría, imagen, precio, SKU o combinación repetidos). Cada pendiente abre su sección y enfoca el campo. Solo usa datos del formulario.
- **Barra de guardado** fija al pie del formulario (`position: sticky`), en todas las anchuras: estado («Producto nuevo sin guardar», «Cambios sin guardar», «Guardando…», «Resultado sin confirmar»), «Cancelar» y la única acción principal «Crear producto» / «Guardar cambios». `scroll-padding-bottom` evita que tape el campo con foco; respeta `safe-area-inset-bottom`. El shell móvil no tiene barra inferior propia, así que no hay conflicto.
- Ruta única: sin páginas nuevas. `?section=variants` (o `images`, `price`, `publication`) abre esa sección al entrar.

## 3. Experiencia de creación

- Abre solo «Información general». Las demás muestran: «0 de 10 · falta al menos una», «Sin precio», «1 presentación · 0 unidades», «Activo».
- La variante inicial aparece resumida («Presentación única · SKU PRD-XXXX-01 · 0 unidades · Nueva»), sin formularios vacíos adicionales. El SKU se sigue generando como antes al escribir el nombre (solo en productos nuevos).
- Al crear: una sola petición aunque se pulse dos veces; vuelta a la lista de origen.

## 4. Experiencia de edición

- Abre «Información general» o la sección indicada en `?section=`.
- El SEO histórico se carga y no se regenera.
- Las variantes empiezan resumidas: «S S09 / Natural S09 · SKU: SVF-01 · 8 unidades · Activa».
- Una variante modificada y cerrada conserva su cambio y muestra «Cambios sin guardar».
- **Cambios sin guardar al salir**: con cambios, cualquier enlace interno (volver, cancelar, menú lateral) pide confirmación («Seguir editando» / «Descartar cambios») y una recarga o cierre usa el aviso nativo `beforeunload`. Tras un guardado confirmado no se pregunta nada. No se persiste el borrador en el navegador.

## 5. Organización de secciones

| Sección | Contenido | Resumen en cabecera |
| --- | --- | --- |
| Información general | Nombre (ancho completo), Categoría + Material, Tejido + Estilo/horma, pista de taxonomía, descripción corta con contador 0/300, descripción completa con contador 0/8000, «Formato» y «Vista previa» | «Nombre · Categoría» |
| Imágenes | Subida (si Cloudinary está configurado) o aviso, URL + Agregar, límite, galería | «N de 10 · principal definida» |
| Precio y promoción | Precio, costo interno, descuento (15 rem máx. cada uno) y «En promoción» | «$ 230.000 · promoción 10 %» |
| Presentaciones y variantes | Lista resumida, editor por variante, ajuste de existencias, «Agregar variante» | «3 presentaciones · 16 unidades» |
| Publicación y posicionamiento | Cuatro interruptores con explicación y estado Sí/No, título SEO 0/70, descripción SEO 0/160 | «Activo · Destacado · Nuevo» |

Los `maxLength` y contadores reproducen los límites que ya tenía el modelo (`name` 150, `material` 120, `shortDescription` 300, `fullDescription` 8000, `seoTitle` 70, `seoDescription` 160). No son reglas nuevas.

**Descripción completa**: `field-sizing: content` con altura mínima de 6,5 rem y máxima de 28 rem (luego desplaza y se puede redimensionar). Vacía mide 104 px. El ejemplo largo de 12 líneas pasó del *placeholder* a la ayuda «Formato», porque el navegador dimensionaba el campo vacío según el *placeholder*. «Vista previa» usa `ProductDescription` (mismo parser `# título`, `- viñeta`, `![alt](url)` de la tienda); el texto guardado no se transforma.

## 6. Galería de imágenes

- Cuadrícula de miniaturas cuadradas (`auto-fill`, mín. 5,75 rem): 8 por fila a 1440, 3 a 390.
- Cada miniatura: posición (1–10), etiqueta «Principal» y borde oro en la principal, botón de acciones «⋯» (`aria-label="Acciones de la imagen N"`).
- Menú (`role="menu"`): Hacer principal (no aparece en la principal), Ver ampliada, Eliminar. Teclado: Enter/Espacio abre y enfoca la primera opción; flechas, Inicio y Fin; Escape cierra y devuelve el foco; Tab cierra. Clic fuera cierra. En pantallas < 900 px el menú es una hoja inferior fija con opciones de 48 px (no ensancha el documento).
- «Ver ampliada» (y pulsar la miniatura) abre un `<dialog>` modal nativo; Escape o «Cerrar» devuelven el foco.
- Sin botones repetidos visibles: 0 «Hacer principal/Eliminar» a la vista con 10 imágenes (antes 20).
- Límites sin cambios y verificados en el código: 10 imágenes por producto, 3 archivos por subida, 10 MB por archivo, `accept="image/*"` con la pista JPG/PNG/WebP. Al llegar a 10, la URL y «Agregar» se deshabilitan y se explica cómo liberar un hueco.
- No existía reordenación de imágenes; no se añadió. El orden y la principal se conservan tal cual; eliminar una imagen no cambia la principal (salvo si se elimina la propia principal, que pasa a la primera, como antes).

## 7. Variantes

- Lista resumida: talla/color (o «Presentación única»), SKU, unidades y estado (Activa, Inactiva, Nueva), precio propio si existe, y chips «Cambios sin guardar» o «Revisar».
- «Editar variante» (nombre accesible «Editar variante N») abre solo esa variante. Abrir otra cierra la anterior sin descartar nada: el dato vive en el formulario.
- Campos: talla y color opcionales (sin `required`), SKU, existencias, precio propio, «Activa» (`aria-label="Activa variante N"`).
- «Agregar variante» crea una variante con SKU único (`generateUniqueSku`, la misma función), la abre y enfoca su talla. Los SKU existentes no se regeneran.
- «Quitar variante nueva» solo en variantes sin guardar. Una variante guardada se desactiva con «Activa»; sus existencias se conservan.
- Combinación talla/color repetida y SKU repetido: se abre la variante afectada y se enfoca su campo.

## 8. Inventario

- Existencias de variantes guardadas: `readOnly` (con borde punteado), fuera del cuerpo del guardado (`stock` solo viaja en variantes nuevas, como antes).
- «Ajustar existencias» abre, dentro de la variante, el ajuste relativo existente: cantidad ± entera, motivo, stock previsto, «Registrar ajuste». Misma función `handleStockAdjustment`, misma clave idempotente, mismo bloqueo de doble clic.
- Respuesta perdida o 5xx: se conserva clave y contenido, «Reintentar ajuste» reenvía exactamente la misma operación. Nuevo: «Comprobar resultado del ajuste» consulta la operación por su clave (`getStockOperation`, servicio ya existente) sin reenviar; si no hay constancia, sigue ofreciendo el mismo reintento.
- No se cierra el panel afirmando éxito sin confirmación del servidor.
- Variantes nuevas: existencias iniciales enteras ≥ 0 (un 1,5 se rechaza antes de enviar con «Usa un número entero, sin decimales»).
- Venta concurrente: con el editor abierto se descontaron 2 unidades en la base; el guardado posterior las respetó (8 → 6).

## 9. Precio y promociones

Campos de 15 rem como máximo en rejilla `auto-fill`; COP; costo interno con la nota «Solo administración. No se muestra en la tienda.». El editor sigue limitado a administrador y superadministrador (`RoleRoute`), y el backend sigue retirando `internalCost` a otros roles. No cambió ningún cálculo: el resumen muestra el precio, el descuento y si la promoción está activa, sin calcular un precio final.

## 10. Publicación y SEO

Cuatro interruptores (Activo en tienda, Destacado, Nuevo, Permite personalización) con su explicación y estado Sí/No; el resumen de la cabecera y el lateral dicen cuáles están activos. Los valores no cambian al montar. Título y descripción SEO con contador y los límites del modelo. Si el título SEO se deja vacío se usa el nombre (regla ya existente en `buildPayload` y en el modelo). Un SEO guardado no se regenera.

## 11. Navegación móvil

Divulgación progresiva en todas las anchuras: cinco cabeceras con resumen, una sección abierta. Medidas después:

| Caso (página completa) | Antes | Después |
| --- | --- | --- |
| Editar 3 variantes / 10 imágenes, 390 px | 5.986 | **1.732** (−71 %) |
| Nuevo producto vacío, 390 px | 3.378 | **1.483** (−56 %) |
| 9 variantes, 390 px (sección de variantes abierta) | 8.465 | **1.799** (−79 %) |
| Editar, 1440 px | 3.754 | **1.481** (−61 %) |

En 390 px la descripción extensa sigue visible completa dentro de «Información general»; el resto se abre a demanda. Sin desbordes horizontales en 1440, 1024, 820, 390 y 360 (comprobado en tres páginas por anchura). Sin `overflow-x: hidden` global ni alturas fijas que oculten contenido.

## 12. Accesibilidad

Referencia WCAG 2.2 AA; no se declara conformidad completa.

- Acordeón: `h2 > button` con `aria-expanded`, `aria-controls`; paneles `role="region"` con `aria-labelledby`. Enter y Espacio (probados). Foco visible (anillo de 3 px, interior al botón).
- Menú de imagen accesible por teclado (sección 6); diálogo modal nativo con retorno de foco.
- Errores: resumen `role="alert"` con enlaces que abren la sección y enfocan el campo; cada campo con `aria-invalid` y `aria-describedby` hacia su mensaje; la cabecera de la sección indica «N errores».
- Todos los controles con etiqueta o `aria-label` (incluidos los ocultos). Objetivos de 44 px (cabeceras de 56 px; menú de 48 px en móvil; «⋯» 36 px con puntero fino, 44 con táctil).
- Estado nunca solo por color: «Principal», «Activa/Inactiva/Nueva», «Sí/No», «Cambios sin guardar».
- `prefers-reduced-motion`: la única transición (giro del chevron) se desactiva.
- Contenedor por `container-type`: con texto ampliado el diseño pasa antes a una columna y oculta el lateral.
- axe-core (WCAG 2.0/2.1/2.2 A y AA) en la suite F6 derivada: ver sección 15.

## 13. Archivos modificados

- `frontend/src/components/admin/ProductForm.jsx` — editor (mismas funciones de SKU, carga, subida, ajuste y payload; validación localizada; verificación de resultado desconocido; protección de salida).
- `frontend/src/components/admin/ProductEditor.jsx` — `section`, `AdminConfirmModal`, `ProductDescription`.
- `frontend/src/styles/pages/admin-products.css` — bloque «Sprint 09 · Editor de productos» al final (prefijo `pe-`).
- Nuevos: `frontend/test/sprint09-editor-next-browser.cjs`, `frontend/test/helpers/sprint09EditorFlow.cjs`, este informe y `evidencias-sprint-09/`.

Sin cambios: páginas `nuevo` y `[id]/editar`, servicios, backend, `QuickStockAdjustment`, listado de productos.

Estado Git: durante el sprint el equipo confirmó el commit `f238f01` («Modificaciones del sprint 07 completas»), que incluye el Sprint 08 y una versión **intermedia** de este sprint. Las correcciones finales de la sección 18 (puntos 2, 3, 4, 6, 7 y 8), este informe y la mayor parte de `evidencias-sprint-09/` están sin confirmar en el árbol de trabajo (`git diff f238f01`). La auditoría debe revisar el árbol de trabajo, no solo el commit. Este sprint no creó commits.

## 14. Pruebas

`node frontend/test/sprint09-editor-next-browser.cjs`: Next.js de producción, Express real, MongoDB temporal (réplica de un nodo), usuarios ficticios, imágenes locales de `public/` (sin Cloudinary), red externa bloqueada; fallos inyectados interceptando peticiones del navegador («aplicado pero respuesta perdida» reenvía primero la petición a Express). Resultado: **33/33**, 0 errores de página, 0 de hidratación, 0 peticiones externas (`evidencias-sprint-09/navegador-sprint09.txt`, `despues/navegador.json`).

| # del sprint | Comprobación |
| --- | --- |
| 1 Creación | E04 |
| 2 Edición | E05, E07 |
| 3 Inicialmente compacto | E01, E03b |
| 4 Expandir y cerrar | E02, E32b |
| 5 Conservación de borrador | E02, E17 |
| 6 Cambio de sección | E02 |
| 7 Guardado | E04, E07, E30 |
| 8 Doble clic | E04 (una petición), E23 (ajuste) |
| 9 Respuesta ambigua | E04 (creación, comprobada por SKU), E07 (edición, comprobada contra el servidor), E09 |
| 10 Validaciones | E03, E10, E22 |
| 11 Error en sección contraída | E03 |
| 12 Imagen principal | E12 |
| 13 Imagen eliminada | E13 |
| 14 Orden de imágenes | E14 |
| 15 Diez imágenes | E15 |
| 16 Variantes contraídas | E16 |
| 17 Edición de variante | E17 |
| 18 Agregar variante | E18 |
| 19 SKU único | E19, E10 |
| 20 Combinaciones repetidas | E20 |
| 21 Stock existente protegido | E21 |
| 22 Stock inicial de variante nueva | E22 |
| 23 Ajuste relativo | E23 (fallo ambiguo + reintento con la misma clave: 3 → 7) |
| 24 Venta concurrente con edición | E24 |
| 25 Variantes inactivas | E25 |
| 26 Precio y promoción | E26 |
| 27 Costo interno | E27 |
| 28 SEO | E28, E05 |
| 29 Publicación | E29 |
| 30 Volver a lista filtrada | E30, P07 de F5 |
| 31 Permisos | E31 (vendedor redirigido; API 403 al crear y editar) |
| 32 Teclado | E32, E32b |
| 33 Responsive | E33 |
| 34 Sin regresiones de pedidos e inventario | Sección 15 |

Además E05b (cambios sin guardar). La prueba unitaria `stock-adjustment.test.cjs` (4/4) y los chequeos estáticos de F1 siguen pasando sin cambios.

ESLint de los archivos tocados: 0 errores. Quedan 3 avisos `@next/next/no-img-element` (galería, resumen y ampliación), la misma regla que ya avisaba en HEAD para la lista de imágenes: las URLs del administrador son arbitrarias y `next/image` exigiría autorizar cada dominio.

## 15. Regresión

No se modificó ninguna prueba anterior. Las salidas de las suites antiguas se redirigieron a `evidencias-sprint-09/regresion/` (`preservar-salidas.cjs`). Entorno: `mongod` 8.3.2 local, sin `.env` ni red externa.

| Suite | Resultado | Qué protege aquí |
| --- | --- | --- |
| `stock-adjustment.test.cjs` (dentro de la regresión Node) | 4/4 | Ajuste relativo: doble clic, clave conservada tras fallo, rechazo, dos variantes. |
| Regresión Node F1–F7, cierres independientes, Sprints 01/07/08, checkout y Wompi | 412 pruebas, 381 pasan, 31 fallan | Conjunto de fallos **idéntico** a la línea base de HEAD `910349c` (`comparacion-regresion-node.json`): 29 flujos Wompi y 2 archivos sin el fixture `docs/auditoria-wompi-pedidos`. Pedidos, inventario, finanzas y el cierre F1 (incluidos sus chequeos sobre `ProductForm.jsx`) no cambian de resultado. |
| Catálogo F4 / Sprint 03 (`catalog-workspace-browser.cjs`, componentes reales) | **20/20** | Editar desde la página 2 y volver con filtros, stock de solo lectura y fuera del guardado, ejes opcionales, controles etiquetados, editor sin desbordes a 820/390/360, Existencias y Movimientos. |
| Navegación F5 derivada (solo la sustitución del texto de Movimientos, ver Sprint 08) | PASA completa | P07: «Editar datos» → editor → «← Volver a la lista filtrada» conserva `q` y página. |
| Pulido F6 derivada «continuar» (Sprint 08) | Producto nuevo y editar: 5 anchos sin desbordes, controles etiquetados, contraste básico sin incidencias; **axe WCAG 2.0–2.2 A/AA: 0 infracciones** a 1440 y 360 | Detectó en una ejecución intermedia 1 infracción propia (`target-size` en los enlaces de «Requiere atención»), corregida. A19/A23/A25 siguen «NO SUPERADA» por Productos, Existencias, Movimientos, Taxonomías, Finanzas y el color de Sprint 04, como en el Sprint 08 y sin relación con el editor. Se detiene en A10 (Existencias). |

Las suites originales de navegación F5 y pulido F6 siguen sin pasar completas en HEAD por motivos anteriores (texto de Movimientos eliminado en `38fee86`, axe en otros módulos). Este sprint no las editó.

## 16. Capturas antes/después

`evidencias-sprint-09/antes/` y `evidencias-sprint-09/despues/` (mismos datos ficticios).

| Tema | Antes | Después |
| --- | --- | --- |
| Nuevo producto escritorio / móvil | `nuevo-1440.png`, `nuevo-390.png` | `nuevo-1440.png`, `nuevo-390.png`, `nuevo-parcial-390.png` |
| Editar producto escritorio / móvil | `editar-1440.png`, `editar-390.png` | `editar-1440.png`, `editar-390.png`, `editar-360.png` |
| Galería | `galeria-1440.png` | `galeria-1440.png`, `galeria-menu-1440.png`, `galeria-ampliada-1440.png`, `galeria-390.png` |
| Variantes contraídas | `variantes-1440.png`, `variantes-390.png` | `variantes-contraidas-1440.png`, `variantes-390.png`, `muchas-variantes-390.png` |
| Variante expandida | — | `variante-expandida-1440.png`, `variante-expandida-390.png`, `variante-nueva-1440.png` |
| Ajuste de existencias abierto | `ajuste-abierto-1440.png` | `ajuste-abierto-1440.png` |
| Publicación | `publicacion-1440.png` | `publicacion-1440.png` |
| Error de validación | `error-validacion-1440.png` (el navegador no muestra nada si el campo no está a la vista) | `error-validacion-1440.png`, `variante-nueva-error-1440.png` |
| Guardando / resultado desconocido | `guardando-1440.png` | `guardando-1440.png`, `guardando-390.png`, `resultado-desconocido-1440.png` |
| Vista previa de la descripción | — | `descripcion-vista-previa-1440.png` |

## 17. Problemas encontrados

1. La validación nativa no puede enfocar campos ocultos: con secciones contraídas el envío fallaba sin mensaje.
2. `field-sizing: content` dimensionaba la descripción vacía según el *placeholder* de 12 líneas.
3. La rejilla estiraba grupos vecinos al aparecer un mensaje de error (campo desalineado).
4. Los valores dentro de la variante heredaban la negrita del `<label>`.
5. Las reglas del React Compiler marcaron `Date.now()` en un manejador y una mutación ambigua de `operation`.
6. axe (WCAG 2.2 `target-size`): los enlaces de «Requiere atención» medían 18,6 px de alto y estaban muy juntos.
7. Dos opciones del menú de imagen sin clase recibían el estilo de botón secundario del Sprint 04 (`button:not([class])`).
8. En móvil, la barra de guardado (~85 px) tapaba el botón de una variante situado al pie de la pantalla.
9. Errores propios del arnés detectados en ejecución y corregidos: índice de talla 0 tratado como «sin talla» en el fixture, `.pe-gallery li` contando los elementos del menú, `internalCost` no seleccionado por defecto en Mongo, captura del menú recortada a la miniatura.

## 18. Correcciones

1. `noValidate` + validación propia con `checkValidity()` de cada control y las reglas de negocio existentes; abre la sección (y la variante) del primer error, enfoca el campo y lo anuncia.
2. *Placeholder* de una línea; ejemplo dentro de «Formato».
3. `align-items: start` en las rejillas del editor.
4. `font-weight: 400` en los valores; existencias de solo lectura con fondo y borde punteado.
5. Contador puro para las peticiones de foco y obtención explícita de la operación.
6. Enlaces de al menos 28 px de alto con 0,3 rem de separación; axe sin infracciones después.
7. Clase `pe-menu__item` en todas las opciones del menú.
8. En pantallas estrechas el texto de estado de la barra se oculta visualmente cuando no hay nada pendiente (sigue en el árbol accesible y reaparece con «Cambios sin guardar», «Guardando…» o «Resultado sin confirmar»): la barra queda en ~60 px. `scroll-padding-bottom` sigue protegiendo el campo con foco.
9. Fixture y selectores corregidos; ninguna aserción relajada.

## 19. Riesgos pendientes

- Los SKU de un producto **nuevo** se regeneran al cambiar el nombre, incluso si se editaron a mano (comportamiento previo, no cambiado).
- La protección de salida cubre enlaces internos, recarga y cierre; no intercepta el botón «atrás» del navegador dentro de la SPA (Next no expone una interceptación fiable).
- Respuesta perdida al **crear**: se comprueba buscando el primer SKU. Si el administrador cambia ese SKU antes de comprobar, la búsqueda puede no encontrarlo; el backend sigue rechazando SKU repetidos, así que un reintento no duplica el producto.
- El renderizador de la vista previa es el de la tienda, pero sin la hoja de estilos de la ficha: muestra la estructura (títulos, viñetas, imágenes), no el aspecto final exacto.
- Avisos `no-img-element` (sección 14).

## 20. Recomendaciones para el cierre visual final

1. Usar el mismo patrón de acordeón con resumen y barra de guardado fija en otros formularios largos (contenido de la tienda, cupones) para unificar.
2. Decidir si los SKU de un producto nuevo deben dejar de regenerarse cuando el administrador los editó a mano (cambio de comportamiento; no se hizo).
3. Valorar una reordenación de imágenes (arrastrar o «Mover antes/después») como funcionalidad nueva, con su prueba de orden; hoy no existe.
4. Mantener las restricciones de `stock-adjustment.test.cjs` documentadas en la cabecera de `ProductForm.jsx` o migrar esa prueba a React real, para que futuros rediseños no queden atados a tres hooks.

## Anexo · Correcciones solicitadas tras la entrega (26-11-2026)

Petición del responsable, con capturas de Productos en móvil:

1. **El selector de sección se desbordaba.** En móvil, Productos («Sección») y Pedidos («Bandeja», admin y vendedor) usaban un `<select>` nativo como navegación. Su lista la dibuja el navegador fuera del diseño: no se puede contener ni estilizar. Eran los dos únicos selectores nativos usados para navegar (`grep` de `select` con `router.push`).
2. **Barra superior clara solo en Productos.** Una regla del Sprint 03 (`admin-products.css`) pintaba `.admin-topbar` color marfil en Productos y Configuración del catálogo. En móvil esa barra es grafito con texto blanco, que quedaba casi invisible. Se retiró la regla; en escritorio no cambia nada (la barra es transparente sobre el mismo fondo).
3. **Aspecto del menú.** Se creó `components/admin/AdminSectionPicker.jsx`, compartido por los dos módulos. Es un botón de 48 px con la sección actual (y su contador en Pedidos) que despliega un panel del mismo ancho que el control, con opciones de 46 px, la actual marcada con filete oro y una marca de verificación, y contadores. Las opciones son enlaces reales: URL, historial, recarga y permisos se comportan igual que las pestañas de escritorio. Se cierra con Escape (devuelve el foco), clic fuera o al elegir; flechas, Inicio y Fin recorren las opciones. Estilos en `admin-orders.css` (bloque «Selector de sección/bandeja»), que cargan los paneles de administración y de vendedor. El resto de módulos (Atención, Tienda, Marketing, Finanzas, Configuración) no usan este patrón: tienen pestañas propias.

Archivos: `AdminSectionPicker.jsx` (nuevo), `CatalogWorkspace.jsx`, `OrdersList.jsx`, `admin-orders.css`, `admin-products.css`.

**Prueba anterior adaptada (no relajada):** `frontend/test/sprint02-orders-browser.cjs` leía `select[aria-label="Bandeja de pedidos"].value` y usaba `page.select()`, es decir, el control que se pidió sustituir. Ahora comprueba lo mismo sobre el nuevo control: la bandeja actual (`aria-current`) es «prepare» y elegir «En camino» cambia la URL a `tray=transit` y muestra la bandeja. El resto de aserciones (desborde, altura de tarjetas, pestañas ocultas) no cambió.

Verificación (`evidencias-sprint-09/selector-movil/`):

| Suite | Resultado |
| --- | --- |
| `section-picker-next-browser.cjs` (Next + Express + Mongo) — Productos, Existencias, Pedidos admin y vendedor a 390 y 360; panel dentro de la pantalla, sin desborde, teclado, clic fuera, navegación por enlace, Configuración del catálogo, barra grafito con texto blanco en Productos, Catálogo y Pedidos | 5/5 |
| Pedidos Sprint 02 (adaptada como se indica) | pasa |
| Catálogo F4 | pasa (20) |
| Productos Sprint 03 | pasa |

### Segunda ronda (26–27-11-2026): selectores en todo el panel, Finanzas, Marketing y barrido completo

Petición: el desborde de la lista desplegable aparecía en cualquier selector (por ejemplo «Operación» al ajustar existencias); mejorar el menú de Finanzas en móvil; revisar Marketing en móvil; validar toda la administración sin omitir pantallas.

**1. Selectores (`<select>`) de todo el panel.** Nueva hoja `styles/layouts/admin-controls.css`, cargada al final por los layouts de administrador y vendedor. Todo `select` de una sola opción dentro de `.admin-shell` usa el *select* personalizable del navegador (`appearance: base-select`, Chrome 135+; las pruebas usan Chrome 158). Es el mismo elemento: mismo teclado, lector de pantalla, valor, eventos `change` y `page.select()` de las pruebas. La lista se dibuja dentro de la página, anclada al control, del mismo ancho (`anchor-size`), con máximo `100vw − 1rem`, y se voltea si no cabe. Opciones de 44 px, la elegida con filete oro y marca. Navegadores sin soporte conservan el control nativo. La tienda pública no se toca.

**2. Menús de sección en móvil, mismo criterio en todo el panel.** Hasta 4 secciones: control segmentado en una fila. Más de 4: selector compartido `AdminSectionPicker` (ahora acepta opciones de navegación o de acción).

| Pantalla | Antes en 390 px | Después |
| --- | --- | --- |
| Finanzas (pestañas) | 2 filas | segmentado de 3 |
| Finanzas (periodos, agrupación, filtros de costos) | 2–4 filas, filtro activo en grafito | fila deslizante de chips con el mismo estado oro; fechas en 2 columnas; «Exportar» con rótulo; indicadores en 2 columnas; «Inicio» oculto en móvil (está en el menú) |
| Marketing (pestañas) | fila deslizante; Cupones no las tenía | segmentado de 4, también en Cupones |
| Exportaciones | 2 filas, activa en grafito | segmentado de 4, activa en oro |
| Atención al cliente | 2 filas | segmentado de 2 |
| Tienda online | 6 pestañas deslizantes | selector compartido |
| Reseñas (estado) | segunda pestaña recortada; paginación en 3 líneas | segmentado de 2; paginación ordenada |
| Configuración del catálogo | 5 pestañas en 2 filas | selector compartido (mismo `changeTab`, reinicia el formulario como antes) |

**3. Marketing.** Cupones: fichas compactas sin rótulos repetidos (código y estado; «15% de descuento · 0 usos · Sin vencimiento»; acciones), formulario bajo demanda (abierto si no hay cupones, al editar o con «Nuevo cupón»; siempre montado para F6 A08 y Sprint 06), «Cancelar» siempre disponible, Escape cierra el formulario salvo cuando cierra la lista de un selector. Popup: un solo panel con separadores, sin tarjetas anidadas.

**Defecto propio detectado por el barrido y corregido:** con el *select* personalizable abierto el foco está en la opción; el Escape del formulario de cupón (y del panel «Nuevo usuario») cerraba el formulario entero. Ahora se ignora el Escape que nace dentro de un `select`.

Archivos: `admin-controls.css` (nuevo), `app/admin/layout.js`, `app/vendedor/layout.js`, `AdminSectionPicker.jsx`, `TaxonomyManager.jsx`, `ContentWorkspace.jsx`, `app/admin/cupones/page.js`, `app/admin/usuarios/page.js`, `app/admin/finanzas/page.js`, `FinanceDashboard.jsx`, `admin-finanzas.css`, `admin-marketing.css`, `admin-store.css`, `admin-atencion.css`, `admin-orders.css`, `admin-products.css`.

**Validación** (`evidencias-sprint-09/barrido-movil/`, Next de producción + Express + MongoDB temporal):

| Comprobación | Resultado |
| --- | --- |
| B01 · 34 rutas (administración y vendedor) a 390 y 360 px sin desborde horizontal | pasa |
| B02 · 19 selectores visibles, todos con el selector del panel | pasa |
| B03 · selectores abiertos (ajuste de existencias, categoría, tipo de cupón, módulo de auditoría): lista dentro de la página; Escape la cierra | pasa |
| B04 · menús de sección en una fila o con el selector compartido | pasa |
| Selector de sección (M01–M05) | 5/5 |
| Pedidos S02, Catálogo F4, Productos S03, Atención S04, Marketing S06, Finanzas S07, Configuración S08 | pasan |
| `stock-adjustment` y `admin-fields` (unitarias) | pasan |
| Navegación F5 derivada | pasa completa |
| Pulido F6 derivada | A01–A09 pasan (incluidas A05–A08 de usuarios y cupones). Las infracciones axe de Productos, Existencias, Movimientos y Taxonomías a 360 px **desaparecieron** con el nuevo selector; queda A23 en Finanzas a 1440 y A19/A25 como antes. Se detiene en A10 (preexistente). |
| Tienda S05 | se detiene tras T07 al abrir Reseñas (`networkidle0` agota 30 s). **Mismo fallo en HEAD `bdd22f9`** sin estos cambios: preexistente. Reseñas queda cubierta por el barrido. |

Capturas `b1-*` (primer barrido, con los defectos encontrados) y `b2-*` (final) de cada ruta a 390 px, más `b2-select-*` con listas abiertas.
