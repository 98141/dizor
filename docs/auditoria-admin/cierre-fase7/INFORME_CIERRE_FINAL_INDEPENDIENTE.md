# Cierre independiente final de las siete fases

Fecha: 21 de noviembre de 2026.  
Rol: auditoría final de solo lectura. No se modificó código de aplicación, `.env`, bases reales, correos, pagos, migraciones ni el despliegue. No se crearon commits.

Entorno: Node v24.15.0, Chrome headless, MongoDB 8.3.2 en memoria, Next 16 con `next build --webpack` en copias temporales, Express del fixture y usuarios `example.test`. Las escrituras de las suites se desviaron a `cierre-fase7/evidencias/`. Las evidencias publicadas de Fase 7 conservan su hora anterior.

## 1. Resumen ejecutivo

Las siete fases pueden declararse terminadas en local. No apareció un defecto nuevo de integridad de pedidos, pagos, inventario, permisos, fechas financieras o navegación que impida cerrar el desarrollo.

**Veredicto: PASS WITH BLOCKERS.**

El cierre funcional local queda concedido. La puesta en producción no queda autorizada. Siguen pendientes la infraestructura de MongoDB, la migración de índices históricos, Wompi en un entorno autorizado, Resend con buzón real y varias decisiones comerciales que el producto deja explícitas.

## 2. Metodología

Se leyeron la auditoría ADM-01 a ADM-39, los informes de las Fases 1 a 6, sus cierres y revalidaciones, el informe de Fase 7, el manual y el checklist. Se contrastó el código vigente de `financePeriod.js`, `financeService.js` y `financeAdminController.js` con ese informe.

Se reprodujeron las suites sin cambiar aserciones. Las comprobaciones nuevas usan otros datos: bordes del día civil, estados que no deben entrar a ventas, repetición de clave, última unidad y un fallo de carga de Marketing. El recorrido de compra se reprodujo con la interfaz real, no con llamadas directas a controladores presentadas como E2E.

## 3. Estado del repositorio

Las Fases 1 a 6 están en commits hasta `05f1811`. El trabajo de Fase 7 sigue sin commit. Los únicos archivos de aplicación modificados y sin commit son:

- `backend/src/utils/financePeriod.js`
- `backend/src/services/financeService.js`
- `backend/src/controllers/financeAdminController.js`

El diff de esos tres archivos es de 72 inserciones y 106 eliminaciones. El resto de Fase 7 son pruebas, evidencias, el manual y el checklist, todos sin commit. No hay cambios de tienda pública en ese diff.

## 4. Pruebas reproducidas

Cada fila es un conjunto distinto. Las 295 Node no se vuelven a sumar dentro de las 19 nuevas ni dentro de las 4 independientes.

| Conjunto | Ejecutadas | Aprobadas | Fallos | Omitidas | Duración | Salida |
| --- | --- | --- | --- | --- | --- | --- |
| Node de Fases 1 a 6 e independientes previos | 295 | 295 | 0 | 0 | 325538.8553 ms | 0 |
| Node nuevo de Fase 7, Q01–Q19 | 19 | 19 | 0 | 0 | 23188.8387 ms | 0 |
| Navegador previo, ocho suites | 195 | 195 | 0 en la pasada válida | 0 | ver nota | 0 tras reintento de navegación |
| Taxonomías F6-I01 | 33 | 33 | 0 | 0 | 99701 ms | 0 |
| Compra integrada por interfaz | 20 comprobaciones | 20 | 0 | 0 | 162916 ms | 0 |
| Sintaxis, ESLint comparado y `git diff --check` | ejecutado | sin diagnósticos nuevos | 0 nuevos | 0 | 36911 ms | 0 |
| Build aislado del recorrido de compra | 1 | 1 | 0 | 0 | incluido en el recorrido | 0 |

