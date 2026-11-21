# Cierre independiente de la Fase 6

Fecha: 21 de noviembre de 2026.  
Rol: auditoría de experiencia, accesibilidad y regresión. No se modificó código de aplicación, `.env`, bases reales, correos, pagos, migraciones ni el despliegue. No se crearon commits ni se inició la Fase 7.

Entorno: Node v24.15.0, Google Chrome 158.0.8127.36, axe-core 4.11.4, MongoDB 8.3.2 en memoria. Next de producción en copias temporales, Express del fixture y usuarios ficticios. Las suites oficiales se ejecutaron con un gancho que desvía sus escrituras a `cierre-fase6/reproduccion/`, de modo que las evidencias publicadas por Codex permanecen intactas.

## 1. Resumen ejecutivo

La Fase 6 deja el administrador utilizable, consistente y más seguro de operar en local. Se reprodujeron 292/292 pruebas Node y 195/195 comprobaciones de navegador. F5-A01 sigue bloqueando el guardado cuando la carga de Marketing falla. Los roles no ganan finanzas, recaudo ni historial de inventario. El contador del dashboard coincide con los datos de prueba y la consulta no reescribe el stock.

Queda un defecto visual de severidad media: entre 900 y 1100 px, el listado de taxonomías recorta los botones Editar y Eliminar. El documento no crece de ancho; el recorte ocurre dentro de la rejilla de dos columnas. En 1440 px y en los anchos móviles las mismas acciones se ven completas. No impide el resto de la operación ni altera datos.

**Veredicto: PASS WITH BLOCKERS.**

El cierre funcional local de la Fase 6 queda concedido. La corrección de F6-I01 conviene hacerla antes del QA integral. La autorización de despliegue sigue pendiente de las condiciones externas de las Fases 1 y 2.

## 2. Alcance y metodología

Se leyeron la auditoría original del administrador, los informes de las Fases 1 a 5, los cinco cierres independientes, las correcciones y la revalidación de Fase 5, y el informe, las matrices y las evidencias de Fase 6. Después se contrastó el código vigente: estilos acotados a `.admin-shell`, componentes compartidos, el mensaje de transición repetida y el contador de inventario.

Las aserciones de Codex no se modificaron. Las comprobaciones nuevas viven en `independiente.test.js` y `navegador-independiente.cjs`. La inspección visual usó capturas propias, además de las 165 mediciones reproducidas.

## 3. Archivos inspeccionados

Aplicación: `admin-polish.css`, layouts de administrador y vendedor, `AdminFeedback`, `AdminFormField`, `AdminConfirmModal`, `ContentWorkspace`, `FinanceDashboard`, `OrderDetail`, `AlertBell`, `TaxonomyManager`, páginas de PQR, usuarios, finanzas y alertas, `dashboardAdminController.js`, `orderAdminController.js` e `inventoryCriteria.js`.

La hoja nueva se importa solo desde `app/admin/layout.js` y `app/vendedor/layout.js`. La tienda pública no la carga. No hay `overflow-x: hidden` global. El `overflow: hidden` del cuerpo aparece mientras un diálogo está abierto y la prueba de desmontaje comprobó que se retira al salir de la ruta.

## 4. Reproducción de las 292 pruebas Node

| Resultado | Valor |
| --- | --- |
| Pruebas | 292 |
| Aprobadas | 292 |
| Fallos | 0 |
| Omitidas | 0 |
| Canceladas | 0 |
| Duración | 198138.5446 ms |
| Salida | 0 |

Incluye las Fases 1 a 5, las 31 correcciones, las revalidaciones, los independientes anteriores y las 7 pruebas nuevas de Fase 6. Evidencia: `regresion-292.txt`.

## 5. Reproducción de las 195 comprobaciones de navegador

