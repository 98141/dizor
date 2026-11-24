# Informe de cierre independiente — Fase 1 DIZOR

Fecha de la auditoría: 20 de noviembre de 2026.  
Alcance: revisión de solo lectura de la Fase 1 ya presente en `develop` (`35de057253fdd899d40974fe084ad688792489a4`).  
Esta auditoría no modificó código de aplicación, no creó commits, no desplegó y no se conectó a bases, pagos ni correo reales.

## Veredicto

**FAIL.** El cierre funcional local no se aprueba.

La máquina de pedidos, pagos e inventario sí sostiene las reglas principales bajo concurrencia: las 57 pruebas originales volvieron a pasar y la mayoría de las pruebas nuevas también. Dos defectos funcionales del propio alcance de la fase impiden declararla cerrada:

1. El historial financiero que alimenta la gráfica del administrador cuenta pedidos pagados cancelados y pedidos con incidencia.
2. El ajuste de stock del formulario de producto puede aplicarse dos veces si el administrador pulsa el botón antes de que React guarde la clave de idempotencia.

**Despliegue: no autorizado.** Además de esos defectos, faltan la confirmación de que producción usa un replica set o `mongos`, la migración controlada del índice de idempotencia y la validación externa en el sandbox de Wompi.

---

## 1. Resumen ejecutivo

La Fase 1 está en el commit `35de057` (“Fase uno de mejora de admin completa, corriendo aparte la mejora del home”, 20 de noviembre de 2026, 15:11, autor `98141`). El árbol de trabajo no contiene cambios de esa fase. Lo no confirmado es trabajo de Home y esta carpeta de auditoría.

Se reejecutaron las 57 pruebas de `backend/test/phase1.test.js` en un replica set temporal, con datos ficticios y la red externa bloqueada: **57 aprobadas, 0 fallos, 17,1 s**. MongoDB local **8.3.2**. El informe de desarrollo citaba 7.0.24; la reproducción es válida, pero no es el mismo binario.

Se añadieron 38 comprobaciones propias. Resultado: **33 PASS, 3 observaciones, 2 defectos**. No hay sobreventa en la última unidad, los webhooks idénticos descuentan una vez, un pago aprobado sobrevive sin stock, una aprobación posterior a la cancelación no reactiva el pedido y el vendedor no ejecuta operaciones financieras. Esas comprobaciones se hicieron por HTTP contra la aplicación, no por inspección.

Los dos defectos están reproducidos:

| Id | Qué ocurre | Evidencia |
| --- | --- | --- |
| I16b | `GET /api/admin/finance/history` suma 3 pedidos y $160.000 cuando el reporte conciliado suma 1 pedido y $80.000. Los otros dos son un cancelado de $50.000 y uno con `requiresReview` de $30.000. | `independiente-resultados.json` |
| I19c | Registrar recaudo, cambiar estado y registrar ajuste no se inhabilitan mientras la petición está en curso. El ajuste genera una clave nueva en cada clic. | Código de `ProductForm.jsx` y `OrderDetail.jsx`; el backend sí es idempotente si la clave se reutiliza (I08b) |

El build de frontend compiló. ESLint de los archivos de la fase sigue en 6 errores y 4 advertencias, los mismos ya comparados con `HEAD` en la evidencia de desarrollo. No apareció un error de lint nuevo en esa lista. La revisión visual de escritorio y móvil no se completó: ya había un `next dev` del proyecto en el puerto 3000 y no se detuvo para no interrumpir el trabajo local.

---

## 2. Alcance y metodología

Se leyeron por completo:

- `docs/auditoria-admin/informe-auditoria-admin-2026-11-20.md`
- `docs/auditoria-admin/informe-fase1-integridad-2026-11-20.md`
- `backend/test/phase1.test.js`
- `backend/test/README.md`
- `docs/auditoria-admin/evidencias/` (resumen, comparación de lint, salida de pruebas y sintaxis)

Después se inspeccionó el commit, el `git status` y el código de pedidos, pagos, inventario, finanzas y las pantallas tocadas por la fase. El informe de desarrollo se usó como hipótesis, no como evidencia.

Entorno de pruebas:

- Node v24.15.0.
- MongoDB `C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe`, versión 8.3.2. `mongodb-memory-server` pedía 8.2.6 y usó el binario del sistema. El aviso queda en los logs.
- Replica set de un nodo en memoria. Datos ficticios. `NEQUI_DIRECT_ENABLED` vacío. Proveedor de pago sustituido. `fetch` a hosts distintos de localhost bloqueado. Intentos externos registrados: `[]`.
- Las pruebas no leen `.env` ni arrancan `server.js`.
- No se usaron credenciales de sandbox, no se llamó a Wompi, no se envió correo y no se ejecutó `syncIndexes` sobre ninguna base real.

La salida de la suite independiente termina con código 1 porque el arnés exige cero defectos y encontró dos. El JSON se escribe antes de esa aserción. Ese código 1 es el hallazgo, no un fallo del arnés.

---

## 3. Archivos revisados

Commit de la fase: `35de057`, padre `2dfd9ea`. El mensaje dice que Home corre aparte, pero el commit también incluye `HomeHero.jsx`, `HomeSectionIntro.jsx`, `variables.css` y `home.css`. Desplegar ese commit publicaría esos cambios de Home junto con la fase.

