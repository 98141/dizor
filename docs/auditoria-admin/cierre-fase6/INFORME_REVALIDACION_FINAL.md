# Revalidación independiente de F6-I01

Fecha: 21 de noviembre de 2026.  
Rol: revalidación de la corrección visual. No se modificó código de aplicación, `.env`, bases reales, correos, pagos, migraciones ni el despliegue. No se crearon commits ni se inició la Fase 7.

Entorno: Node v24.15.0, Google Chrome del equipo, MongoDB 8.3.2 en memoria, Next de producción en copias temporales y Express del fixture. Las escrituras de las suites de Codex se desviaron a `revalidacion-evidencias/`; sus evidencias publicadas conservan la hora anterior a esta revisión.

## 1. Resumen ejecutivo

F6-I01 queda **corregido**. En el CSS vigente, Editar y Eliminar se ven completos y se pueden accionar en Categorías, Colores, Tallas, Tejidos y Estilos, desde 360 px hasta 1440 px, incluidos 900, 1024 y 1100 px. La misma pantalla, compilada con la hoja anterior en una copia aislada, vuelve a recortar esas acciones a 1024 px sin ensanchar el documento. La corrección no reabrió las 295 pruebas Node ni las 195 comprobaciones de navegador.

**Veredicto general: PASS WITH BLOCKERS.**

El cierre funcional local de la Fase 6 se mantiene y el QA integral de la Fase 7 puede comenzar en local. Esta revisión no lo inicia. La autorización de despliegue sigue pendiente de las condiciones externas de las Fases 1 y 2.

## 2. Causa original de F6-I01

`admin-products.css` pone `.taxonomy-grid` en dos columnas desde 900 px, el mismo punto en el que aparece el menú lateral de 252 px. Hasta esta corrección, `admin-polish.css` devolvía a una columna solo `.admin-grid-2`, hasta 1100 px inclusive. La tabla de taxonomías conservaba `min-width: 640px` y `.admin-table-wrap` usa `overflow-x: auto`. El documento medía el ancho del viewport, pero Estado, Editar y Eliminar quedaban fuera del área visible del listado.

La copia aislada con `admin-polish-antes.css` lo reprodujo en Categorías a 1024 px: dos columnas, encabezado y acciones recortados, documento igual a 1024. Evidencia: `revalidacion-evidencias/reproduccion-codex/antes/categories-1024.png`. El modo anterior de la suite termina con `reproduced: true`; esa salida confirma que el defecto reaparece, no que la versión vieja estuviera bien.

## 3. Corrección inspeccionada

El único cambio de aplicación frente a la hoja preservada está en `frontend/src/styles/layouts/admin-polish.css`. El diff está en `revalidacion-evidencias/css.diff`.

- Hasta 1100 px inclusive, `.taxonomy-grid` usa la misma columna única que `.admin-grid-2`.
- Desde 1101 px se mantienen las dos columnas de `admin-products.css`.
- Dentro de `.taxonomy-grid`, la tabla pasa a `min-width: 0`, Estado no se parte y los botones no se rompen en dos líneas.
- La columna de acciones reserva `12.5rem`.
- No se añadió `overflow-x: hidden`. El desplazamiento interno de la tabla sigue existiendo como regla general, pero en las mediciones nuevas el ancho de contenido y el ancho visible coinciden.

`TaxonomyManager.jsx`, las rutas, los modelos y los permisos no cambiaron. La hoja sigue importándose solo desde los layouts de administrador y vendedor.

## 4. Pruebas de los breakpoints

Recorrido propio, con registros de nombre largo, en 15 anchos y las cinco taxonomías: 75 combinaciones, 0 incidencias. Duración del proceso: 101413 ms. Salida 0. Build aislado: salida 0, sin `.env` y sin credenciales heredadas.

En Categorías, el documento coincidió con el viewport y el contenedor de la tabla no tenía desplazamiento horizontal sobrante:

| Ancho | Columnas | Relación formulario/listado | Tabla visible / contenido | Botones |
| --- | --- | --- | --- | --- |
| 360, 390, 700 | 1 | apilados | iguales | Editar 68×44, Eliminar 83×44 |
| 820, 899 | 1 | apilados | iguales | completos |
| 900, 1024, 1099, 1100 | 1 | apilados, con lateral desde 900 | iguales | completos |
| 1101, 1280, 1440 | 2 | uno al lado del otro | iguales | completos |

También se midieron 699, 701 y 901. En 700 la tabla ya está en bloques con etiqueta; en 701 vuelve a filas y las acciones siguen dentro. En 899 el lateral aún no aparece y la rejilla es de una columna; en 900 el lateral aparece y la rejilla se mantiene en una columna.

Al retirar la corrección dentro de la página ya compilada, a 1024 px la rejilla volvió a dos columnas, el mínimo de la tabla pasó a 640 px y el contenedor midió 341 px visibles frente a 640 px de contenido. Editar y Eliminar quedaron recortados. El documento siguió en 1024. Al quitar esa hoja temporal, la vista corregida se recuperó. Captura: `revalidacion-evidencias/capturas/defecto-reproducido-1024.png`.

## 5. Resultados por taxonomía

Las 75 combinaciones cubren Categorías, Colores, Tallas, Tejidos y Estilos. En todas, a 1024 px, el formulario queda arriba, el listado debajo y los dos botones completos. Los nombres largos ocupan varias líneas. La pestaña activa conserva `aria-pressed="true"` y la URL (`tab=colors`, luego el regreso a `tab=categories`).

Una carga forzada con HTTP 500 mostró «Fallo de auditoria». La recarga siguiente devolvió el listado y retiró el error.

Capturas a 1024 px: `capturas/categories-1024.png`, `capturas/colors-1024.png`, `capturas/sizes-1024.png`, `capturas/weave-types-1024.png`, `capturas/styles-1024.png`.

## 6. Visibilidad y geometría real de los botones

La medición no se conforma con que el botón exista en el DOM. Para cada acción se tomó el rectángulo del control y el del texto, se cruzó con los ancestros que recortan u ocultan en horizontal, se reinició `scrollLeft` a cero y se comprobó el centro con `elementFromPoint` cuando el botón estaba en el viewport.

En las 75 combinaciones el texto cabe en el botón, ningún ancestro lo recorta y el centro pulsable es el propio botón. El encabezado visible también cabe. Capturas de Categorías pedidas para esta revisión:

- 900 px: `revalidacion-evidencias/capturas/categories-900.png`
- 1024 px: `revalidacion-evidencias/capturas/categories-1024.png`
- 1100 px: `revalidacion-evidencias/capturas/categories-1100.png`
- 1440 px: `revalidacion-evidencias/capturas/categories-1440.png`
- 390 px: `revalidacion-evidencias/capturas/categories-390.png`

La suite de Codex, reproducida sin cambiar aserciones, recorrió 22 anchos por taxonomía y aprobó 33/33 comprobaciones. Su prueba adversarial también detecta el recorte aunque el documento no desborde.

## 7. Pruebas de teclado y accesibilidad

En Categorías a 1024 px:

- Tab llega a Eliminar y Shift+Tab vuelve a Editar.
- El foco visible es un contorno sólido de 3 px, color `rgb(138, 85, 3)`.
- Enter abre la edición. Cancelar con teclado no envía PATCH y conserva el nombre.
- Enter sobre Actualizar guarda el nombre nuevo.
- Eliminar abre un diálogo `aria-modal="true"`, con nombre «Confirmar acción». El foco inicial es Cancelar.
- Tab y Shift+Tab circulan entre Cancelar y Eliminar. Escape cierra, devuelve el foco a Eliminar y restaura el desplazamiento del cuerpo. El registro sigue existiendo.
- Una confirmación posterior sí elimina, y la API solo retira ese registro temporal.
- Las pestañas se activan con teclado y la selección se conserva al volver.

Contraste calculado en el navegador: pestañas y Editar, blanco sobre negro o negro sobre blanco, 17.4:1. Eliminar, `rgb(155, 44, 44)` sobre `rgb(254, 242, 242)`, 6.88:1. Altura de esos controles: 44 px.