| Suite | Comprobaciones | Resultado | Duración |
| --- | --- | --- | --- |
| Comunicaciones | 8 | salida 0 | 8450 ms |
| Pedidos | 20 | salida 0 | 16892 ms |
| Catálogo | 20 | salida 0 | 15807 ms |
| Next de navegación | 35 | salida 0 | 84095 ms |
| Independiente de Fase 5 | 10 | salida 0 | 57770 ms |
| Marketing corregido | 25 | salida 0 | 69629 ms |
| Revalidación de Marketing | 18 | salida 0 | 62802 ms |
| Recorrido nuevo de Fase 6 | 59 | `passed: true` | 165503 ms de pared |

Total: 195/195. El recorrido nuevo midió 33 pantallas en 1440, 1024, 820, 390 y 360 px (165 capturas). El ancho del documento no superó el viewport en ninguna. axe-core ejecutó 58 evaluaciones, con etiquetas WCAG 2 A/AA, 2.1 AA y 2.2 AA, y 0 infracciones automáticas. Errores de página, hidratación y peticiones externas: 0. El build aislado de esa pasada terminó con salida 0.

## 6. Pruebas independientes nuevas

Node, 3/3, en `independiente-resultados.json`:

- I6-01. Siete productos ficticios: una variante agotada junto a otra con stock, una con stock bajo y otra abundante, una variante inactiva, un producto solo con variantes inactivas, stock fraccionario, stock ausente y un producto despublicado. Dashboard: 2 agotados y 1 bajo. Alertas: 2 agotados, 1 bajo y 2 en revisión. El producto despublicado no entra. Los documentos quedaron iguales después de consultar.
- I6-02. Finanzas: vendedor 403, administrador 403, superadministrador 200. El vendedor recibe 403 al registrar un recaudo y al leer el historial de inventario. El pedido contraentrega sigue en pago pendiente.
- I6-03. La primera preparación responde «Estado actualizado». La repetición responde «El pedido ya tenía este estado. No se registró una nueva transición.»

Navegador propio, en `navegador-independiente.json` y `capturas/`:

| Comprobación | Resultado |
| --- | --- |
| Carga real de Popup | Aprobada |
| HTTP 500, conexión, JSON inválido e incompleto, con intento de envío | 0 PATCH; título y activación intactos |
| Reintento | Recupera el título real |
| Carga pendiente y respuesta tardía tras salir de la ruta | El botón queda deshabilitado; «Respuesta vieja» no reemplaza el documento |
| Doble clic en Guardar | 1 PATCH; título «Edición de auditoría» |
| PQR en error y reintento | El error desaparece al recuperar la lista vacía |
| PQR con textos largos a 360 px | Desbordamiento del documento: 0 |
| Carrito con correo largo y subtotal grande a 360 px | Desbordamiento: 0; recordatorios deshabilitados |
| Finanzas con cifras de cientos de miles de millones a 360 y 1024 px | Desbordamiento: 0; ningún control fuera del viewport |
| Diálogo tres veces a 360 px, Tab, Shift+Tab, Escape y salida de ruta | Foco inicial en Cancelar, ciclo correcto, diálogo dentro del viewport, sin residuo ni `overflow` atrapado |
| Movimiento reducido | Transición `0s` |
| Texto de 15 a 30 px en 720 px | Sin desbordamiento |
| Contraste de la insignia de la campana | 4.83:1 |
| Vendedor en Finanzas | Redirige a `/cuenta`; el menú no ofrece Finanzas |

La comprobación visual de la repetición del pedido sí mostró el mensaje preciso. El conteo esperado del historial en ese script estaba mal calibrado: el pedido ya trae un asiento inicial y la preparación agrega otro, así que dos asientos después de una repetición que no añade transición son coherentes con I6-03 y con la suite de 59. No se registra como defecto del producto.

El modelo de carrito abandonado no guarda dirección. La prueba usó un correo largo y un subtotal de 987.654.321. La lista muestra esos datos y mantiene el envío de recordatorios apagado.

## 7. Auditoría visual de las pantallas