La primera pasada de navegación, ejecutada al mismo tiempo que el recorrido de compra, agotó 30 segundos al esperar la URL `tab=sizes` después de activar Tallas con teclado. El resto de esa pasada no llegó a completar las 35 comprobaciones. Repetida sola, la misma suite terminó con `passed: true` y salida 0. No se cuenta dos veces. No se trata como defecto del producto: la suite de taxonomías, que también cambia de pestaña, aprobó en la misma máquina, y la repetición aislada aprobó.

Evidencia: `cierre-fase7/evidencias/reproduccion/regresion-node.txt`, `phase7-node.txt`, `reproduccion/regresion-navegador.json`, `navegacion-reintento.txt` y `e2e.txt`.

## 5. Pruebas independientes nuevas

Cuatro pruebas propias, 4/4, 19821.9871 ms, salida 0. Resultado en `cierre-fase7/evidencias/independiente-resultados.json`.

- I7-01. El 20 de noviembre de 2026 va de `2026-11-20T05:00:00.000Z` a `2026-11-21T04:59:59.999Z`. Un instante a las 23:30 del día anterior en Bogotá queda en el 19. El mes de noviembre, diciembre y enero, la semana ISO `2026-W47`, el cambio de año y la semana `2026-W53` coinciden con el calendario civil. Fechas inexistentes y rangos invertidos responden 400. El mismo resultado aparece con `TZ` en UTC, America/Bogota, Pacific/Kiritimati y Pacific/Honolulu.
- I7-02. Ocho pedidos ficticios alrededor del 20 de noviembre. Solo dos pagos limpios entran al día. Un cancelado, uno en revisión, uno reembolsado y uno pendiente quedan fuera de las ventas conciliadas. El pendiente sí queda por cobrar. Gráfica, reporte y CSV coinciden en 2 pedidos y 200000. Noviembre y 2026 cuentan 4 conciliados, que son los cuatro pagos limpios del mes. La lectura no modifica los documentos ni `createdAt`.
- I7-03. Repetir la misma clave deja un pedido y el stock en cero. Dos compras simultáneas de la última unidad dejan una aceptada, una en 409, stock cero y un pedido. El dashboard no reescribe pedidos. El vendedor recibe 403 al exportar finanzas y al ajustar stock. El administrador recibe 403 en el reporte. El superadministrador recibe 200.
- I7-04. Una carga de Marketing que falla deja el estado `load-error`, bloquea el guardado y no llama a la escritura. Una respuesta tardía, liberada después de cancelar la carga, no deja el recurso en estado listo para guardar.

## 6. Resultados E2E

El recorrido reproducido usa Next de producción, Express, Mongo temporal, formulario real de acceso, Wompi interceptado en local y bandeja de correo ficticia. `passed: true`, errores de página e hidratación vacíos. Las URLs de `checkout.wompi.co` quedaron marcadas `simulated: true`; no hubo una conexión aceptada al proveedor.

Quedaron comprobados, por la interfaz:

- Contraentrega con respuesta perdida y reintento de la misma clave: un pedido y un descuento.
- Preparación, despacho, corrección de guía, entrega y recaudo con evidencia. El pago permanece pendiente hasta el recaudo.
- Wompi con un solo envío ante doble clic, webhook simultáneo con un descuento y una notificación, preparación después de la aprobación, y rechazo que no cancela, no descuenta y no permite preparar.
- Dos navegadores por la última unidad: una compra y una negativa.
- Vendedor sin finanzas ni historial de inventario.
- Outbox con aceptación simulada e idempotencia por clave. No acredita llegada al buzón.

## 7. Corrección F7-01

La causa descrita coincide con el código anterior y con la corrección: una fecha civil ya no se interpreta como medianoche UTC para luego moverla con la zona del proceso. `financePeriod.js` fija el día con `America/Bogota` y el desfase `-05:00`. El reporte, la gráfica y la exportación usan ese cálculo.

