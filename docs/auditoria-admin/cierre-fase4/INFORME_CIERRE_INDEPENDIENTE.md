# Cierre independiente — Fase 4, productos, variantes e inventario

Fecha de la auditoría: 21 de noviembre de 2026.
Entorno: Windows, Node v24.15.0, MongoDB 8.3.2 en replica set efímero. No se usó Atlas, `.env`, datos reales, correos, pagos, Cloudinary ni un servidor de desarrollo abierto.

## 1. Resumen ejecutivo

**Veredicto de la Fase 4: PASS WITH BLOCKERS.**

Productos, variantes e inventario pueden considerarse cerrados en el entorno local. La lista pagina en el servidor, el ajuste rápido es relativo e idempotente, el historial solo registra movimientos confirmados y el vendedor no escribe catálogo ni ve el costo interno de prueba. La reproducción de las 210 pruebas terminó en 210 aprobadas y 0 fallos. Seis pruebas nuevas, con última unidad, venta contra ajuste, cancelación, webhook, SKU concurrente y datos históricos, también terminaron aprobadas.

Ese resultado cierra el comportamiento funcional local. La autorización de despliegue sigue pendiente de la topología que confirma transacciones, de la migración del índice de idempotencia de pedidos, de la aceptación real de Resend y del enlace Wompi autorizado.

## 2. Archivos revisados

Informes de las Fases 1 a 4, los cierres independientes anteriores y `docs/auditoria-admin/fase4-evidencias/`.

Backend: `catalogWorkspace.js`, `inventoryCriteria.js`, `catalogMutationService.js`, `stockAdjustment.js`, `productAdminController.js`, `productHistoryAdminController.js`, `productHistoryService.js`, `inventoryService.js`, `product.js`, `productHistory.js`, `adminCatalogRoutes.js` y `adminAlertController.js`.

Frontend: `CatalogWorkspace.jsx`, `QuickStockAdjustment.jsx`, `ProductForm.jsx`, `ProductEditor.jsx`, `ProductHistoryList.jsx`, `AlertBell.jsx`, la página de alertas y las rutas de productos e inventario.

Pruebas: `backend/test/phase4.test.js` (V01–V42) y `frontend/test/catalog-workspace-browser.cjs` (C01–C20). Sus aserciones no se modificaron. El árbol de la fase está sin commit. `backend/package.json` solo añade el script `test:phase4`.

## 3. Resultado de las 210 pruebas

Comando, con el desvío que conserva los JSON de los cierres anteriores:

`node --require ./docs/auditoria-admin/fase4-evidencias/preservar-evidencias.cjs --test --test-concurrency=1`

| Suite | Pruebas |
|---|---|
| Fase 1 | 57 |
| Fase 2 | 53 |
| Cierre de Fase 1 reutilizado | 5 |
| Fase 3 | 34 |
| Fase 4, V01–V42 | 42 |
| Independientes de Fase 2 | 9 |
| Independientes de Fase 3 | 6 |
| Ajuste de stock en el formulario | 4 |
| Total | 210 |

Resultado de esta ejecución: **210 aprobadas, 0 fallos, 0 omitidas**. Duración del runner: 137,3 s. Salida: `regresion-210.txt`. Resumen: `reproduccion-210.json`.

El informe de Codex reportó 210/210 en 108,1 s. La diferencia es de tiempo. El conteo y el resultado coinciden.

## 4. Pruebas independientes añadidas

Archivo: `independiente.test.js`. Resultado registrado: **6/6 en 13,0 s**. Evidencia: `independiente-resultados.json` y `independiente-ejecucion.txt`.

| Id | Qué comprueba | Resultado |
|---|---|---|
| F4-I01 | Dos compras de la última unidad dejan stock 0 y una sola venta. Un ajuste +2 concurrente con una venta termina en 9. Dos variantes del mismo producto se ajustan a la vez y quedan en 6 y 7. | Aprobada |
| F4-I02 | Dos administradores suman +1 y +4. La clave del primero no sirve al segundo ni para consultar su resultado. Cancelar y retirar a la vez deja el saldo en 4. Un webhook aprobado concurrente con un ajuste +1 deja el pago en `pagado`, una venta, un ajuste y el stock original. | Aprobada |
| F4-I03 | La misma clave repetida no crea otro movimiento. Otra cantidad con esa clave responde 409. Un retiro imposible queda rechazado y un reintento tardío no mueve stock. Lista, alertas e historial no cambian `updatedAt`. | Aprobada |
| F4-I04 | El stock 2,5 sigue siendo 2,5 y bloquea el ajuste. El stock ausente no se convierte en cero. Un producto sin variantes sigue sin variantes. El SKU de un movimiento ya registrado no cambia al renombrar la variante. | Aprobada |
| F4-I05 | Dos altas simultáneas con el mismo SKU producen una sola creación. Después de ese rechazo, otra alta con SKU distinto se crea. Dos ediciones que reclaman el mismo SKU dejan un solo dueño. | Aprobada |
| F4-I06 | Umbral 5, producto mixto, variante inactiva, búsqueda literal, página fuera de rango, PDF filtrado, vendedor, cliente, anónimo y desactivación con Wompi pendiente. | Aprobada |