Se inspeccionaron capturas propias del recorrido reproducido y del recorrido independiente: inicio, pedidos, detalle de pedido, alertas, usuarios, finanzas, taxonomías, Popup, carritos, PQR y el diálogo móvil.

La jerarquía se sostiene. El dashboard antepone «Requieren atención» a las cifras comerciales. Pedidos separa bandejas, filtros y la acción principal. El detalle muestra estado, pago y método con texto, y la siguiente acción explica que el recaudo es posterior a la entrega. Usuarios asocia nombre, correo y contraseña, marca lo obligatorio y ofrece un control de contraseña con área de toque amplia. Marketing separa el popup, el pie de newsletter y la configuración histórica de carritos. Los recordatorios se leen como desactivados y sus campos quedan inhabilitados.

El único recorte que esconde parte de una acción está en el hallazgo F6-I01.

## 8. Evaluación de consistencia del diseño

La capa visual reutiliza la paleta, Verdana en la operación y la fuente editorial en los títulos de página. Botones, campos y foco comparten altura mínima de 44 px, radio y borde. La acción principal es negra; la secundaria es contorno; la destructiva usa el rojo de error. Los estados de pedido, pago y stock llevan texto, no solo color.

Inconsistencia menor: en PQR a 360 px, «Categoría» queda sobre su selector y «Estado» queda a la izquierda del suyo. Ambos se leen y se usan. Es una diferencia de alineación, no un fallo funcional.

## 9. Evaluación de formularios

Los formularios intervenidos bloquean el segundo envío antes del siguiente render. La suite de 59 comprobó un solo POST al crear un usuario inválido y luego uno válido, un solo cupón, un solo cambio de PQR y un solo ajuste de stock con el valor real actualizado. Un rechazo de usuario permanece en `role="alert"` después de más de dos segundos. El cupón conserva el mensaje de éxito al vaciar el formulario.

Marketing, cubierto de nuevo en esta auditoría, no anuncia éxito si la carga falló y no envía un PATCH vacío. El doble clic produce una escritura. Una respuesta tardía, liberada después de abandonar la pantalla, no sustituye el título guardado.

El diálogo compartido se abrió y cerró tres veces. Escape devuelve el control, Tab no escapa del diálogo y confirmar queda detrás de Cancelar en el orden inicial. Al cambiar de ruta durante la apertura no queda diálogo ni bloqueo de desplazamiento.

## 10. Evaluación de tablas y listados

Por debajo de 700 px las tablas administrativas pasan a filas con `data-label`. PQR con un radicado y un motivo largos se lee completo a 360 px, sin controles fuera de la pantalla. Carritos con un correo largo tampoco desborda. Newsletter y carritos conservan la semántica de tabla en la comprobación de la suite oficial.

En escritorio amplio, algunas tablas se extienden dentro de `.admin-table-wrap`, que usa `overflow-x: auto`. El documento sigue midiendo el ancho del viewport. El caso en que eso recorta una acción necesaria es F6-I01.

## 11. Evaluación de dashboard y pedidos

El detalle distingue preparación, despacho, entrega y recaudo. El texto de preparación dice que el recaudo se registra después. La acción principal sigue saliendo del backend. Repetir la preparación no se anuncia como una transición nueva y no agrega historial ni comunicación: lo cubren F6-07, I6-03 y la interacción A20 de la suite de 59.

Despachar y entregar no marcan el pago como cobrado en esa misma suite. El recaudo pide referencia y confirmación aparte.

## 12. Evaluación de inventario y alertas

I6-01 construyó el catálogo y comparó los números con los datos, no solo entre pantallas. Dos productos quedan agotados: el que tiene una variante en cero junto a otra con stock, y el que solo tiene variantes inactivas. Uno queda bajo: stock 2 junto a stock 40. Dos quedan en revisión: stock 1.5 y stock ausente. El despublicado no cuenta. Alertas y dashboard coinciden. La lectura no normaliza el stock histórico.

La campana del recorrido mostró un total coherente con los grupos visibles de esa sesión. No se activó ningún envío.

