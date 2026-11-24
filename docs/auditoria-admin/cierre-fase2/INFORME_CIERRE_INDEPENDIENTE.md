# Informe de cierre independiente — Fase 2 DIZOR

Fecha de la auditoría: 20 de noviembre de 2026.  
Alcance: comunicaciones transaccionales de la Fase 2, commit `151e41f` (“Mejora en admin fase dos de 7, completa validando pruebas”).  
No se modificó código de aplicación, no hubo commit, push, despliegue, migración, pago real ni correo real. `TRANSACTIONAL_NOTIFICATIONS_ENABLED` no se activó fuera del proceso de prueba, y dentro de ese proceso solo se comprobó que permanece apagada.

## Veredicto

**PASS WITH BLOCKERS.**

El comportamiento local de la bandeja, la idempotencia, los permisos y las plantillas se sostiene con pruebas reproducibles. No apareció pérdida de eventos, duplicado no controlado, permiso incorrecto ni correo comercial contrario al estado del pedido.

El despliegue no está autorizado. Falta la aceptación real en Resend, la llegada a un buzón y la prueba externa del enlace Wompi. La bandera de entrega debe seguir apagada hasta esa validación. Siguen vigentes, además, los requisitos de infraestructura ya documentados para la Fase 1: replica set y migración controlada del índice de idempotencia.

---

## 1. Resumen ejecutivo

La Fase 2 publica cada hecho comercial dentro de la misma transacción del pedido y deja el envío a un trabajador aparte. Un rollback no conserva la notificación. El proveedor se llama fuera de la transacción. Un fallo de entrega no cambia pago, pedido ni stock.

Se reprodujeron las **119 pruebas existentes: 119 aprobadas, 0 fallos**, en 54,8 s, con MongoDB 8.3.2, datos ficticios y la red externa bloqueada. Son 57 de Fase 1, 53 de Fase 2, 5 del cierre financiero y 4 del ajuste de stock.

Se añadieron **9 pruebas independientes**. Las 9 pasaron. Cubren una carrera real de webhooks aprobado/rechazado, un lease vencido durante la llamada al proveedor, la recuperación antes de llamar al proveedor, un resultado ambiguo reintentado con la misma clave, la ventana de 23 horas, el ciclo de contraentrega, un reenvío después de cancelar un pago, permisos, paginación, alertas, rollback y la cifra financiera conciliada.

En Chrome, el componente real de comunicaciones aprobó 8 comprobaciones de escritorio, teclado, doble clic, error, vendedor y 360 px. No hubo solicitudes externas ni errores de página. Esa pasada usa una API ficticia; las rutas reales se probaron por HTTP en las suites de backend.

Queda una observación baja: el texto plano conserva saltos de línea que vengan en el nombre del producto. El HTML sí los escapa. No genera por sí mismo un reembolso ni un pago. No impide el cierre local.

## 2. Archivos revisados

Informes y evidencias de Fase 1, del cierre independiente, de las correcciones financieras y de Fase 2, incluido `fase2-evidencias/README.md` y `backend/test/phase2.test.js`.

Código leído en el commit de la fase:

- `backend/src/models/notification.js`, `order.js`, `paymentEvent.js`
- `backend/src/services/notificationEvents.js`, `notificationDelivery.js`, `notificationTemplates.js`
- `backend/src/services/orderOperations.js`, `orderService.js`, `wompiPaymentService.js`, `emailService.js`, `orderReceiptService.js`
- `backend/src/controllers/notificationAdminController.js`, `adminAlertController.js`, `checkoutController.js`
- `backend/src/routes/adminOrderRoutes.js`, `adminAlertRoutes.js`, `backend/src/server.js`
- `frontend/src/components/admin/OrderCommunications.jsx` y su CSS, `CommunicationAlerts.jsx`, `OrderDetail.jsx`
- `frontend/src/app/admin/alertas/page.js`, `frontend/src/services/orderAdminService.js`
- `frontend/test/communications-browser.cjs`, `frontend/test/stock-adjustment.test.cjs`
- `backend/test/phase2-compatibility.test.js` y el fixture `backend/test/helpers/phase2Fixture.cjs`