El 20 de noviembre de 2026 es el día civil colombiano, de las 00:00 a antes de las 00:00 del 21. Un pedido de las 23:59:59.999 del 19 no entra. Uno de las 00:00 del 21 tampoco. Un timestamp con zona se conserva como instante y no se expande al día completo. Una fecha imposible o un intervalo invertido responden 400. El resultado no cambia al variar `TZ`.

La política contable no se redefinió. Sigue contando como venta conciliada un pedido pagado que no esté cancelado, rechazado, devuelto, en revisión ni con una incidencia sin resolver. El costo interno de la pieza de prueba es mayor que su precio; la gráfica muestra margen negativo y el historial muestra el mismo número. Es coherencia del cálculo, no un ingreso inflado.

## 8. Pedidos y pagos

Despacho y entrega no confirman el recaudo. El vendedor no registra el cobro. Wompi sin aprobación no abre la preparación. Un rechazo no cancela ni descuenta. Una aprobación repetida no descuenta dos veces. El administrador dispone de consultar y conciliar; el manual y la interfaz no ofrecen una aprobación manual. Q11, reproducida dentro de las 19, cubre una aprobación tardía después de cancelar: el dinero queda en revisión y fuera de las ventas. I7-02 confirma que cancelado, reembolsado y revisión no entran al ingreso del día.

## 9. Inventario

Q01 a Q10, dentro de las 19, cubren ajuste relativo, edición simultánea, restauración por cancelación, webhook junto a un ajuste, última unidad, SKU concurrente sin índice global nuevo, stock ausente o fraccionario sin normalizar, y recuperación de un ajuste con la misma clave. I7-03 confirma la última unidad y que una repetición de compra no descuenta otra vez. La lectura del dashboard no reescribe pedidos. No se creó ningún índice.

La protección concurrente de SKU sigue siendo de servicio, no un índice único global. Eso permanece como riesgo de datos históricos y de migración, no como una sobreventa reproducida en esta revisión.

## 10. Comunicaciones

Q13 y Q19, más el outbox del recorrido, mantienen plantillas con escape, aceptación simulada, idempotencia por clave y recuperación de un trabajador interrumpido sin tocar pedido ni inventario. `deliveredAt` sigue vacío cuando solo hay aceptación. El fallo de ese transporte no cambió el pedido ni el stock en Q19. La entrega externa permaneció apagada. No se afirma llegada a un buzón.

## 11. Permisos

Superadministrador: finanzas 200. Administrador: reporte 403. Vendedor: exportación, ajuste de stock, finanzas e historial de inventario en 403, y la interfaz del recorrido no le ofrece Finanzas. Esos resultados coinciden con el manual.

## 12. UX/UI

El manual y los controles revisados usan los mismos nombres para Entrar, Comenzar preparación, Registrar envío y despachar, Confirmar despacho, Corregir guía, Guardar corrección de guía, Confirmar corrección de guía, Volver sin confirmar, Registrar entrega, Confirmar entrega, Registrar recaudo, Confirmar recaudo, Consultar y conciliar con Wompi, Cancelar pedido, Registrar devolución, Actualizar pedido, Registrar ajuste y Abrir conversación en WhatsApp.

La bandeja separa por preparar, por despachar, en camino, pendientes de recaudo y revisión. Contraentrega puede prepararse con pago pendiente. Wompi no. El pulido de Fase 6 y las taxonomías se reprodujeron sin un defecto nuevo de operación.

El botón de una comunicación pendiente dice «Reintentar pendiente». El manual lo nombra «Reintentar». El significado operativo está en la pantalla y en la frase del manual sobre el proveedor. Es una diferencia de rótulo, no una acción distinta.

## 13. Accesibilidad

La suite de Fase 6, reproducida aquí, incluye axe-core, foco, diálogos, texto ampliado y movimiento reducido, y terminó con salida 0. No se repitió una certificación WCAG ni una sesión con lector de pantalla. Los nombres accesibles de Editar y Eliminar en taxonomías siguen siendo el texto visible, repetido por fila. Es una observación ya registrada, no un cierre de barrera nueva. Los resultados `incomplete` de axe de Fase 6 siguen exigiendo revisión humana; esta pasada no los convierte en violaciones ni en certificación.

