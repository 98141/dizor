# DIZOR — Corrección F6-I01: acciones de taxonomías

Fecha: 21/11/2026, America/Bogota. Este documento trata el recorte de acciones identificado como F6-I01 en el cierre independiente de Fase 6. Alcance: corrección local y evidencia para revalidación con Cursor. No inicia Fase 7.

## 1. Causa raíz confirmada

Se revisaron el informe técnico de Fase 6, su cierre independiente, las capturas originales y el CSS vigente. El workspace conservaba los cambios de Fase 6 sin commit; se registraron sus huellas antes de comenzar.

`admin-products.css` activa dos columnas para `.taxonomy-grid` desde 900 px. La adaptación de `admin-polish.css` hasta 1100 px solo incluía `.admin-grid-2`. La columna del listado quedaba demasiado estrecha después de reservar los 252 px del menú lateral y los espacios del contenido.

La tabla también heredaba `min-width: 640px`. Su contenedor utiliza `overflow-x: auto`: el documento no desbordaba, pero las acciones quedaban fuera del área visible de la tabla. Las mediciones nuevas confirman este recorte y un desplazamiento interno de 299 px en Categorías a 1024 px con los datos ficticios utilizados. Con nombres extensos el problema también se reproduce en anchos mayores; por eso no bastaba con cambiar únicamente el breakpoint.

## 2. Archivos modificados

**Único archivo de aplicación modificado en esta corrección:** `frontend/src/styles/layouts/admin-polish.css`.

Pruebas nuevas:

- `frontend/test/taxonomy-responsive-next-browser.cjs`: Next de producción y Express aislados, sesiones ficticias y Chrome.
- `frontend/test/helpers/taxonomyResponsiveFlow.cjs`: matriz de anchos, operaciones y teclado.
- `frontend/test/helpers/taxonomyActionVisibility.cjs`: detección de recorte en botones, texto y contenedores.

Documentación y herramientas nuevas: este informe y `correccion-f6-i01-evidencias/`, con README, copias previas, mediciones, capturas, logs, comprobación estática, preservación y ejecutor de regresión.

`TaxonomyManager.jsx`, sus endpoints, modelos, validaciones, permisos y lógica de creación/edición/eliminación permanecen intactos. También se conservan todos los cambios anteriores de Fase 6 y sus evidencias.

## 3. Reglas responsive anteriores

| Regla anterior | Consecuencia |
| --- | --- |
| `.taxonomy-grid`: una columna por defecto | Correcta antes de mostrar el lateral |
| `@media (min-width: 900px)`: taxonomías en dos columnas `1fr / 1.2fr` | El listado perdía espacio justo al aparecer el lateral |
| `@media (max-width: 1100px)`: solo `.admin-grid-2` volvía a una columna | Taxonomías quedaba fuera de la adaptación |
| `.admin-table { min-width: 640px }` | La tabla podía ser mayor que su panel |
| `.admin-table-wrap { overflow-x: auto }` | Ocultaba parte de las acciones sin aumentar el ancho del documento |

Se guarda el CSS exacto previo en `correccion-f6-i01-evidencias/admin-polish-antes.css`. El modo de reproducción anterior lo utiliza únicamente dentro de la copia temporal de Next.

## 4. Solución implementada

Se aplica a `.taxonomy-grid` el mismo patrón de una columna hasta **1100 px, inclusive**, que ya usaba `.admin-grid-2`. Desde **1101 px** se conservan las dos columnas existentes.

Solo dentro de la rejilla de taxonomías se retira el mínimo de 640 px. Se reserva espacio para la columna de acciones, se mantienen completos los textos de Estado y de los botones y se reutiliza la distribución flex con separación entre controles. El nombre del registro puede ocupar varias líneas cuando sea necesario.

La revisión visual intermedia mostró que, aunque los botones ya eran completos, Estado podía partirse en varias líneas. El ajuste final evita esa fragmentación y mantiene Editar y Eliminar alineados también en escritorio amplio.

No se cambian fuentes, tamaños, colores, contraste, estilos de foco ni altura de controles. No se ocultan acciones, no se reduce el texto y no se añade `overflow-x: hidden` global. Las otras tablas conservan sus reglas.