El árbol de trabajo, al cerrar esta auditoría, no tiene cambios de aplicación. Lo único nuevo es `docs/auditoria-admin/cierre-fase2/`.

## 3. Reproducción de las 119 pruebas

Comando, desde la raíz, con el binario local de MongoDB 8.3.2 y sin descarga:

`node --test --test-concurrency=1 backend/test/phase1.test.js backend/test/phase2.test.js backend/test/phase2-compatibility.test.js frontend/test/stock-adjustment.test.cjs`

Evidencia: `regresion-119.txt`.

| Grupo | Resultado |
| --- | --- |
| Fase 1 original | 57 aprobadas |
| Fase 2 N01–N53 | 53 aprobadas |
| Cierre financiero y exportaciones | 5 aprobadas |
| Ajuste de stock del formulario | 4 aprobadas |
| Total | 119 aprobadas, 0 fallos, 0 omitidas, 54.799 ms |

El runner de compatibilidad vuelve a escribir `fase2-evidencias/cierre-independiente-resultados.json`. Esa copia se restauró al contenido del commit después de leer el resultado. La evidencia de esta reproducción queda en `regresion-119.txt`.

## 4. Pruebas independientes

Archivos: `independiente.test.js`, `independiente-ejecucion.txt`, `independiente-resultados.json`.  
9 aprobadas, 0 fallos, 16,9 s. MongoDB 8.3.2 en replica set temporal. Transporte simulado. Hosts externos bloqueados: `[]`.

| Id | Qué se hizo | Resultado |
| --- | --- | --- |
| F2-I01 | Cuatro webhooks simultáneos, el mismo identificador, aprobado contra rechazado | El pedido queda pagado y el stock baja una vez. Se envía un solo `payment.approved`. No se envía el rechazo. Hay un solo aviso de pedido listo |
| F2-I02 | El lease vence mientras el proveedor simulado todavía no respondió y otro trabajador reclama la misma fila | Dos llamadas, la misma clave y el mismo cuerpo. Sigue existiendo una sola fila y termina aceptada. El pago sigue pendiente |
| F2-I03 | Un trabajador muere después de reclamar y antes de llamar al proveedor. Luego un fallo de red y su reintento | La recuperación envía una vez. El fallo queda `result_ambiguous` y reintentable. El reintento usa la misma clave y el mismo texto. El pago no cambia |
| F2-I04 | Rechazo 422, ventana de 23 horas y salto directo a enviado | El rechazo permanente no se repite. Pasadas 23 horas la fila exige revisión y no se reenvía sola. El salto responde 409 y no crea correo de despacho. El error crudo del proveedor no sale en el historial |
| F2-I05 | Contraentrega hasta la entrega y el recaudo; Wompi solo creado; cancelación de un pago aprobado y reenvío de esa confirmación | La entrega contraentrega dice que el recaudo sigue pendiente. El recaudo no crea `payment.approved`. Wompi pendiente no dice pago confirmado. La cancelación no confirma reembolso. El reenvío posterior se omite como obsoleto y no llega al proveedor. Un correo enviado en el cuerpo se ignora. Las notas internas y el costo 424242 no aparecen |
| F2-I06 | 21 comunicaciones, vendedor, cliente, anónimo, HTML y carrera reintento/reenvío | Página 1 devuelve 20 y no repite identificadores. El vendedor no ve acciones ni correos administrativos. Cliente 403, anónimo 401. El HTML escapa `<b>`. La carrera entregó un solo mensaje |
| F2-I07 | Dos fallos del mismo código, uno reemplazado, un pedido solo con revisión financiera y una variante agotada junto a otra baja | Un grupo con conteo 2. El reemplazado y el pedido financiero no entran. El producto mixto aparece una vez, solo en agotados, con las dos variantes. El vendedor no consulta alertas |
| F2-I08 | Rollback de una cancelación, bandera apagada con clave falsa de Resend, y finanzas | El rollback no deja la cancelación ni la notificación. Con la bandera apagada el acuse queda `delivery_disabled`, sin aceptación. Reporte e historial suman 1 pedido y $80.000; el cancelado de $50.000 queda fuera |
| F2-I09 | Doce carreras simultáneas de reintento y reenvío | Las doce entregaron un solo mensaje. Ninguna dejó la fila original en pendiente y a la vez reemplazada |