## 13. Evaluación de Tienda online y Marketing

Popup, Newsletter, Carritos y Apariencia siguen en el editor compartido. Un fallo de carga muestra el error, deshabilita Guardar y rechaza el envío forzado del formulario. La base temporal conserva título y `enabled`. El reintento restaura el formulario. El cargador CMS de la suite oficial también bloquea la edición cuando la consulta falla y se recupera sin escrituras.

Los recordatorios permanecen deshabilitados. No se enviaron correos ni se llamó a Cloudinary: las subsecciones de imágenes de la suite oficial usan archivos locales ficticios.

## 14. Accesibilidad y WCAG

Referencia: WCAG 2.2 AA. No es una certificación.

axe-core 4.11.4, 58 corridas, 0 violaciones en las reglas de las etiquetas `wcag2a`, `wcag2aa`, `wcag21aa` y `wcag22aa`. Quedaron resultados `incomplete`, que exigen revisión manual:

- `color-contrast` en las vistas de 360 px y en Alertas. El cálculo directo de la campana, blanca sobre `rgb(220, 38, 38)` a 9 px, da 4.83:1. Supera 4.5:1 con poco margen.
- `th-has-data-cells` en tablas que a 360 px se redistribuyen como bloques. Las celdas conservan `data-label` visible.
- `aria-prohibited-attr` en Apariencia y Marketing. Los enlaces activos revisados usan `page` o `location`.

Teclado comprobado: menú móvil de la suite oficial, diálogo propio tres veces, Tab, Shift+Tab, Escape, foco inicial, retorno y fondo. No apareció una trampa fuera del diálogo. El texto al 200% en el formulario de Popup no desborda. Con `prefers-reduced-motion: reduce`, la transición administrativa mide `0s`.

No hubo sesión con lector de pantalla. Esa limitación queda explícita.

## 15. Responsive

| Ancho | Resultado reproducido |
| --- | --- |
| 1440 | 33 pantallas; documento igual al viewport; acciones de taxonomía completas |
| 1024 | 33 pantallas; documento sin desborde; taxonomía recorta Editar y Eliminar |
| 820 | 33 pantallas; el menú pasa al cajón; documento sin desborde |
| 390 y 360 | 33 pantallas; PQR, carritos y finanzas, que antes desbordaban, quedan dentro |
| 360 con datos largos | PQR, carritos y finanzas de esta auditoría: desbordamiento 0 |

PQR, carritos y finanzas ya no empujan el documento. La corrección no usa un `overflow-x: hidden` de toda la página. El diálogo a 360 px cabe entre x 15 y x 345.

## 16. Permisos por rol

Superadministrador: finanzas responde 200 y la pantalla se recorre. Administrador: finanzas responde 403. Vendedor: finanzas, recaudo e historial de inventario responden 403; la ruta `/admin/finanzas` termina en `/cuenta` y el menú no muestra Finanzas. El pago del pedido de prueba sigue pendiente. La suite de navegación reproducida cubre además el resto de rutas históricas por rol.

## 17. Regresiones de Fases 1 a 5

Las 285 pruebas Node anteriores y las 136 comprobaciones de navegador anteriores volvieron a aprobar, incluidas Wompi simulado, contraentrega, inventario, comunicaciones, tablero, bandejas, navegación, tienda, exportaciones y F5-A01. El pulido visual no reabrió el guardado con formulario vacío. Una configuración legítima sigue pudiendo editarse después de una carga correcta.

## 18. Lint, sintaxis y build

| Comprobación | Resultado |
| --- | --- |
| Sintaxis JSX/JS y CSS de los archivos cambiados | Todos aprobados |
| ESLint de los 23 archivos frontend intervenidos | 7 errores y 3 advertencias |
| Diagnósticos nuevos frente a la línea base | Ninguno |
| ESLint Node de la comparación | 0 errores |
| `git diff --check` | Salida 0; solo avisos `LF`/`CRLF` |
| `next build --webpack` aislado | Salida 0, sin `.env` y sin red externa |