Trabajo local no confirmado, ajeno a esta auditoría y no modificado por ella: páginas y componentes de Home, `home.css`, `inspirationLayout.js`. Esta auditoría solo añadió `docs/auditoria-admin/cierre-fase1/`.

Archivos de la fase revisados en código, además de los documentos obligatorios:

- `backend/src/services/orderTransitions.js`, `orderOperations.js`, `transactionService.js`, `inventoryService.js`, `orderService.js`, `wompiPaymentService.js`, `wompiService.js`, `financeService.js`
- `backend/src/controllers/checkoutController.js`, `orderAdminController.js`, `wompiWebhookController.js`, `productAdminController.js`, `financeAdminController.js`, `nequiController.js`
- `backend/src/models/order.js`, `paymentEvent.js`, `product.js`, `productHistory.js`, `coupon.js`, `specialRequest.js`
- `backend/src/routes/adminOrderRoutes.js`, `backend/src/config/db.js`, `backend/src/app.js`, `backend/.env.example`, `README.md`
- `frontend/src/components/admin/OrderDetail.jsx`, `ProductForm.jsx`, `OrdersList.jsx`
- `frontend/src/app/(shop)/checkout/page.js`, `frontend/src/app/(shop)/cuenta/page.js`
- `frontend/src/app/admin/finanzas/page.js`, `frontend/src/services/financeAdminService.js`

`financeAdminController.js` no está en la lista de archivos que el informe de la fase presentó como corregidos. Ahí está el hueco del historial.

---

## 4. Resultados de las 57 pruebas originales

Comando, desde `backend`, con el binario local y sin descarga de MongoDB:

`npm run test:phase1`

Evidencia: `docs/auditoria-admin/cierre-fase1/fase1-reproduccion.txt`.

| Métrica | Resultado |
| --- | --- |
| Pruebas | 57 |
| Aprobadas | 57 |
| Fallidas | 0 |
| Omitidas | 0 |
| Duración | 17.107 ms |
| Red externa | ningún host |
| Motor | MongoDB 8.3.2, replica set temporal |

Cubren, entre otras, índice parcial de idempotencia, números de pedido concurrentes, contraentrega que sigue `pendiente` al despachar, rechazo de preparación Wompi sin pago, vendedor sin estados financieros, saltos de estado, webhooks rechazado-luego-aprobado, pago sin stock, tres `APPROVED` simultáneos, autocancelación bloqueada en preparación, conservación de stock al guardar el producto, líneas repetidas, cupón concurrente y tres aprobaciones que consumen el cupón una vez.

El JSON interno registra `unrelated-indexes` con el conflicto `requestNumber_1` de `SpecialRequest`. La suite igual termina en 57/57. Ese aviso es preexistente y sigue presente; no es un fallo nuevo ni una corrección de la fase.

A0 confirma un único índice único de `orderNumber` y el índice `idempotencyKey_1` único con `partialFilterExpression` de tipo string.

---

## 5. Pruebas independientes y resultados

Archivos: `independiente.test.js`, `independiente-resultados.json`, `independiente-ejecucion.txt`. Duración de la ejecución autoritativa: 32,0 s. Misma política de red y de datos que la suite original. No reutilizan los casos A–P con otro nombre: combinan concurrencia real, fallos a mitad de camino, permisos HTTP y datos con forma histórica.