F2-I02 demuestra el contrato real del diseño: si el proceso cae después de que el proveedor aceptó y antes de guardar esa aceptación, otro trabajador vuelve a llamar con la misma clave. La bandeja no abre otra comunicación. Que eso no produzca dos correos depende de que el proveedor respete la clave durante su ventana. Aquí el proveedor era simulado.

## 5. Hallazgos por severidad

No hay hallazgos altos ni medios que obliguen a corregir la fase antes del cierre local.

### Baja — el texto plano conserva saltos de línea del nombre del producto

En F2-I06 un nombre `Pieza <b>x</b>` más un salto y el texto “Reembolso realizado” llegó al texto plano partido en dos párrafos. El HTML salió como `&lt;b&gt;` y no ejecutó la etiqueta. El sistema no redactó un reembolso: reprodujo el nombre guardado en el pedido. El nombre lo escribe la tienda, no el comprador. Conviene colapsar saltos de línea al construir el texto, sin tratarlo como un fallo de cierre.

No se reproducen pérdidas, duplicados de filas, ni envíos comerciales después de un estado que los prohíbe.

## 6. Integridad de eventos

`enqueue` exige una sesión ya dentro de una transacción y hace un upsert por clave SHA-256 de pedido, evento, identidad, destinatario y canal. El alta usa `$setOnInsert`: un webhook repetido no crea otra fila ni reescribe la instantánea.

La publicación de registro, cambio de estado y resultado Wompi ocurre en la misma sesión que guarda el pedido. F2-I08 revirtió una cancelación: el pedido no quedó cancelado y el conteo de notificaciones no aumentó. N28 y N43 de la suite original cubren el mismo principio por otros caminos y volvieron a pasar.

El correo sale en `processOne`, después del commit. `buyerReceipt.sentAt` solo se escribe cuando el proveedor devuelve un identificador, y con `timestamps: false`. Un 422, un 503 y una excepción de red dejaron pago y stock como estaban.

Contraentrega preparada, despachada y entregada mantiene el pago pendiente en el mensaje. El recaudo posterior no publica `payment.approved`. Wompi recién creado no publica pago aprobado. Una aprobación tardía sobre un pedido ya cancelado, reenviada a propósito, queda `skipped` / `superseded` y no llama al proveedor. La cancelación de un pedido pagado dice que hay un pago recibido y que el mensaje no confirma un reembolso.

## 7. Concurrencia e idempotencia

La reclamación es un `findOneAndUpdate` condicionado por estado, intento y lease. Ocho o tres llamadas simultáneas de la suite original, y la carrera de esta auditoría, aceptan una sola fila.

Con el lease vencido a mitad de la llamada hubo dos invocaciones. Las dos llevaron la misma clave y el mismo cuerpo, y la fila siguió siendo una. El mensaje se congela antes de la primera llamada externa; el reintento ambiguo de F2-I03 reutilizó clave y texto.

La ventana automática es de 23 horas desde el primer intento externo. Pasado ese plazo, F2-I04 dejó la fila en `review_required`, sin nueva llamada. Un rechazo 422 queda `permanent_error` y el siguiente ciclo no lo toma.

Doce carreras de reintento contra reenvío produjeron un envío cada una. En esta muestra ganó el reintento y el reenvío respondió 409, o el camino equivalente de una sola entrega. No se observó una segunda copia enviada.

## 8. Reintentos y recuperación

El reintento administrativo no crea otra fila ni otra clave. Devuelve la misma comunicación a `pending`. Un reintento repetido mientras ya está pendiente o aceptada responde 202 sin multiplicar el historial de solicitud: N38 volvió a pasar.