Los 7 errores son `react-hooks/set-state-in-effect` en Alertas, los dos cargadores de Finanzas, AuditLogList, FinanceDashboard, HomeImagesTab y ReviewsTab. Las 3 advertencias son `react-hooks/exhaustive-deps` en AuditLogList y `@next/next/no-img-element` en HomeImagesTab y OrderDetail. ContentWorkspace queda sin diagnósticos. No se suprimieron reglas. El efecto es de mantenibilidad y de renders encadenados; no se observó una pérdida de datos ni una acción inaccesible atribuible a esos diagnósticos.

El conteo Node de esta pasada incluye también los tres scripts de esta auditoría. No agregan errores.

## 19. Hallazgos por severidad

### F6-I01 — Recorte de acciones en taxonomías

- Severidad: media. Problema de UX. No es un defecto de datos.
- Pantalla: Configuración del catálogo, pestaña Categorías.
- Problema: entre 900 y 1100 px la rejilla sigue en dos columnas y la columna de acciones queda cortada.
- Pasos: iniciar sesión como superadministrador, abrir `/admin/catalogo` con una categoría existente y fijar el viewport en 1024 px.
- Observado: el encabezado se lee «Acc» y el botón Editar muestra solo «E». Eliminar queda fuera de la zona visible. El ancho del documento sigue siendo 1024.
- Esperado: Editar y Eliminar completos, como ya ocurre a 1440 px y por debajo de 700 px.
- Evidencia: `reproduccion/despues/taxonomias-1024.png`, `reproduccion/despues/taxonomias-1440.png` y la entrada de `pantallas.json` que marca el botón fuera del viewport.
- Causa: `admin-products.css` activa `.taxonomy-grid` en dos columnas desde 900 px. `admin-polish.css` aplasta `.admin-grid-2` por debajo de 1100 px y no incluye `.taxonomy-grid`. `.admin-table-wrap` usa `overflow-x: auto`, así que el recorte no ensancha la página.
- Impacto: en un portátil estrecho hay que descubrir el desplazamiento interno para editar o eliminar una categoría. En móvil y en escritorio amplio la tarea se ve completa.
- Recomendación: aplicar a `.taxonomy-grid` el mismo colapso que ya tiene `.admin-grid-2` por debajo de 1100 px. No se implementó en esta auditoría.

No hay hallazgos altos ni críticos. No hay regresión de F5-A01, duplicación de recaudo o de stock, ni exposición de finanzas a un rol no autorizado.

## 20. Limitaciones pendientes

Locales, de baja severidad o fuera de esta certificación:

- F6-I01, descrito arriba, antes del QA integral.
- Alineación del filtro Estado en PQR a 360 px.
- La insignia de la campana cumple contraste por poco margen.
- Los `incomplete` de axe no sustituyen una revisión humana de cada combinación.
- No se usó lector de pantalla.
- Siguen los 7 errores y 3 advertencias de ESLint anteriores.
- Los siete diagnósticos de efectos no se reescribieron en esta fase, salvo el cargador CMS, que ya quedó limpio.

Externas, ajenas a este cierre y todavía pendientes desde las Fases 1 y 2: conjunto de réplicas, procedimiento del índice histórico de idempotencia, Resend real y Wompi autorizado. Nequi directo y manual siguen desactivados. Las notificaciones transaccionales no se encendieron.

## 21. Veredicto final

**PASS WITH BLOCKERS.**

Cierre funcional local de la Fase 6: concedido. Las tareas administrativas auditadas se completan, los formularios no anuncian un éxito falso, F5-A01 permanece cerrado y los permisos se sostienen. F6-I01 es la corrección visual que debe entrar antes del QA integral; no borra datos ni bloquea la operación en los anchos móvil y de escritorio amplio.

Autorización de despliegue: pendiente de las condiciones externas de las Fases 1 y 2. Esta auditoría no las ejecuta y no inicia la Fase 7.