| Id | Resultado | Qué quedó demostrado |
| --- | --- | --- |
| entorno | PASS | Replica set temporal, `autoIndex: true`, hosts bloqueados vacíos |
| I01 | PASS | Diez compras de la última unidad: un 201, stock 0, un solo pedido. Uno respondió 400 “El valor de key ya está registrado”; el resto 409. No hubo sobreventa ni fuga de `E11000` |
| I02 | PASS | Dos pagos Wompi por la última unidad: ambos quedan pagados, el stock baja una vez y el segundo guarda `approved_without_stock` |
| I03 | PASS | Ocho webhooks idénticos más tres reintentos: un movimiento de venta |
| I03b | PASS | `APPROVED` y `DECLINED` a la vez terminan en `pagado`, stock descontado una vez |
| I04 | PASS | El primer webhook falla al guardar; el pago ya está `pagado` y el stock intacto. El reintento descuenta una vez y cierra la incidencia técnica |
| I05 | PASS | La misma clave e igual contenido repite la respuesta y no crea otro pedido |
| I05b | Observación | Una clave nueva, después de un fallo ya confirmado, crea un segundo pedido. El primero sigue reteniendo stock |
| I05c | PASS | Cancelar esos dos pedidos repone el stock una sola vez por pedido |
| I05d | PASS | Un enlace ambiguo no deja el checkout en un estado que el reintento de la misma clave duplique |
| I06 | PASS | Cancelación y aprobación a la vez: el pedido sigue `cancelado`, el pago queda `pagado`, el stock no se descuenta ni se reactiva. Incidencias `cancelled_wompi_watch` y `approved_after_cancellation` |
| I07 | PASS | Dos autocancelaciones: un 200 y un 409. El stock se repone una vez. El historial guarda al cliente y el motivo |
| I07b | Observación | `coupon.usedCount` permanece en 1 después de cancelar |
| I08 | PASS | Cinco ventas y ajustes +3/− concurrentes. El stock final coincide con la suma del historial |
| I08b | PASS | La misma clave de ajuste, en paralelo, aplica +3 una vez |
| I08c | PASS | La misma clave con otro delta responde 409 y no mueve stock |
| I09 | PASS | Otra persona o otro contenido con la misma clave recibe 409 |
| I09b | PASS | Una clave mal formada se rechaza |
| I09c | PASS | Dos pedidos sin clave conviven. El índice parcial no choca con valores ausentes |
| I10 | PASS | Dos líneas de la misma variante, con stock suficiente, descuentan en secuencia |
| I10b | PASS | Si no alcanza, la compra entera hace rollback |
| I10c | PASS | Un stock histórico 10,5 no se redondea. Compra y ajuste responden 409 y el stock sigue 10,5 |
| I11 | PASS | Un pedido legado `DIZ-20240115-0007` se consulta. Prepararlo exige conciliación. `deliveredAt` no se inventa |
| I12 | PASS | Matriz HTTP del vendedor. Detalle en la sección 8 |
| I13 | PASS | `amount_in_cents` como texto: pago `pagado`, sin descuento, incidencia de monto, preparación 409. Confirmación manual Wompi 409. Firma mala 401 |
| I13b | PASS | Recaudo antes de la entrega: 409 “El recaudo requiere entrega confirmada” |
| I14 | PASS | Entregar no marca el pago. El primer recaudo guarda `REC-ORIGINAL`. El segundo, con otra referencia, responde 200 y no cambia la referencia ni duplica el historial |
| I15 | PASS | El cuerpo decía `APPROVED` y el proveedor simulado `DECLINED`. Queda `rechazado`, stock igual |
| I16 | PASS | El reporte de `financeService` suma 1 pedido y $80.000 |
| I16b | **DEFECTO** | El historial suma 3 pedidos y $160.000 |
| I17 | PASS | En caliente hay un solo índice único de `orderNumber` y el parcial de idempotencia |
| I17b | Observación | `SpecialRequest` sigue con el índice `requestNumber` duplicado |
| I17c | PASS | En una base temporal, el índice viejo disperso rechaza el segundo `null` (11000). Crear el parcial con el mismo nombre choca (código 86). Tras recrearlo, el segundo `null` entra. Volver al disperso falla con `E11000` sobre `null` |
| I18 | PASS | En un `mongod` standalone la transacción no confirma nada: quedan 0 documentos. `transactionService.js` no tiene un `catch` que escriba fuera de la transacción |
| I19 | PASS | El checkout de tienda usa `submittingRef` y no relanza el envío mientras el primero sigue activo |
| I19b | PASS | El stock de una variante ya guardada va en un campo de solo lectura. El guardado del producto no manda ese stock |
| I19c | **DEFECTO** | Recaudo, cambio de estado y ajuste no quedan bloqueados durante la petición |
| red | PASS | Ningún host externo |

---

## 6. Integridad financiera

Lo que sí queda protegido, con llamadas reales:

- Preparar, despachar y entregar una contraentrega dejan `paymentStatus` en `pendiente`.
- El recaudo es otra operación. Exige entrega, referencia y fecha no futura. Repetirlo no cambia la primera referencia.
- Un administrador no puede marcar un Wompi como pagado a mano. Un vendedor tampoco. La conciliación usa la consulta al proveedor e ignora el estado enviado en el cuerpo (I15).
- Monto o moneda inconsistentes conservan el pago, crean incidencia y no descuentan stock.
- Un pago aprobado sin stock queda cobrado y visible, sin descuento extra.
- Una aprobación después de un rechazo sí completa el pedido si hay stock.
- Una aprobación después de una cancelación no reactiva el pedido.
- Cancelar o devolver un pedido ya cobrado no inventa un reembolso: agrega `received_payment_pending_resolution`.
- `buildFinanceReport` excluye cancelados, rechazados, devueltos y `requiresReview`. El agregado de ingresos del dashboard usa el mismo criterio.

Lo que no queda protegido:

`getFinanceHistory` en `backend/src/controllers/financeAdminController.js` (consulta de la línea 236) filtra solo `paymentStatus: "pagado"` y el rango de fechas. No excluye `cancelado`, `rechazado`, `devuelto` ni `requiresReview`. La página `frontend/src/app/admin/finanzas/page.js` dibuja la gráfica con `getFinanceHistory` (`/admin/finance/history`), no con el reporte corregido.

En la prueba, el reporte conciliado movió 1 pedido y $80.000. El historial movió 3 pedidos y $160.000: el cobro limpio, un cancelado de $50.000 y uno en revisión de $30.000. El arreglo de ADM-20 cubrió el reporte y dejó la serie que ve el administrador.

El segundo recaudo responde “Recaudo registrado” aunque conserve la referencia original. El dato no se duplica. El mensaje sí puede leerse como un recaudo nuevo.