El reenvío explícito exige confirmación, motivo de 5 a 300 caracteres y una clave de 16 a 128 caracteres. Si el resultado anterior es ambiguo, exige reconocimiento. Crea otra fila, marca la original como reemplazada y le quita el reintento automático. Una clave repetida devuelve la misma copia. Otra clave sobre una fila ya reemplazada responde 409. Un identificador de otro pedido responde 404. Un destinatario metido en el cuerpo no cambia el correo autorizado.

El tope es de cinco intentos. Los intervalos siguen siendo 1 minuto, 5 minutos, 30 minutos y 2 horas. Un error de red se guarda como ambiguo y reintentable. Un 4xx distinto de 429 no se reintenta. La ausencia de configuración o la bandera apagada dejan `skipped`, sin `acceptedAt`.

`delivered` no se asigna por una aceptación del proveedor. No hay webhook de entrega. El estado visible “Aceptado por el proveedor” coincide con `sent`.

## 9. Plantillas y privacidad

Hay texto plano y HTML para los once eventos. El HTML escapa `&`, `<`, `>`, comillas y apóstrofes. Un enlace de reintento solo se incluye en un rechazo y solo si, al construirlo, el origen es `https://checkout.wompi.co` y la ruta es un enlace, sin consulta ni ancla. La consulta previa al proveedor, cubierta por N04–N06, sigue rechazando enlace vencido, monto distinto o identificador que no coincide.

La instantánea guarda número, comprador, piezas, totales de venta, dirección, método, estado, transportadora, guía y la condición de entrega ya guardada. No guarda costo interno, notas del historial, tokens ni el cuerpo del error del proveedor. F2-I05 lo comprobó sobre correos generados por el flujo real, no solo sobre un objeto armado a mano. El historial HTTP enmascara el correo, omite instantánea y cuerpo, y no devuelve el motivo ni el correo completo.

La observación baja del salto de línea queda descrita en la sección 5. No filtra secretos.

## 10. Permisos por rol

Las rutas cuelgan de `protect` y del personal. Reintentar y reenviar exigen además `admin` o `superadmin`, y el controlador lo vuelve a comprobar.

| Actor | Resultado observado |
| --- | --- |
| Administrador | Historial paginado, reintento y reenvío con motivo |
| Vendedor | Solo comunicaciones al comprador, destinatario enmascarado, sin reintento ni reenvío. Alertas: 403 |
| Cliente | 403 en el historial |
| Anónimo | 401 |
| Cuerpo con otro destinatario o con `status: sent` | El servidor usa el correo del pedido o el administrativo configurado. No acepta el destino enviado por el cliente |

La correspondencia pedido–comunicación se exige en la consulta: la fila tiene que pertenecer a ese pedido.

## 11. Alertas

Los fallos y los `skipped` que no sean “estado superado” se agrupan por pedido y código. F2-I07 metió dos fallos temporales y uno ya reemplazado: el panel mostró un grupo con conteo 2. Un pedido marcado solo para revisión financiera no apareció en comunicaciones. Las incidencias de pago siguen en su propio bloque de la pantalla de alertas.

Inventario: umbral 5. Si una variante está en cero, el producto entra una sola vez en agotados, con las variantes afectadas, y no se repite en stock bajo. El vendedor no lee ese endpoint.

La bandera apagada no dispara el trabajador. Las filas siguen pendientes hasta que alguien procese, y el historial del pedido informa que la entrega está desactivada. Cuando el procesador corre sin permiso de envío, la fila pasa a “no enviado” y puede salir en alertas. No se genera un correo de error.

## 12. Resultados de navegador

Se ejecutó `frontend/test/communications-browser.cjs` con Chrome y el componente real. Resultado en `navegador-reproduccion.json`: 8 comprobaciones, `passed: true`, `externalRequests: []`, `pageErrors: []`.

Cubrió estados, foco de teclado, confirmación, doble clic, “Registrando solicitud…”, éxito, recuperación de una carga fallida, conservación de la clave tras una respuesta ambigua, vendedor sin acciones y ancho de 360 px sin desborde horizontal. También previsualizó el acuse y el despacho.