La segunda compra de la última unidad respondió 400 en la comprobación previa de carrito; la primera respondió 201. El saldo quedó en 0 y hubo una sola venta.

## 5. Evaluación de productos y variantes

La creación y la edición pasan por `mutateCatalog`. Dentro de la transacción se comprueba el SKU, se conserva el identificador de las variantes existentes y el stock de esas variantes no entra en el payload de edición. Una variante nueva sí puede nacer con stock entero. Talla y color son opcionales: una presentación puede identificarse solo por SKU. Dos presentaciones activas sin talla ni color se tratan como la misma combinación y se rechazan, aunque el SKU sea distinto. Una sola presentación sin ejes sí se acepta.

Borrar desactiva la publicación y conserva variantes, pedidos e historial. Un Wompi pendiente, con inventario todavía sin aplicar, bloquea esa desactivación con 409.

`CatalogWriteGuard` serializa las escrituras de metadatos. Las ventas y los ajustes no lo usan. No existe un índice único de `variants.sku`. En la prueba concurrente la protección de aplicación bastó: una alta ganó, la otra respondió 400 y el control quedó libre para la alta siguiente. Un camino que escribiera el producto fuera de `mutateCatalog` podría saltarse esa protección. Las rutas administrativas de crear, editar y desactivar sí la usan. La carga de imágenes cambia la galería, no el SKU.

## 6. Integridad de inventario

El ajuste envía un delta, no un stock absoluto. El saldo previsto de la pantalla es orientativo. El resultado medido coincidió con la suma de los movimientos confirmados:

- última unidad: 1 − 1 = 0;
- venta concurrente con ajuste: 8 − 1 + 2 = 9;
- dos administradores: 10 + 1 + 4 = 15;
- cancelación y retiro: 5 − 1 + 1 − 1 = 4;
- aprobación Wompi y ajuste: 6 − 1 + 1 = 6.

Cantidad cero, fracción, entero inseguro y saldo negativo se rechazan. Un stock histórico de 2,5 no se redondea y el ajuste ordinario responde 409 sin crear movimiento. Un stock ausente se muestra ausente. Una variante inactiva conserva sus unidades y no entra en la disponibilidad ni en las alertas. Una publicación desactivada deja `availableStock` en 0.

El formulario rápido guarda la intención en `sessionStorage` con la clave `dizor-stock:<actor>:<producto>:<variante>` antes de la petición. El servidor exige la misma clave, el mismo actor, la misma variante, el mismo delta y el mismo motivo. La consulta de resultado de otro administrador devuelve `found: false` y no aplica el ajuste.

## 7. Concurrencia e idempotencia

Las carreras de F4-I01, F4-I02 y F4-I05 dejaron stock, historial y dueño de SKU consistentes. La misma clave produjo un movimiento y la repetición llegó con `repeated: true`. Cambiar el delta de esa clave respondió 409. El rechazo de stock insuficiente quedó en estado `rejected`; la petición tardía volvió a rechazarse y el saldo no se movió.

El doble clic del panel real, en Chrome, generó una sola petición (C05). Una respuesta perdida después de aplicar se recuperó con «Comprobar resultado» sin un segundo envío (C08). Una respuesta perdida antes de aplicar conservó la misma clave al reintentar (C09). Un rechazo definitivo devolvió el formulario para corregir la solicitud (C10).

No se provocó un fallo artificial del historial fuera de V35, que ya forma parte de las 210 y volvió a pasar: si el movimiento no se confirma, la transacción revierte el stock.

## 8. Historial de movimientos

El movimiento de ajuste guardó producto, variante, SKU, tipo `stock_adjustment`, cantidad, saldo anterior, saldo posterior, motivo y responsable. El filtro por SKU, variante y tipo devolvió exactamente ese movimiento, con saldos 5 y 6. Después de renombrar el SKU, la fila antigua conservó el SKU original.

La venta y la reposición por cancelación quedan separadas: la venta usa `sale` y la reposición usa `stock_adjustment` con origen de pedido. En la carrera de cancelación el saldo final correspondió a una venta, una reposición y un retiro.

El PDF filtrado por SKU respondió 200, comienza con `%PDF` y pesó 2.163 bytes. El PDF del SKU inexistente pesó 1.999 bytes. El texto del SKU va comprimido dentro del archivo, así que la prueba compara el tamaño y contrasta el historial JSON, que sí devuelve una sola fila. El límite documentado de la exportación sigue en 5.000 filas. Una operación rechazada no creó movimiento.