No hay una ruta de administración, en el alcance revisado, que cierre incidencias comerciales y permita preparar un pedido con `requiresReview`. El pedido pagado queda a la vista y bloqueado para preparación. Eso evita un cobro silencioso; también deja la operación sin una salida de conciliación dentro de esta fase.

---

## 7. Concurrencia e inventario

El motor, dentro de `inTransaction`, aguantó las carreras pedidas:

- Una sola unidad entre diez contraentregas.
- Dos confirmaciones Wompi de esa misma unidad.
- Webhooks idénticos y webhooks `APPROVED` contra `DECLINED`.
- Reintento después de un fallo de almacenamiento, sin segundo descuento.
- Ajustes de stock concurrentes con compras: el saldo final coincide con la suma de `stockBefore`/`stockAfter`.
- La misma clave de ajuste aplica el delta una vez. Otra cantidad con esa clave se rechaza.
- Líneas duplicadas de la misma variante descuentan en cadena si hay stock y revierten toda la compra si no.
- Un stock fraccionario histórico no se normaliza.

`moveStock` exige una sesión ya dentro de una transacción y el descuento es condicional. El checkout de tienda reutiliza la clave mientras la página no se recarga, y un `ref` impide el doble envío en la misma pulsación.

El agujero está en el cliente del ajuste. `handleStockAdjustment` hace `crypto.randomUUID()` y luego `setVariant` para recordar la clave. Dos clics, antes del siguiente render, generan dos claves. El backend, correctamente, las trata como movimientos distintos. I08b demuestra que la protección existe solo cuando la clave es la misma. I19c demuestra que el botón “Registrar ajuste” no se deshabilita.

Un fallo de checkout ya persistido, seguido de una clave nueva, crea otro pedido y mantiene la reserva del primero (I05b). La misma clave no lo hace (I05). Recargar el checkout pierde la clave porque vive en `useState`.

---

## 8. Permisos

I12 llamó a los endpoints con un usuario vendedor y otro administrador, ambos ficticios.

El vendedor pudo consultar el pedido, prepararlo, despacharlo y registrar la entrega de una contraentrega. El pago siguió `pendiente`. Pudo listar solicitudes especiales y cambiar su estado operativo.

Recibió 403 al registrar recaudo, cancelar, devolver, conciliar Wompi, abrir finanzas y ajustar stock. El JSON del catálogo que recibió no contenía el costo interno `424242`. El webhook Nequi respondió 410 con la integración directa apagada.

Esas respuestas salieron del servidor. La interfaz también esconde el recaudo cuando `canConfirmCollection` es falso y limita la conciliación a `admin` y `superadmin`. La comprobación que manda es la del backend.

---

## 9. MongoDB y transacciones

`transactionService.inTransaction` abre sesión, ejecuta `withTransaction` con lectura `snapshot` y escritura `majority`, y cierra la sesión. No hay `catch` que repita la escritura fuera de la transacción.

Pedido, inventario, movimientos y consumo de cupón de una compra que descuenta stock comparten esa sesión. El correo y la HTTP de Wompi quedan fuera del callback. La marca `paymentStatus: "pagado"` del webhook se escribe antes de la transacción de inventario, a propósito: si el stock falla, el cobro no se pierde y queda la incidencia. I04 lo vio a mitad de camino y el reintento no volvió a descontar.

I18 conectó un `mongod` sin replica set. La operación terminó con el error de escrituras reintentables no soportadas y **0 documentos**. No hubo confirmación parcial ni fallback silencioso. El ejemplo de `backend/.env.example` es `mongodb://localhost:27017/dizor`. El `README.md` describe `MONGO_URI` como “Conexión MongoDB” y no exige replica set. `db.js` solo hace `mongoose.connect`.

Esta auditoría no consultó Atlas ni ninguna base de producción. No se puede afirmar que producción sea compatible.

### Verificación de solo lectura para un operador autorizado

Ejecutarla con un usuario de lectura, sobre producción o sobre un reflejo reciente. No usar `syncIndexes`, no crear ni borrar índices en este paso.

1. `db.hello()` o `db.runCommand({ isMaster: 1 })`. Tiene que existir `setName` (replica set) o el proceso tiene que ser `mongos`. Si `msg` indica un standalone, la Fase 1 no puede desplegarse ahí.
2. Anotar versión (`buildInfo`) y el URI sin credenciales.
3. `db.orders.getIndexes()` y guardar el documento completo de `idempotencyKey_1`: `unique`, `sparse`, `partialFilterExpression`.
4. Contar claves ausentes, `null` y cadenas duplicadas:

   - ausente o `null`: `db.orders.countDocuments({ $or: [{ idempotencyKey: { $exists: false } }, { idempotencyKey: null }] })`
   - duplicados de cadena: agregar `$match` de tipo string, `$group` por `idempotencyKey` con `count > 1`.
5. `db.orders.aggregate([{ $group: { _id: "$orderNumber", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])`.
6. Repetir el listado de índices de `paymentevents`, `products`, `coupons` y `specialrequests`. En solicitudes, comprobar si `requestNumber_1` está declarado dos veces en el arranque.

Si el paso 1 no muestra replica set o `mongos`, el despliegue se detiene.

---

## 10. Índices y migración

Estado del código actual:

- `orderNumber`: un índice único. El índice redundante del esquema anterior no está.
- `idempotencyKey`: único y parcial, solo donde el valor es string. El campo ya no tiene default `null`.
- `PaymentEvent.key`: único. Sirve a la idempotencia del webhook.
- Producto y cupón: el índice único del slug y del código quedó una sola vez.
- `SpecialRequest.requestNumber`: `unique: true` y, además, `schema.index({ requestNumber: 1 })`. Mongoose avisa el duplicado al iniciar. Es anterior a la fase. I17b lo reprodujo. No bloquea las 57 pruebas y sí ensucia el arranque.

En el esquema de `2dfd9ea` la clave era dispersa y única, con default `null`. En la base temporal ese índice rechaza un segundo `null` (11000). Crear el índice nuevo con el mismo nombre, sin borrarlo antes, responde **código 86** (`IndexOptionsConflict`). Después de cambiarlo, dos documentos sin clave conviven. Recrear el índice disperso sobre esos datos falla con `E11000` y `idempotencyKey: null`. Por eso la reversión no puede ser “volver a crear el índice viejo” si ya entró más de un documento sin clave. La reversión es restaurar el respaldo.

`autoIndex` sigue activo. Si producción conserva el índice disperso, el arranque del proceso nuevo puede fallar al intentar el parcial con el mismo nombre. No se debe “arreglar” con `syncIndexes` en producción.

### Migración del índice de idempotencia

No se ejecutó sobre ninguna base real. El laboratorio que la respalda es I17c.

1. **Inspección.** Correr el procedimiento de solo lectura de la sección 9. Detenerse si hay cadenas duplicadas o números de pedido duplicados: eso no lo resuelve el cambio de índice.
2. **Respaldo.** Copia consistente de `orders` (y, si el respaldo es lógico, de las colecciones que la operación comercial necesite para volver atrás). Anotar conteo de documentos. I17c conservó 4 documentos de control antes del cambio.
3. **Duplicados.** Cero grupos de `idempotencyKey` string repetida. Contar `null` y ausentes solo para saber qué va a quedar fuera del índice parcial. Esos documentos históricos son compatibles con el índice nuevo; son incompatibles con volver al índice disperso.
4. **Ventana.** Congelar escrituras de checkout o entrar en mantenimiento. El cambio de índice no es una escritura de un pedido, pero un alta concurrente mientras se borra el índice único puede colar un duplicado.
5. **Preparación.** En la ventana, y solo entonces: `db.orders.dropIndex("idempotencyKey_1")` y `db.orders.createIndex({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } }, name: "idempotencyKey_1" })`. No usar `syncIndexes`.
6. **Validación.** `getIndexes()` debe mostrar `unique: true` y el filtro parcial. Insertar dos documentos de prueba sin clave en una colección copia, o comprobar en la colección real que el conteo de documentos no cambió y que una clave string repetida sería rechazada en una colección clonada. Borrar cualquier documento de prueba.
7. **Reversión.** Si el índice nuevo no queda como arriba, restaurar el respaldo. No recrear el índice disperso encima de datos que ya tengan más de un `null` o más de un documento sin clave: I17c obtuvo `E11000`.

Los pedidos históricos con número legado, sin `stockDeducted` y con stock fraccionario se consultan. No se preparan hasta conciliarlos y el stock fraccionario no se reescribe. Eso se probó con documentos insertados en la base temporal (I09c, I10c, I11), no con la base real.

---

## 11. Wompi sandbox

No se envió ninguna solicitud a Wompi. La integración quedó ejercida solo con un proveedor simulado. Eso no es una validación oficial de sandbox.

Lo que la simulación ya cubre: firma incorrecta rechazada (401), propiedades de firma exigidas por el controlador, monto y moneda, `amount_in_cents` no numérico tratado como diferencia, eventos duplicados, carrera aprobado/rechazado, reintento tras fallo de guardado, aprobación sin stock, aprobación después de cancelación, conciliación que ignora el cuerpo y consulta al proveedor, y un enlace que falla sin borrar el pedido.

Límites vistos en código, pendientes de la respuesta real de Wompi: `createPaymentLink` no envía `expires_at`; una fecha sin zona se interpreta como UTC; el identificador de transacción se confirma contra `data.id` en la consulta. Esas decisiones hay que contrastarlas con un enlace y un evento reales.

### Matriz para un operador autorizado

Ninguna fila se ejecutó contra Wompi. Todas están **pendientes de validación externa**.