## 5. Capturas antes y después

Se generaron y se inspeccionaron imágenes de la aplicación real. Se reinicia el desplazamiento horizontal de la tabla antes de medir; las capturas completas vuelven al inicio del documento para evitar artefactos de la cabecera fija.

| Ancho | Antes | Después |
| --- | --- | --- |
| 900 | [Categorías](correccion-f6-i01-evidencias/antes/categories-900.png) | [Categorías](correccion-f6-i01-evidencias/despues/categories-900.png) |
| 1024 | [Categorías](correccion-f6-i01-evidencias/antes/categories-1024.png) | [Categorías](correccion-f6-i01-evidencias/despues/categories-1024.png) |
| 1100 | [Límite incluido](correccion-f6-i01-evidencias/antes/categories-1100.png) | [Una columna](correccion-f6-i01-evidencias/despues/categories-1100.png) |
| 1101 | [Límite siguiente](correccion-f6-i01-evidencias/antes/categories-1101.png) | [Dos columnas](correccion-f6-i01-evidencias/despues/categories-1101.png) |
| 1440 | [Escritorio](correccion-f6-i01-evidencias/antes/categories-1440.png) | [Escritorio](correccion-f6-i01-evidencias/despues/categories-1440.png) |
| 820 | [Tablet](correccion-f6-i01-evidencias/antes/categories-820.png) | [Tablet](correccion-f6-i01-evidencias/despues/categories-820.png) |
| 390 | [Móvil](correccion-f6-i01-evidencias/antes/categories-390.png) | [Móvil](correccion-f6-i01-evidencias/despues/categories-390.png) |
| 360 | [Móvil estrecho](correccion-f6-i01-evidencias/antes/categories-360.png) | [Móvil estrecho](correccion-f6-i01-evidencias/despues/categories-360.png) |

Las mismas carpetas incluyen Colores, Tallas, Tejidos y Estilos en todos los anchos. Las mediciones completas están en [antes](correccion-f6-i01-evidencias/antes/mediciones.json) y [después](correccion-f6-i01-evidencias/despues/mediciones.json).

## 6. Anchos probados

Se evaluaron **22 anchos por cada una de las cinco taxonomías: 110 combinaciones**, tanto antes como después:

`360, 390, 699, 700, 701, 820, 899, 900, 901, 1024, 1099, 1100, 1101, 1199, 1200, 1201, 1279, 1280, 1281, 1439, 1440, 1441 px`.

La matriz incluye los siete anchos solicitados y los límites inmediatamente anteriores y posteriores a los cambios de tabla móvil, lateral y rejilla. Cada pestaña se redimensiona sin recarga entre anchos y conserva su URL. En los anchos estrechos el listado queda debajo del formulario y se alcanza mediante desplazamiento vertical normal.

## 7. Visibilidad y accesibilidad de las acciones

En las 110 combinaciones finales, Editar y Eliminar quedan completos, sin recorte horizontal ni necesidad de desplazar internamente la tabla. Los encabezados visibles también caben. El documento mantiene el ancho del viewport.

El comprobador mide el botón y su texto e intersecta los límites de los ancestros con `overflow`. Además comprueba los puntos pulsables de las acciones situadas dentro del viewport con `elementFromPoint`, para detectar superposiciones. No confunde el desplazamiento vertical del listado con un recorte horizontal.

Se comprobó [foco visible en Eliminar a 1024 px](correccion-f6-i01-evidencias/despues/foco-1024.png), uso con mouse y teclado, posición del diálogo, foco inicial en Cancelar, Escape y confirmación de eliminación con teclado. El menú móvil se abre y cierra con Escape y vuelve al lateral al redimensionar, sin recarga.

La prueba adversarial restablece temporalmente las dos condiciones anteriores dentro de Chrome: dos columnas y tabla mínima de 640 px. El comprobador **falla** al reaparecer el recorte, aun con el documento exactamente a 1024 px. Después retira esa hoja temporal y vuelve a aprobar. Esto verifica que la nueva prueba detecta el defecto y no solo el ancho del documento.

## 8. Pruebas ejecutadas

El recorrido específico aprueba **33 comprobaciones**, además de las 110 combinaciones geométricas:

- Cinco recorridos responsive, uno por taxonomía.
- Crear con mouse; iniciar edición y cancelar sin PATCH; editar y guardar con teclado; abrir diálogo y cancelar con Escape; eliminar con teclado. Las cinco operaciones se repiten en cada taxonomía, con llamadas reales a Express y registros temporales.
- Foco visible, detección adversarial del CSS anterior y compatibilidad con el menú.

Los registros tienen nombres cortos y extensos dentro de las validaciones vigentes. Se comprueba por API que las eliminaciones concluyeron. Errores de página, hidratación y peticiones externas del recorrido: ninguno.

Un primer intento de preparación de datos superó el máximo de caracteres de Colores. Se corrigió el dato ficticio del arnés; no se cambió ni debilitó la validación de la aplicación.

## 9. Resultado de la regresión

| Regresión | Resultado |
| --- | --- |
| Línea base Node | 292/292 |
| Pruebas independientes de Fase 6 | 3/3 adicionales |
| **Total Node ejecutado** | **295/295; 0 fallos, omitidos o cancelados** |
| Línea base de navegador | **195/195 aprobadas**; resultados por suite en `regresion-navegador.json` |
| Recorrido nuevo F6-I01 | 33/33 y 110 combinaciones de anchos/taxonomías |

La regresión anterior conserva sus aserciones. Incluye comunicaciones, pedidos, catálogo, navegación, Marketing, F5-A01 y los recorridos de Fase 6. Las escrituras de evidencias se desvían a la carpeta nueva para conservar los informes y capturas publicados.

La huella inicial permite distinguir esta corrección del trabajo previo sin commit. De los 1717 archivos registrados, **1716 permanecen idénticos**; el único archivo existente modificado es `admin-polish.css`. La comprobación incluye también archivos nuevos inesperados fuera de la carpeta de evidencia. Las tres pruebas y este informe son las únicas incorporaciones fuera de esa carpeta. `preservacion.json` y `cambio-css.diff` permiten revisar el alcance exacto.

## 10. Sintaxis, ESLint y build

Sintaxis de los scripts nuevos y del componente real: correcta. CSS: parseado con PostCSS. ESLint de las pruebas nuevas y los componentes de taxonomía: sin errores ni advertencias. El proyecto no configura ESLint para CSS; se comprueba mediante parseo y compilación.

Se comparan los mismos 23 archivos frontend de Fase 6: permanecen los **7 errores y 3 advertencias anteriores, sin diagnósticos nuevos**. No se suprimen reglas ni se realizan correcciones ajenas al defecto.

El build local `next build --webpack` se realiza en una copia temporal, sin `.env` ni credenciales heredadas, con red externa bloqueada. Las compilaciones de los recorridos antes/después terminan con salida 0. `git diff --check`: salida 0.

Evidencia: `estatico.json`, `antes-build.json`, `despues-build.json` y sus logs. Los pasos exactos están en el [README de reproducción](correccion-f6-i01-evidencias/README.md).

## 11. Defectos nuevos y pendientes

No se detectaron defectos funcionales nuevos en las comprobaciones ejecutadas. La fragmentación de Estado detectada en la captura intermedia se corrigió antes de la pasada final. Los avisos de lint previos permanecen fuera del alcance, igual que las observaciones menores y las limitaciones de accesibilidad ya documentadas por la auditoría independiente.

Este trabajo no certifica WCAG completa ni sustituye una revisión humana con lector de pantalla. No se alteraron permisos, pedidos, inventario, pagos, notificaciones ni la tienda pública. No hubo bases reales, edición de `.env`, migraciones, correos o pagos reales, commits, pushes ni despliegues.

Los pendientes de infraestructura productiva de fases anteriores se mantienen separados de este defecto local y no se validaron aquí.

## 12. Estado final de F6-I01

**Corregido y verificado localmente**, con evidencia visual y detección automática del recorte. Editar y Eliminar son completos y utilizables en los anchos solicitados y sus límites, con las cinco taxonomías operativas.

Preparado para revalidación independiente de Cursor antes del QA integral. El veredicto independiente corresponde a esa revisión. No se inició Fase 7.