## 14. Responsive

La suite de taxonomías midió cinco pestañas en 22 anchos, incluidos 900, 1024, 1100, 1440 y móvil, y aprobó 33/33, con la prueba que vuelve a detectar el recorte si se restaura el CSS anterior. El recorrido de finanzas de la compra integrada revisó cinco anchos después de una compra real. No se encontró un control necesario oculto en esas pasadas.

## 15. Matriz ADM-01 a ADM-39

Clasificación usada: CV corregido y verificado en las suites reproducidas; M observación menor; I infraestructura o datos históricos; E proveedor externo; D decisión comercial.

| ID | Estado en esta revisión |
| --- | --- |
| ADM-01 a ADM-07 | CV. Despacho no cobra, transiciones y Wompi siguen en el servidor, un pago tardío no reabre la venta, metadatos no pisan el stock. |
| ADM-08 | CV en la restauración y el aviso. El reembolso automático sigue siendo D: no existe y el manual lo dice. |
| ADM-09 | CV en la carrera local. Firma y webhook reales siguen en E. |
| ADM-10 | CV en la numeración local. Los números históricos no se reescribieron. |
| ADM-11 a ADM-13 | CV en outbox, plantillas y recuperación local. Recepción real y worker de producción siguen en E. |
| ADM-14, ADM-15 | CV. Notas internas fuera del DTO público ya cubiertas; el enlace Wompi no prepara el pedido. |
| ADM-16, ADM-17 | CV. Bandejas separadas. Nequi sigue desactivado. |
| ADM-18, ADM-19 | CV en la clasificación por variante y en no normalizar stock inválido. El saneamiento histórico es I/D. |
| ADM-20 | CV con F7-01 e I7-02. Cancelados, reembolsos y revisión no entran al ingreso. |
| ADM-21 | E/D. Se conserva la expiración informada. No hay validación real de Wompi ni una cancelación inventada por antigüedad. |
| ADM-22 | D. La carrera de cupón quedó contenida; reutilizar el cupón tras cancelar no está decidido. |
| ADM-23, ADM-25, ADM-26 | CV. Costos, bandejas, errores visibles y búsqueda literal. |
| ADM-24, ADM-27 | CV. La acción sale del backend. La guía se corrige solo donde el estado lo permite. |
| ADM-28 | I. El esquema local se probó. La migración del índice real no se ejecutó. |
| ADM-29 a ADM-33 | CV. Navegación, envío incluido, catálogo, fechas de Bogotá y shell del vendedor. La repetición aislada de navegación aprobó. |
| ADM-34 | M/I. Los hechos nuevos quedan trazados. No se reconstruye evidencia histórica incompleta. |
| ADM-35 | CV en validación de checkout. No acredita identidad ni entrega del correo. |
| ADM-36 | CV en el escape de las plantillas probadas. |
| ADM-37 | CV. No hay una asignación nueva a personal no autorizado. |
| ADM-38 | D/M. Métodos históricos se conservan. POS, manual y Nequi no se habilitaron. |
| ADM-39 | M. El pulido se reprodujo. Quedan lint previo, nombres repetidos y la revisión humana. No es certificación WCAG. |

No se marcó como cerrado un requisito que depende de producción, de un proveedor o de una decisión que el código deja abierta.

## 16. Hallazgos posteriores

F5-A01 sigue cerrado: las suites de Marketing y de revalidación aprobaron, e I7-04 impide guardar cuando la carga falla o cuando la respuesta llega tarde.

F6-I01 sigue cerrado: 33/33 en la suite de taxonomías.

F7-01 queda verificado con I7-01 e I7-02, además de Q15, Q17 y Q18.

No hay un defecto local nuevo con prioridad alta. La primera caída de navegación queda explicada en la sección 4.

## 17. Rendimiento