| Escenario | Acción | Resultado esperado | Evidencia necesaria |
| --- | --- | --- | --- |
| Crear enlace | Un checkout Wompi de sandbox con monto COP conocido | El pedido queda `pago_pendiente`, guarda id, URL y vigencia; no descuenta stock | Pedido, respuesta del enlace, stock antes y después |
| Vigencia | Comparar `expires_at` del proveedor con `wompi.expiresAt` | La hora en America/Bogota coincide con la consola de Wompi | Captura del proveedor y campo guardado |
| Webhook aprobado | Evento oficial firmado, monto y moneda iguales | `pagado`, un descuento, un `PaymentEvent` | Encabezado de firma, id de transacción, pedido, movimiento |
| Webhook repetido | Reenviar el mismo evento | 200, sin segundo descuento ni segundo evento útil | Conteo de movimientos y de `PaymentEvent` |
| Reintento tardío | Reenviar después de un 5xx provocado en una copia | El cobro permanece y el stock queda descontado una vez | Pedido a mitad y al final |
| Monto distinto | Evento con centavos o moneda distintos | Pago registrado, incidencia, stock intacto, preparación rechazada | Pedido, incidencia, stock |
| Rechazado y luego aprobado | Dos eventos del mismo enlace, en ese orden, con stock | El pedido termina pagado y descontado una vez | Ambos eventos y el pedido final |
| Aprobado tras cancelar | Cancelar un pendiente ya verificado y después enviar `APPROVED` | Sigue cancelado, pago `pagado`, stock sin tocar, incidencias visibles | Pedido e incidencias |
| Referencia desconocida | Evento con referencia que no existe | 200 y ningún pedido alterado | Colección de pedidos y de eventos |
| Conciliación | `POST` de conciliación con un estado mentiroso en el cuerpo | Manda el estado que devuelve `GET` de la transacción | Id consultado y pedido |
| Enlace ambiguo | Cortar la respuesta de creación de enlace | El pedido queda localizable para conciliar; el reintento de la misma clave no crea otro | Pedido, `checkoutState`, segunda respuesta |
| Firma inválida | Alterar un byte del evento | 401 y sin escrituras de pago | Código HTTP y pedido |

Hasta cerrar esa matriz, la preparación de sandbox es parcial.

---

## 12. Revisión de frontend

Se revisaron las pantallas de la fase, no el rediseño del administrador.

Coherente con el backend:

- El checkout de tienda bloquea un segundo envío con `submittingRef` y reutiliza la clave mientras no se recargue.
- Las transiciones que pinta el detalle salen de `allowedTransitions`.
- El recaudo solo se muestra si `canConfirmCollection` es verdadero, y el backend lo limita al administrador sobre una contraentrega ya entregada.
- La conciliación Wompi solo se ofrece a `admin` y `superadmin`.
- El stock de una variante existente está en solo lectura. El ajuste pide cantidad relativa y motivo. Guardar el producto no reenvía ese stock.
- Hay textos para incidencias, para la guía obligatoria antes de “enviado” y para el error de ajuste.

Sin protección de interfaz:

- “Registrar recaudo” no usa estado de carga ni `disabled`. El servidor no duplica el recaudo; el botón sí deja repetir la pulsación.
- “Actualizar estado” tampoco se bloquea. Una segunda transición igual debe rechazarla el servidor; la primera sigue pudiendo dispararse dos veces si el usuario pulsa antes de la respuesta.
- “Registrar ajuste” no se bloquea. Cada clic puede crear otra `operationKey` porque `setVariant` es asíncrono. Ese es el defecto de inventario en la interfaz.
- El mensaje de éxito del segundo recaudo sigue siendo “Recaudo registrado”.

Build: `npm run build` en `frontend` compiló con Next.js 16.2.6, del orden de 12,4 s, y generó las rutas del proyecto, incluidas las de admin, checkout y cuenta. El build leyó `.env` por el mecanismo normal de Next; esta auditoría no imprimió ni copió secretos.

Navegador: se levantó una API en `127.0.0.1:5099` con Mongo en memoria y usuarios ficticios (`servidor-aislado.js`). El segundo `next dev`, en el puerto 3456 y apuntando a esa API, no llegó a servir: Next informó que ya había otro servidor de desarrollo del mismo proyecto en `http://localhost:3000` (PID 25804). No se detuvo ese proceso y no se usó esa instancia, porque podía estar unida a la API del entorno de trabajo. La API aislada se apagó al terminar. **El comportamiento visual y responsive, en escritorio y en móvil, queda sin verificar.** No se aprueba el responsive por haber leído JSX.

---

## 13. Lint y build

| Verificación | Resultado | Clasificación |
| --- | --- | --- |
| `node --check` sobre 26 archivos JS de backend y de las pruebas | Sin errores de sintaxis | Entorno de la auditoría |
| ESLint de los 8 archivos de frontend de la fase | 6 errores, 4 advertencias, salida 1 | Igual que `docs/auditoria-admin/evidencias/fase1-eslint-comparacion.json`. Preexistentes. Cero reglas nuevas en esa pasada |
| Build de frontend | Compilación correcta, Next.js 16.2.6 | Ejecutado en esta auditoría |
| Build o ESLint de backend | El `package.json` del backend no define esos scripts | Límite del proyecto, no un fallo nuevo |
| Dependencias | No se instaló ninguna. Las pruebas usaron el `mongodb-memory-server` ya presente en otro proyecto local, mediante `MMS_DIR` | Límite de entorno, declarado |

Errores de lint, los seis: `set-state-in-effect` en cuenta, alertas, `AlertBell`, `OrderDetail` y `OrdersList`, y pureza en alertas. Advertencias: dependencias de efectos y `<img>` en `OrderDetail`, `OrdersList` y `ProductForm`. Los servicios de catálogo y de pedidos salieron limpios. Evidencia fresca: `eslint-fase1.json`.