El nombre accesible de cada botón es su texto visible, «Editar» o «Eliminar». No incluye el nombre del registro. Eso ya estaba en `TaxonomyManager.jsx`, que esta corrección no tocó. No es una certificación WCAG. No hubo sesión con lector de pantalla.

`.admin-grid-2`, el otro selector del mismo media query, sigue en una columna a 1024 px y en dos a 1101 px en Usuarios.

## 8. Recorrido integrado

Con sesión de superadministrador ficticio, en Next y Express aislados:

1. Entrada a `/admin`.
2. Apertura de Productos y de Configuración del catálogo por el enlace del menú.
3. Alta de una categoría desde el formulario.
4. Edición cancelada, sin PATCH.
5. Edición guardada con teclado.
6. Diálogo de eliminación cancelado con Escape.
7. Eliminación confirmada solo del registro creado en la prueba.
8. Cambio a Colores y regreso a Categorías.
9. Cambio de ancho a 1440, 1024 y 390 con las acciones todavía completas.

El vendedor que abre `/admin/catalogo` termina en `/cuenta`. Sus POST, PATCH y DELETE de categorías responden 403. El administrador crea un estilo y recibe 201; a 1024 px también ve la columna única y los botones completos.

## 9. Regresiones ejecutadas

| Suite | Resultado | Duración |
| --- | --- | --- |
| Node de Fases 1 a 6, correcciones, revalidaciones e independientes | 295/295, 0 fallos, 0 omitidas | 280449.8297 ms |
| Navegador previo: 8 + 20 + 20 + 35 + 10 + 25 + 18 + 59 | 195/195, salida 0 | 472291 ms |
| Suite nueva de taxonomías, modo corregido | 33/33 | 131134 ms |
| Suite nueva, copia aislada con el CSS anterior | defecto reproducido | 86305 ms |
| Recorrido geométrico propio | 75/75 | 101413 ms |

Las aserciones anteriores no se modificaron. Las evidencias originales de la corrección no se sobrescribieron.

## 10. Sintaxis, lint y build

| Comprobación | Resultado |
| --- | --- |
| Sintaxis de los scripts de la corrección y de `TaxonomyManager.jsx` | Aprobada |
| PostCSS de `admin-polish.css` | Aprobado |
| ESLint de taxonomía y del diálogo | 0 errores |
| ESLint de los 23 archivos frontend de Fase 6 | 7 errores y 3 advertencias, 0 diagnósticos nuevos |
| ESLint de los scripts nuevos | 0 errores |
| `git diff --check` | Salida 0; solo avisos de `LF`/`CRLF` |
| `next build --webpack` aislado | Salida 0 |

Los 7 errores siguen siendo `react-hooks/set-state-in-effect` y las 3 advertencias siguen siendo `exhaustive-deps` y `no-img-element`, ya documentados. No se suprimieron reglas.

## 11. Defectos nuevos

No aparecieron defectos nuevos de visibilidad, teclado, permisos ni regresión funcional en las comprobaciones ejecutadas.

El nombre accesible repetido de Editar y Eliminar queda como observación previa, fuera de esta corrección de CSS. No impide ver ni accionar los controles.

## 12. Limitaciones externas

Siguen pendientes, y esta revisión no las ejecuta: conjunto de réplicas, procedimiento del índice histórico de idempotencia, Resend real y Wompi autorizado. Nequi y las notificaciones transaccionales permanecen apagados. No hay certificación WCAG completa ni prueba con lector de pantalla.

## 13. Veredicto final

**F6-I01: CORREGIDO.**

Editar y Eliminar quedan completos, dentro del área visible y accionables en los anchos relevantes y en las cinco taxonomías. La causa se corrigió en la rejilla y en el mínimo de la tabla. La versión anterior, compilada aparte, todavía muestra el recorte.

**PASS WITH BLOCKERS.**

Cierre funcional local de la Fase 6: se mantiene, ahora con el defecto visual cerrado. El QA integral de la Fase 7 puede empezar en local. Esta auditoría no lo inicia.

Autorización de despliegue: pendiente de las condiciones externas de las Fases 1 y 2.