Q16, dentro de las 19, cargó 1200 pedidos ficticios y 120 productos y respondió 200 en las rutas medidas. El plan reproducido de la agregación de productos usa `COLLSCAN` sobre esa colección temporal. Es una muestra local, no un límite de producción ni una orden para crear índices. Medir el volumen real queda en el checklist.

## 18. Documentación operativa

El informe de Fase 7 distingue desarrollo local, auditoría independiente y despliegue. Esa separación coincide con este cierre. El veredicto `READY WITH ISSUES` de Codex no se aceptó por el documento: se acepta el cierre local porque las suites y las pruebas nuevas lo sostienen, y se mantienen las observaciones que ese informe no ocultó.

## 19. Manual administrativo

Los pasos de pedido, la separación entre entrega y recaudo, los límites del vendedor y la prohibición de aprobar Wompi a mano coinciden con la interfaz y con las pruebas. El manual no promete reembolso automático, recordatorios de carrito ni recepción real de correo. La diferencia de rótulo «Reintentar» / «Reintentar pendiente» es la única desviación de nombre encontrada y no cambia la tarea.

## 20. Checklist de despliegue

`CHECKLIST_DESPLIEGUE_PENDIENTE.md` deja todas las casillas abiertas. Incluye respaldo y restauración, replica set, migración de índices, datos históricos, Wompi sandbox, Resend, activación controlada, verificación de pedidos, monitoreo y rollback. Ninguna se ejecutó ni se marca completa.

## 21. Diagnósticos técnicos

Sintaxis de los tres archivos financieros y de los scripts de Fase 7: aprobada. ESLint de los 23 archivos frontend de Fase 6: 7 errores y 3 advertencias previos, 0 nuevos. ESLint del alcance backend: 1 error previo, `productId` asignado y no usado en `financeService.js` línea 329, 0 errores nuevos. `git diff --check`: salida 0, con el aviso habitual de `LF`/`CRLF`. No se suprimieron reglas.

Ese `productId` es deuda de mantenimiento. No cambia el total conciliado: el costo de la línea sale de `getItemUnitCost`.

## 22. Defectos locales abiertos

No hay un defecto local abierto que impida declarar terminado el desarrollo. Quedan observaciones que no bloquean el cierre funcional:

- Nombres accesibles genéricos en acciones repetidas de taxonomía.
- Siete errores y tres advertencias de ESLint frontend, y el `productId` sin uso.
- El rótulo del manual para el reintento de una comunicación es más corto que el botón.

## 23. Pendientes externos

Infraestructura y datos: replica set de destino, backup restaurable, índice histórico de idempotencia, índice duplicado de `requestNumber`, índice único global de SKU y stock histórico inválido. No se migró nada.

Proveedor: Wompi real, firma, vigencia y webhooks; Resend, dominio, buzón y rebotes.

Decisiones comerciales todavía abiertas: reutilizar un cupón después de cancelar, recuperar un checkout cuyo resultado no pueda confirmarse, resolver incidencias de dinero y ejecutar reembolsos. El sistema no las resuelve solo, y el manual lo dice.

## 24. Veredicto final

**PASS WITH BLOCKERS.**

**A. Desarrollo funcional local.** Terminado. Las siete fases quedan cerradas en local, con las observaciones menores de la sección 22 y sin un defecto crítico o importante pendiente dentro de lo ejecutado.

**B. Auditoría independiente final.** Este informe. No sustituye una certificación WCAG ni una prueba con lector de pantalla.

**C. Preparación para despliegue.** No autorizada. El checklist sigue íntegramente pendiente. Hacen falta backup, MongoDB compatible con transacciones, migración planificada de índices, Wompi sandbox y Resend real antes de cualquier puesta en producción.

**D. Decisiones comerciales abiertas.** Cupón tras cancelación, checkout de resultado incierto, incidencias de pago y reembolsos. No forman parte de un defecto de las siete fases; siguen fuera del comportamiento automático.