No se tocó código para cambiar estos resultados.

---

## 14. Matriz C1–C12

| Criterio | Clasificación | Fundamento |
| --- | --- | --- |
| C1. Reglas financieras protegidas | PARTIAL | Cobro, recaudo, Wompi manual, incidencias y el reporte principal se sostienen. El historial de la gráfica no |
| C2. Transiciones inválidas rechazadas | PASS | Saltos, reactivaciones, preparación sin pago y estados inventados responden 409 en las dos suites |
| C3. Inventario íntegro bajo concurrencia | PARTIAL | El motor no sobrevendió ni descontó dos veces. El botón de ajuste puede emitir dos claves y mover stock dos veces |
| C4. Webhooks idempotentes | PASS | I03, I03b, I04 y C3 de la suite original |
| C5. Cancelaciones según las reglas comerciales | PASS | Autocancelación solo antes de preparar, Wompi pagado bloqueado, reposición única, motivo y responsable. El cupón no se devuelve: está en hallazgos, no rompe las reglas que la fase enumeró |
| C6. Permisos del vendedor | PASS | I12 por HTTP, más G1 de la suite original |
| C7. Checkout ante solicitudes simultáneas | PASS | I01 y P28: una sola venta de la última unidad. Queda el residuo de una clave nueva tras un fallo, que no es una carrera de la misma clave |
| C8. Compatibilidad con datos históricos | PASS | En base temporal: números legados, claves ausentes y stock 10,5. La base real no se inspeccionó |
| C9. Sin regresiones críticas de la fase | FAIL | El arreglo financiero quedó a medias y el ajuste de stock nuevo puede duplicarse |
| C10. Pruebas locales reproducibles | PASS | 57/57 reejecutadas y la suite nueva archivada. Motor 8.3.2, no el 7.0.24 del informe de desarrollo |
| C11. Lista para validación Wompi sandbox | PARTIAL | La simulación cubre firma, monto, reintentos y conciliación. La validación externa no se hizo |
| C12. Procedimientos seguros de infraestructura e índices | PASS | Secciones 9 y 10. Ejecutarlos en producción sigue pendiente; el procedimiento ya queda escrito y el conflicto de índice se reprodujo en laboratorio |

Cierre funcional local y autorización de despliegue son decisiones distintas. La primera sale **FAIL** por C9 y por los dos defectos. La segunda también es negativa, y seguiría siendo negativa aunque C9 se corrigiera, mientras C11 no tenga la corrida de sandbox y no se confirmen el replica set y la migración del índice.

---

## 15. Hallazgos

### Alta — El historial financiero incluye cobros que el reporte ya excluye

- Dónde: `backend/src/controllers/financeAdminController.js`, consulta de `getFinanceHistory`; consumido por `frontend/src/app/admin/finanzas/page.js`.
- Evidencia: I16 contra I16b. Reporte: 1 pedido, $80.000. Historial: 3 pedidos, $160.000.
- Efecto: la gráfica de finanzas cuenta un pedido cancelado y uno marcado para revisión. ADM-20 no quedó cerrado en la superficie que mira el administrador.
- El dashboard de ingresos, en `dashboardAdminController.js`, sí aplica el filtro conciliado. El hueco es el historial.

### Alta — Un doble clic en “Registrar ajuste” puede mover el stock dos veces

- Dónde: `frontend/src/components/admin/ProductForm.jsx`, `handleStockAdjustment` (la clave se crea y se guarda con `setState`) y el botón de la línea del ajuste, sin `disabled`.
- Evidencia: I19c (`adjustLocked: false`). I08b muestra que la misma clave sí es idempotente; el cliente no garantiza esa clave.
- Efecto: dos movimientos reales, con dos claves, por un solo ajuste que el operador intentó una vez.

### Media — Recaudo y cambio de estado no se bloquean durante la petición

- Dónde: `frontend/src/components/admin/OrderDetail.jsx`, `handleConfirmPayment` y `handleUpdateStatus`, botones sin estado de ocupación.
- El recaudo repetido no cambia la referencia (I14). El segundo estado igual debe rechazarlo el servidor. El operador puede recibir dos mensajes de éxito en el recaudo, porque la API responde 200 y “Recaudo registrado” también en la repetición.

### Media — Cancelar no devuelve el uso del cupón

- Evidencia: I07b, `usedCount` 1 antes y después de la autocancelación.
- `orderOperations` repone stock y no libera el cupón. Un cliente que cancela antes de la preparación consume el cupón igual. La fase no lo prometió; es una regla comercial abierta.

### Media — Una clave nueva después de un checkout fallido crea otro pedido

- Evidencia: I05b. El segundo pedido responde 201, el primero sigue en `failed` y ambos retienen stock hasta cancelarlos (I05c).
- La misma clave es segura (I05). La clave del checkout está en `useState` (`checkout/page.js`). Una recarga, o un cliente que reintente con otra clave, abre un segundo pedido.

### Baja — Un 400 opaco en la carrera de la última unidad