## 9. Alertas

El umbral de cinco unidades vive en `inventoryCriteria.js` y lo comparten la lista, el resumen y `alertGroups`. La campana y la página de alertas consumen ese resultado. En la prueba:

- stock 5 entra en «bajo»;
- stock 6 no entra;
- una variante en 0 junto a otra en 12 clasifica el producto como agotado y no lo duplica en «bajo»;
- la variante inactiva y el producto despublicado no aparecen;
- el stock 2,5 queda en revisión.

Los enlaces de la página de alertas apuntan a `productId` y `variantId`. En Chrome, abrir esa selección dejó el foco en la variante M y mostró «Stock bajo» (C04).

El payload del dashboard de pedidos sigue calculando agotados y bajos con la suma del producto y el literal `<= 5` de `dashboardAdminController.js`. En el mismo fixture, las alertas reportaron 1 producto agotado y ese contador reportó 0. La pantalla actual de pedidos no muestra ese número. La tienda pública repite el literal 5 en `ProductoClient.jsx`. El criterio visible del catálogo, la campana y las alertas sí está centralizado.

## 10. Permisos

Administrador y superadministrador crearon, editaron, ajustaron, consultaron movimientos y desactivaron publicaciones en las pruebas HTTP.

El vendedor pudo listar. Su JSON no incluyó `424242` ni `internalCost`. Recibió 403 al ajustar stock, crear, cambiar precio, desactivar y leer el historial. En Chrome no vio costo interno, ajuste ni desactivación (C15).

El cliente autenticado recibió 403 en el catálogo administrativo. El anónimo recibió 401. La ausencia de botones no fue la prueba de autorización: los endpoints rechazaron la escritura.

## 11. Evaluación UX/UI

El trabajo diario cabe en Productos, Existencias, Movimientos y el editor.

Encontrar un producto usa nombre o SKU y deja el término en la URL. Las variantes agotadas se ven con la etiqueta «Agotado», las bajas con «Stock bajo» y el texto de la vista explica que un producto con ambos estados aparece en Agotados. El ajuste se abre junto a la variante: cantidad, motivo, stock previsto y confirmación. La frase de la pantalla dice que otras ventas pueden cambiar el resultado. Publicación y existencias están separadas: desactivar conserva las unidades. El historial se abre por producto o por variante y muestra responsable. Carga, error, lista vacía y búsqueda sin coincidencias tienen textos distintos.

Recomendaciones visuales, que no impiden el trabajo:

- La campana, en stock bajo, muestra el total del producto. Si otra variante tiene muchas unidades, esa cifra es mayor que la de la variante baja. El enlace sí abre la variante afectada.
- Dos presentaciones activas sin talla ni color no pueden convivir. Quien necesite distinguirlas tiene que asignar un eje o desactivar una.
- El editor deja el stock de las variantes existentes en solo lectura y remite al ajuste. Esa separación es clara en el formulario móvil.

## 12. Navegador y responsive

Se compilaron los componentes reales de catálogo, ajuste, historial, editor y shell, con CSS real y una API HTTP ficticia. Chrome headless ejecutó **C01–C20, sin errores de página y sin solicitudes externas**. Copia: `navegador-reproduccion.json`. Capturas: `capturas/`.

| Vista | Escritorio 1440 | Tablet 820 | 390 px | 360 px |
|---|---|---|---|---|
| Productos | Revisada | Revisada | Revisada | Revisada |
| Existencias | Revisada | Revisada | Revisada | Revisada |
| Movimientos | Revisada | Revisada | Revisada | Revisada |
| Editor | Revisada | Revisada | Revisada | Revisada |

El recorrido midió que el documento no supera el ancho del viewport. En las capturas, Existencias muestra las tres presentaciones con su estado y su botón de ajuste; el móvil de 360 px apila las fichas, el precio y la paginación; el editor móvil muestra talla y color opcionales y el stock existente bloqueado. El foco del confirm quedó en el botón al abrirse. Los controles comprobados tienen etiqueta.

**Pendiente:** una sesión Next.js autenticada contra el backend de pruebas. No se inició para no interferir con un servidor local ni leer `.env`. Los recorridos anteriores son componentes reales con API simulada, no esa sesión integrada.

## 13. Rendimiento

V42, dentro de las 210, creó 1.201 productos y 3.601 variantes. La petición completa devolvió 20 filas y 400 coincidencias en **85,3 ms** en esta corrida. Codex había medido 42,3 ms en el mismo tipo de fixture. La diferencia es del proceso local. El plan usa el índice `category_1_weaveType_1_style_1`, después examina los documentos de esa categoría para la búsqueda literal y calcula el estado antes de paginar. No se añadió ningún índice. Esta cifra no describe producción.