No se abrió el administrador Next completo ni se inició sesión contra la API de desarrollo. Las acciones de esa pantalla, contra el backend real, están en las pruebas HTTP. No se aprueba con esta pasada el resto del layout administrativo.

El CSS del panel parte las acciones en columna por debajo de 420 px, permite corte de palabras y marca el foco visible. Eso coincide con lo que Chrome midió en el componente.

## 13. Lint, sintaxis y build

`verificar-estatico.cjs` se volvió a ejecutar. Copia del resumen: `estatico-reproduccion.json`.

| Verificación | Resultado | Clasificación |
| --- | --- | --- |
| `node --check` de 25 archivos de la fase | 0 fallos | Sin defecto nuevo |
| ESLint de los 6 archivos frontend intervenidos | 4 errores y 2 advertencias, iguales al `HEAD` previo de esos archivos | Preexistentes. `newMessages: []` |
| Reglas Node explícitas | 0 errores y 1 advertencia, igual que la base | Preexistente |
| Build aislado de Codex | Salida 0, Next.js 16.2.6, sin `.env` y sin red, según `fase2-evidencias/build-fase2.json` | No se repitió el build en esta pasada. La evidencia del commit sigue siendo la de esa corrida aislada |
| Ajuste de stock | 4 pruebas del componente, dentro de las 119 | Sigue bloqueando el doble envío |

Los cuatro errores de frontend siguen en alertas, `AlertBell` y `OrderDetail`. Los componentes nuevos de comunicaciones no añaden diagnósticos.

## 14. Regresiones de Fase 1

Las 57 pruebas originales pasaron otra vez dentro de la corrida de 119. Las cinco de cierre también. F2-I08, con pedidos insertados en esta auditoría, volvió a medir reporte e historial: ambos subieron 1 pedido y $80.000, y dejaron fuera el cancelado de $50.000.

El ajuste de stock del formulario sigue generando una sola petición ante dos clics anteriores al render, conserva la clave si la respuesta se pierde y separa dos variantes. Esas cuatro pruebas pasaron en la misma corrida.

No se vio un cambio en las transiciones de pedido ni en la regla de que entregar una contraentrega no marque el pago.

## 15. Limitaciones externas

Pendientes, y por eso el cierre no es un PASS liso ni una autorización de despliegue:

1. Aceptación real con una cuenta Resend de un entorno autorizado, comprobando que la misma clave no produce dos correos. F2-I02 muestra por qué esa prueba importa: el trabajador puede llamar dos veces con la misma clave si el lease vence.
2. Llegada, spam y render en Gmail, Outlook y un teléfono real. `sent` no es entrega al buzón. `delivered` no se usa en esta fase.
3. Enlace de reintento Wompi contra el sandbox oficial. Aquí la consulta del enlace fue simulada.
4. No activar `TRANSACTIONAL_NOTIFICATIONS_ENABLED` en un entorno real hasta cerrar los puntos anteriores. Con la bandera apagada los eventos se guardan y no se envían; esta auditoría lo volvió a ver en F2-I08.
5. Producción sigue necesitando replica set o `mongos`, y la migración controlada del índice de idempotencia de pedidos descrita en el cierre de la Fase 1. Esta fase no ejecuta esa migración ni crea índices fuera de las bases temporales.

No se promete exactamente un correo por reenvío deliberado de un resultado ambiguo. La interfaz pide reconocimiento porque un reenvío nuevo usa otra clave y puede duplicar un mensaje que el proveedor ya hubiera aceptado. Eso es un acto explícito, no un reintento automático.

## 16. Veredicto final

**PASS WITH BLOCKERS.**

La Fase 2 puede declararse cerrada en lo funcional local. Los eventos quedan alineados con el pedido, los reintentos no duplican la fila, el personal no autorizado no actúa y un fallo del proveedor no toca el dinero ni el inventario.

**El despliegue no está autorizado.** No lo está mientras falte la validación externa de Resend y de Wompi, y mientras la base de producción no tenga confirmados el replica set y la migración del índice de idempotencia. La bandera de entrega debe permanecer apagada. No se inicia la Fase 3 con esta auditoría.