- I01: entre diez peticiones hubo un 400, “El valor de key ya está registrado”, y el resto de los perdedores fueron 409 de stock. Se creó un solo pedido y el stock terminó en 0. No se filtró una traza. Conviene aislar qué índice produce esa clave `key` en `keyValue`. No corrompió datos en la prueba.

### Observación de proceso — El commit mezcla archivos de Home

`35de057` incluye `HomeHero.jsx`, `HomeSectionIntro.jsx`, `variables.css` y `home.css`, aunque el mensaje dice que Home va aparte. El árbol de trabajo tiene más cambios de Home sin commit. No se deben revertir ni incluir de paso al corregir la fase.

### Preexistentes, no introducidos por esta auditoría

- Índice duplicado `requestNumber_1` en solicitudes especiales.
- Seis errores y cuatro advertencias de ESLint, ya presentes en la comparación con `HEAD`.
- La ruta Nequi sigue en el código. Con el flag apagado responde 410 (I12). Si alguien activa `NEQUI_DIRECT_ENABLED` en un entorno real, vuelve el flujo que la fase dejó fuera. Hay que confirmar el flag en el despliegue sin copiar secretos al informe.

---

## 16. Bloqueos antes de producción

1. Corregir el historial financiero y el doble envío del ajuste, y volver a correr las dos suites.
2. Confirmar, con el procedimiento de solo lectura, que producción es replica set o `mongos`. El URI de ejemplo no lo es. Un standalone no confirma la transacción.
3. Ejecutar la migración del índice de idempotencia sobre una copia, y solo después en una ventana. No usar `syncIndexes`. No recrear el índice disperso como reversión si ya existen varios documentos sin clave.
4. Completar la matriz de sandbox de Wompi con un operador autorizado. La simulación no la sustituye.
5. Dejar Nequi directo y manual apagados, salvo una decisión explícita de producto.
6. No desplegar el commit actual como “solo Fase 1”: arrastra cambios de Home. No pisar el Home sin commit que está en el árbol de trabajo.
7. La verificación visual de escritorio y móvil sigue pendiente. No es, por sí sola, el motivo del FAIL, y tampoco está aprobada.

---

## 17. Plan de corrección

Sin aplicar en esta auditoría.

1. Hacer que `getFinanceHistory` use el mismo criterio que `paidFilter` de `financeService`: `pagado`, sin `requiresReview`, y con `orderStatus` fuera de `cancelado`, `rechazado` y `devuelto`. Revisar cualquier otra serie que copie la consulta de la línea 236. Añadir una prueba que compare el delta del reporte y el del historial con un cancelado y un pedido en revisión.
2. En el ajuste de stock, deshabilitar el botón desde el primer clic y generar la `operationKey` de forma que el segundo clic vea la misma clave aunque React no haya repintado. No limpiar la clave si la respuesta es ambigua. Cubrirlo con una prueba de componente o de doble invocación inmediata, no solo con la del backend.
3. Deshabilitar “Registrar recaudo” y “Actualizar estado” mientras la petición no termina. En un recaudo repetido, responder un mensaje que diga que el recaudo ya existía, conservando la referencia original.
4. Decidir si la autocancelación antes de preparar devuelve `usedCount`. Si la respuesta es sí, hacerlo en la misma transacción que repone el stock, una sola vez.
5. Conservar la clave de checkout fuera de la memoria de la página, o impedir una compra nueva del mismo carrito mientras exista un checkout `failed` que todavía retiene stock.
6. Aislar el 400 “El valor de key ya está registrado” de I01 y devolver el conflicto de negocio que corresponda, sin cambiar el resultado de stock.
7. Recién entonces: verificación de replica set, ensayo de la migración en una copia, matriz de Wompi sandbox, y una pasada de navegador de escritorio y móvil contra una API aislada. No empezar la Fase 2 encima de estos puntos.

---

## 18. Veredicto final

**FAIL.** La Fase 1 no puede declararse cerrada a nivel funcional local. El núcleo de pedidos, webhooks, inventario transaccional y permisos del vendedor se sostuvo en pruebas reproducibles, incluidas las 57 originales. El historial financiero que ve el administrador y el ajuste de stock de la ficha de producto no cumplen el criterio de cierre.

**El despliegue no está autorizado.** No lo autorizaría tampoco una corrección solo de esos dos defectos mientras no estén confirmados el replica set de producción, la migración del índice de idempotencia y la validación externa del sandbox de Wompi.

### Respuestas directas

**¿La Fase 1 está correctamente implementada y puede declararse cerrada a nivel funcional local?**  
No. Está mayormente implementada y las reglas centrales de pago e inventario pasan pruebas independientes, pero el cierre local queda en FAIL por el historial financiero y por el ajuste de stock que puede duplicarse.

**¿Qué falta para autorizar un despliegue seguro?**

- Corregir y volver a probar I16b e I19c.
- Confirmar replica set o `mongos` con el procedimiento de solo lectura.
- Migrar `idempotencyKey_1` en una ventana, con respaldo, sin `syncIndexes`, y con reversión por restauración.
- Ejecutar la matriz de sandbox de Wompi y archivar sus evidencias.
- Confirmar que Nequi directo sigue apagado.
- Verificar en navegador, en escritorio y en móvil, el detalle del pedido y el ajuste de stock contra datos ficticios.