Los índices de producto presentes son `_id`, `slug`, `isActive+isFeatured`, `category+weaveType+style`, `salePrice` y el índice de texto del nombre. No hay índice único de SKU ni índice de stock. El historial sí tiene índice único parcial de `movementKey`.

Mejoras futuras, no aplicadas aquí: un índice de SKU después de revisar duplicados históricos, y acotar la búsqueda no anclada cuando el catálogo crezca. La paginación ya limita lo que viaja al navegador.

## 14. Lint, sintaxis y build

Quince archivos Node: sintaxis correcta, 0 fallos. ESLint explícito de backend: 0 errores y 1 aviso, `no-unused-vars` por `fmt` en el controlador de historial. La base de esos archivos tenía 2 avisos. `newMessages` quedó vacío.

ESLint de las pantallas de la fase: 3 errores y 1 aviso, todos previos. Los errores son `react-hooks/set-state-in-effect` en `AlertBell.jsx` y en la página de alertas, y `react-hooks/purity` por `Date.now` en alertas. El aviso es `@next/next/no-img-element` en `ProductForm.jsx`. La base comparada tenía 5 errores y 2 avisos. Los archivos nuevos del catálogo no añaden diagnósticos.

Build aislado de Next.js con webpack: salida 0, copia temporal, sin `.env`, sin credenciales heredadas y con `fetch` y TCP bloqueados. Evidencia: `build-reproduccion.json`.

No hay dependencias nuevas. Las plantillas de correo y la máquina de pedidos no están en el diff de esta fase. El aviso del índice duplicado de `requestNumber` vuelve a aparecer al cargar Mongoose y es anterior.

## 15. Hallazgos nuevos por severidad

**Alta:** ninguna.

**Media:** ninguna.

**Baja:**

1. El contador de agotados del dashboard de pedidos usa la suma del producto. En el fixture, las alertas vieron 1 producto con una variante en cero y ese contador vio 0. La pantalla de pedidos no lo muestra.
2. La unicidad de SKU depende de `CatalogWriteGuard` y de la comprobación en la transacción. No hay índice único. Las dos altas HTTP concurrentes quedaron en un solo producto.
3. Dos variantes activas sin talla ni color se rechazan como combinación repetida. Una variante sola, sin ejes, se acepta.
4. La campana muestra el total del producto en la línea de stock bajo. El enlace abre la variante afectada.
5. La tienda pública conserva su propio literal 5, separado del criterio administrativo.

Ninguna de estas observaciones duplica stock, pierde un SKU histórico ni autoriza al vendedor a ajustar existencias.

## 16. Regresiones de fases anteriores

Las 57 pruebas de Fase 1, las 5 de su cierre, las 53 de Fase 2, las 34 de Fase 3, las 9 independientes de notificaciones, las 6 independientes de pedidos y las 4 del ajuste de stock volvieron a pasar dentro de las 210.

Checkout, contraentrega, Wompi, cancelación, recaudo, bandejas y permisos del vendedor sobre pedidos siguen cubiertos por esas suites. La bandera `TRANSACTIONAL_NOTIFICATIONS_ENABLED` permaneció en `false`. La observación de saltos de línea en el texto plano del correo y el cupón que no libera su uso al cancelar siguen fuera de esta fase.

## 17. Limitaciones

Siguen pendientes, y este cierre no las convierte en aprobadas:

- Infraestructura donde las transacciones de pedidos se confirman, y la migración del índice de idempotencia antes de usar datos históricos.
- Aceptación real de Resend, entrega al buzón y enlace de pago Wompi en un entorno autorizado.
- Subida real a Cloudinary. El formulario conserva la vía existente; no se enviaron imágenes al proveedor.
- Sesión integrada de Next.js con el backend de pruebas.
- Certificación con lector de pantalla. El teclado se comprobó en el foco del confirm y en el foco de la variante abierta desde una alerta.
- Conciliación de stocks históricos inválidos. La fase los señala y rechaza el ajuste ordinario; no los reescribe.

No se ejecutaron migraciones, no se crearon índices y no se modificó la aplicación.

## 18. Veredicto final

**PASS WITH BLOCKERS.**

El cierre funcional local de Productos e inventario queda sostenido por las 210 pruebas reproducidas, las 6 pruebas nuevas y el recorrido de los componentes reales en Chrome. El stock, el historial, los permisos y las referencias de variante se mantienen consistentes en las carreras y en los datos históricos probados.

La autorización de despliegue queda pendiente de las verificaciones externas de las Fases 1 y 2 enumeradas en la sección 17. Esta auditoría no inicia la Fase 5.
