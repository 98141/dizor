# Cierre independiente — Fase 3, operación de pedidos

Fecha de la auditoría: 20 de noviembre de 2026.
Entorno: Windows, Node v24.15.0, MongoDB 8.3.2 (binario del sistema, base efímera). No se usó Atlas, `.env`, datos reales, correos, pagos ni el servidor de desarrollo que pudiera estar abierto.

## 1. Resumen ejecutivo

**Veredicto de la Fase 3: PASS WITH BLOCKERS.**

El dashboard, las bandejas y el detalle con la acción que entrega el backend clasifican los pedidos de prueba como corresponde, separan pago, entrega y recaudo, y conservan las restricciones del vendedor. La reproducción de las 162 pruebas terminó en 162 aprobadas y 0 fallos. Seis pruebas nuevas, con pedidos que caen en varias bandejas, dinero sobre un pedido cancelado, fechas de Colombia y repeticiones concurrentes, también terminaron aprobadas.

Ese resultado cierra el comportamiento funcional local de la Fase 3. La autorización de despliegue sigue pendiente de la topología que confirma transacciones, de la migración del índice de idempotencia, de la aceptación real de Resend y del enlace Wompi en un entorno autorizado. Esas verificaciones pertenecen a las Fases 1 y 2 y permanecen fuera de este cierre.

## 2. Archivos revisados

Informes y evidencias: `docs/auditoria-admin/informe-fase3-operacion-pedidos-2026-11-20.md`, los informes de las Fases 1 y 2, los cierres independientes anteriores y `docs/auditoria-admin/fase3-evidencias/`.

Backend: `backend/src/services/orderWorkspace.js`, `orderReadiness.js`, `communicationCriteria.js`, `orderTransitions.js`, `orderOperations.js`, `financeCriteria.js`, `dashboardAdminController.js`, `orderAdminController.js` y `notificationAdminController.js`.

Frontend: `AdminDashboard.jsx`, `OrdersList.jsx`, `OrderDetail.jsx`, `OrderNextAction.jsx`, `OrderWorkspace.module.css`, `frontend/src/lib/orderWorkspace.js`, las páginas `/admin`, `/admin/pedidos`, `/vendedor` y `/vendedor/pedidos`.

Pruebas: `backend/test/phase3.test.js` (U01–U34), `frontend/test/orders-workspace-browser.cjs` (B01–B20) y la suite de regresión. Las aserciones de Codex no se modificaron. `frontend/src/components/layout/SiteFooter.jsx` aparece modificado en el árbol y queda fuera de esta fase.

## 3. Reproducción de las 162 pruebas

Comando, con el desvío que conserva los JSON de las auditorías anteriores:

`node --require ./docs/auditoria-admin/fase3-evidencias/preservar-evidencias.cjs --test --test-concurrency=1`

Archivos: `phase1.test.js`, `phase2.test.js`, `phase2-compatibility.test.js`, `phase3.test.js`, `cierre-fase2/independiente.test.js` y `frontend/test/stock-adjustment.test.cjs`.

| Suite | Pruebas |
|---|---|
| Fase 1 | 57 |
| Fase 2 | 53 |
| Cierre de Fase 1 reutilizado por compatibilidad | 5 |
| Fase 3, U01–U34 | 34 |
| Independientes de Fase 2 | 9 |
| Ajuste de stock en el formulario | 4 |
| Total | 162 |

Resultado de esta ejecución: **162 aprobadas, 0 fallos, 0 omitidas**. Duración del runner: 85,1 s. Salida: `regresion-162.txt`. Resumen: `reproduccion-162.json`.

El informe de Codex reportó 162/162 en 91,1 s. La diferencia es de tiempo. El conteo y el resultado coinciden. El JSON de la auditoría de Fase 2 conserva su marca de las 22:50 UTC; la corrida de las 162 escribió su copia en `fase3-evidencias/cierre-fase2-resultados.json`.

## 4. Pruebas independientes nuevas

Archivo: `independiente.test.js`. Resultado registrado: **6/6 en 15,5 s**. Evidencia: `independiente-resultados.json` y `independiente-ejecucion.txt`.

Un primer borrador de aserciones marcó cuatro fallos. Esos fallos medían el código HTTP de una repetición idempotente y trataban la búsqueda literal `.*` como si no debiera encontrar un nombre que contiene esos dos caracteres. La corrida que queda registrada mide historial, notificaciones, pago e inventario.

| Id | Qué comprueba | Resultado |
|---|---|---|
| F3-I01 | Un enviado con incidencia está en tránsito y en revisión. Un cancelado con pago recibido permanece en revisión, con pago `pagado`, y un segundo despacho responde 409. | Aprobada |
| F3-I02 | Wompi pendiente no entra a preparar y rechaza la preparación. Contraentrega entregada sigue pendiente de recaudo. El vendedor recibe 403 al recaudar y al abrir comunicaciones. El costo 424242 no sale en su detalle. Un estado repetido con `paymentStatus` manipulado deja el pago pendiente. | Aprobada |
| F3-I03 | La búsqueda literal, el ancla `^`, la paginación, el filtro combinado y las fechas imposibles se comportan como dice el contrato. Lista, dashboard y detalle no cambian `updatedAt`, pago ni stock. | Aprobada |
| F3-I04 | El día civil de Colombia incluye las 00:00 y las 23:59 locales y excluye el minuto anterior y el siguiente. El 1 de marzo a las 04:30 UTC sigue siendo el 28 de febrero en Bogotá. Un histórico incompleto queda en revisión y no inventa entrega. Dos preparaciones concurrentes dejan una sola nota de historial. | Aprobada |
| F3-I05 | Tres despachos y tres entregas simultáneos dejan una guía, un evento de envío, un evento de entrega y el pago pendiente. El recaudo del dashboard coincide con la bandeja. El stock no se mueve. | Aprobada |
| F3-I06 | 251 pedidos ficticios: la página 2 de “Por preparar” trae 15 filas y el total 125, que son solo las contraentregas preparables. Un cancelado pagado de $999.999 no entra a la venta conciliada del mes. | Aprobada |

## 5. Resultados de clasificación de bandejas

Las bandejas comparten `trayFilter` y `needsReview` entre la lista, los contadores y el dashboard. Un pedido puede aparecer en más de una bandeja y cada contador lo incluye una vez.

En F3-I01 el enviado con incidencia quedó así: preparar 0, despachar 0, tránsito 1, recaudo 0, revisión 2, todos 2. La segunda ficha de revisión es el cancelado con dinero. La acción principal de ambos es `review`. El pago del enviado sigue `pendiente`. El pago del cancelado sigue `pagado`.

Wompi `pago_pendiente`, incluso con fecha de 2020, no entra a preparar y la transición a `en_preparacion` responde 409. Sigue en `pago_pendiente`.

La contraentrega entregada con pago pendiente entra a recaudo y no pasa a `pagado` por prepararse, despacharse ni entregarse.

El pedido histórico sin `stockDeducted`, sin historial y sin `deliveredAt` entra a revisión. `countDeliveries` sobre enero de 2024 devolvió 0.

La bandeja de comunicaciones usa el mismo predicado de fallo activo de la Fase 2. Con la bandera de entrega apagada, el pedido que publicó un evento también apareció allí (comunicaciones 1 en F3-I01). Es la consecuencia del criterio compartido, no un pedido duplicado dentro de la misma bandeja.

Los contadores de F3-I03 y F3-I06 salen del mismo resultado que la página pedida. La página 2 no repite la página 1 y el total no se calcula con las filas visibles.

## 6. Evaluación del dashboard

La primera región es “Requieren atención”, con acceso directo a preparar, despachar, incidencias, recaudo y comunicaciones. Debajo quedan el tránsito, las alertas y la auditoría. La actividad comercial va después y declara que las ventas del mes excluyen cierres e incidencias.

El vendedor ve las bandejas operativas. La de recaudo aclara que el registro lo hace un administrador. La de comunicaciones no se muestra. El recorrido B18 lo comprobó en Chrome.

En la captura de escritorio, cinco tarjetas con cifras y una frase de ayuda preceden a los $80.000 conciliados. La fecha visible de un pedido creado a las 14:00 UTC se lee como las 9:00 a. m. en Colombia. Un error de API sustituye las tarjetas por un aviso y un reintento (B17); no pinta ceros.

La frase “Cada tarjeta lo cuenta una sola vez” se entiende junto con la oración anterior, que admite que un pedido necesite más de una revisión. Conviene mantener ambas a la vista: un enviado con incidencia suma en tránsito y en revisión.

## 7. Evaluación del detalle y acciones

`operationalActions` consulta `allowedTransitions`. La pantalla no tiene una segunda máquina de estados. Preparar, despachar, entregar y recaudar salen de esa respuesta. Despacho, entrega, recaudo, consulta Wompi, cancelación y devolución piden confirmación. Cancelar y devolver exigen un motivo de al menos cinco caracteres.

El formulario de despacho pide transportadora y guía en el mismo envío. La entrega anuncia que no registra recaudo. El recaudo pide referencia y hora, y el navegador convirtió `2026-11-19T12:30` en `2026-11-19T17:30:00.000Z`, que es esa hora en UTC−05:00.

`returnTo` solo acepta la ruta de la lista y su consulta. B03 volvió a `tray=all&limit=2&paymentMethod=contra_entrega&page=2`.

WhatsApp es un enlace `wa.me` con el texto del estado visible. El recorrido interceptó `window.open` y las operaciones lo dejaron en cero. El texto de la ficha dice que abrir la conversación no envía un mensaje.

Una respuesta 5xx después de registrar la operación deja el botón deshabilitado hasta “Actualizar pedido” (B20). Una repetición HTTP del mismo estado responde 200 y el mensaje “Estado actualizado”, con una sola línea de historial y una sola notificación. El efecto comercial no se duplica. El texto de esa respuesta es más amplio que el cambio real; queda como observación baja.

## 8. Integridad de pedidos y pagos

Despachar y entregar una contraentrega dejan `paymentStatus` en `pendiente`. El recaudo es otra operación, posterior a la entrega, reservada al administrador y con referencia.

Wompi pendiente no se prepara ni se aprueba con un botón manual. La consulta al proveedor sigue siendo la vía de conciliación y, en esta auditoría, no se llamó a Wompi.

Una incidencia activa saca el pedido de preparar y despachar. El segundo intento de guía sobre el enviado con incidencia respondió 409. La pantalla de revisión no ofrece preparar ni despachar (B10).

Tres despachos concurrentes produjeron una notificación `order.shipped`. Tres entregas concurrentes produjeron una `order.delivered`. El historial de cada estado quedó en una entrada. El stock medido antes y después coincidió.

Las lecturas de lista, dashboard y detalle conservaron `updatedAt`, el pago y el stock.

Un cancelado con pago recibido y una incidencia financiera quedó fuera de la venta conciliada del mes. La regresión de Fase 1, incluida en las 162, volvió a pasar.

## 9. Permisos del vendedor

El detalle del vendedor ofrece “Pendiente de recaudo” y niega `canCollect` y `canCancel`. El botón de recaudo, la conciliación Wompi y la cancelación no se renderizan (B09).

El endpoint de recaudo respondió 403. La bandeja `communications` respondió 403. El documento guardaba `unitCost` 424242 y el JSON del vendedor no lo incluía.

Enviar de nuevo el estado `entregado` junto con `paymentStatus: pagado` respondió 200 y el pago siguió `pendiente`. El cuerpo no puede convertir la entrega en un recaudo.

## 10. Evaluación UX/UI

El recorrido esencial cabe en las pantallas actuales.

1. El administrador ve la tarea y abre la bandeja.
2. En el detalle, “Comenzar preparación” es la acción principal y explica que el recaudo va después.
3. “Registrar envío y despachar” reúne transportadora y guía, y pide confirmación.
4. “Registrar entrega” confirma y deja el pago pendiente.
5. Solo entonces aparece “Registrar recaudo”, con referencia y hora de Colombia.

Pago, entrega y recaudo tienen etiquetas distintas en la cabecera, en la acción y en la ficha de pago. La lista y el detalle usan la misma acción del backend. Los filtros viajan en la URL y “Volver a pedidos” los restituye. Carga, error, bandeja vacía y búsqueda sin coincidencias tienen textos distintos.

Recomendaciones visuales, que no impiden completar el trabajo:

- Preparar se confirma con un clic. Despachar, entregar y recaudar tienen un segundo paso. El doble clic de preparar ya queda bloqueado.
- En menos de 760 px la columna de transportadora se oculta. El detalle sigue mostrando guía y transportadora.
- La pestaña de la lista dice “Comunicaciones” y la tarjeta del dashboard dice “Comunicaciones por revisar”.

## 11. Pruebas de navegador y responsive

Se compilaron los componentes reales con el CSS del módulo y se abrieron en Chrome headless, contra una API HTTP ficticia en el propio proceso. Resultado: **B01–B20 aprobadas, sin errores de página y sin solicitudes externas**. Copia: `navegador-reproduccion.json`. Capturas regeneradas: `capturas/`.

| Vista | Escritorio 1440 | Tablet 820 | 390 px | 360 px |
|---|---|---|---|---|
| Dashboard | Revisada | Revisada | Revisada | Revisada |
| Lista | Revisada | Revisada | Revisada | Revisada |
| Detalle | Revisada | Revisada | Revisada | Revisada |

El propio recorrido midió que el ancho del documento no supera el viewport y que el título de la tabla móvil queda por debajo de 60 px. En las capturas, las tarjetas de atención se leen antes que las ventas, la lista móvil pasa a fichas y el detalle muestra la acción, el total y la separación entre entrega y recaudo. El foco del confirm de despacho quedó en el botón al abrirse (B05). Los campos comprobados tienen etiqueta (B15).

Estados ejercidos en ese Chrome, además de las capturas de reposo: carga, error de lista, error de detalle, error de dashboard, bandeja vacía, búsqueda sin coincidencias, confirmaciones y bloqueo tras una respuesta perdida.

**Pendiente:** un recorrido con el servidor Next.js y el backend de pruebas, con sesión autenticada. No se inició para no interferir con un servidor local ni leer `.env`. Esa condición no queda aprobada por la lectura del JSX.

## 12. Evaluación de rendimiento

`queryWorkspace` hace una agregación. El filtro base se aplica una vez. Para un administrador, un `$lookup` a `notifications` trae como máximo una falla activa por pedido. `$facet` calcula los conteos de todas las bandejas y, en la misma lectura, ordena, salta y limita las filas de la bandeja pedida. El límite queda entre 1 y 50. No hay una consulta HTTP por fila.

Medición local, base efímera, 251 pedidos insertados (250 operativos y un cancelado pagado):

| Medición | Valor |
|---|---|
| `GET` preparar, página 2, 15 filas | 112 ms |
| Total de esa bandeja | 125, igual al conteo |
| Dashboard posterior, en el mismo proceso | 122 ms |
| Plan de un `$match` simple por `orderStatus` | COLLSCAN |
| Índices presentes | `_id`, `orderNumber`, `user+createdAt`, `buyer.email`, `idempotencyKey` |

El plan COLLSCAN corresponde a esa consulta simple, no al pipeline completo. El tiempo de 112 ms sí incluye la lista real de la bandeja. No se crearon índices. Esta cifra no describe producción.

El riesgo de crecimiento está en aplicar el lookup de notificaciones a todo el universo filtrado antes de paginar, en la búsqueda por expresión regular y en el salto de las páginas altas. El PDF recorre como máximo 10 páginas de 50. El dashboard, además, sigue contando catálogo, usuarios y auditoría en consultas aparte. Con el volumen de la prueba la respuesta se mantuvo por debajo de un segundo.

## 13. Lint, sintaxis y build

`verificar-estatico.cjs` sobre los 13 archivos Node de la fase: sintaxis correcta, 0 fallos. ESLint de esos archivos: 0 errores y 0 avisos.

ESLint de las seis pantallas reorganizadas: 0 errores y 1 aviso. El aviso es `@next/next/no-img-element` en `OrderDetail.jsx`, línea 80. La comparación con `HEAD` para esos archivos tenía 2 errores y 3 avisos; `newMessages` quedó vacío, así que el aviso de la imagen ya existía. Los errores de hooks de esas pantallas no reaparecen.

Build aislado de Next.js con webpack: salida 0, copia temporal, sin archivos `.env`, sin credenciales heredadas y con `fetch` y TCP bloqueados. Evidencia: `build-reproduccion.json`.

`backend/package.json` solo añade el script `test:phase3`. No hay dependencias nuevas. Las plantillas de correo no están en el diff de la fase. La máquina de estados sigue en `orderTransitions.js` y la aptitud de despacho en `orderReadiness.js`, usado también por la transición.

El índice duplicado de `requestNumber` en solicitudes especiales vuelve a avisarse al cargar Mongoose. Es anterior a esta fase.

## 14. Hallazgos nuevos por severidad

**Alta:** ninguna.

**Media:** ninguna.

**Baja:**

1. Repetir el mismo estado responde 200 y el texto “Estado actualizado”, aunque el historial y las notificaciones queden en una sola entrada. La interfaz bloquea el doble clic y exige actualizar el pedido si la respuesta se pierde.
2. La frase del dashboard sobre el conteo por tarjeta necesita leerse con la oración que admite varias revisiones para el mismo pedido.
3. Preparar no tiene el cuadro de confirmación que sí tienen despacho, entrega y recaudo.
4. Por debajo de 760 px la lista oculta la transportadora. El detalle la conserva.
5. La lista operativa, con los índices actuales, puede recorrer la colección y resolver notificaciones antes de paginar. En 251 documentos locales la página respondió en 112 ms.

Ninguna de estas observaciones impide preparar, despachar, entregar o recaudar, ni altera la clasificación del dinero.

## 15. Regresiones de Fases 1 y 2

Las 57 pruebas de Fase 1, las 5 de su cierre, las 53 de Fase 2, las 9 independientes de notificaciones y las 4 del ajuste de stock volvieron a pasar dentro de las 162.

La venta conciliada del dashboard ignoró el cancelado pagado de la prueba de volumen. El bloqueo del ajuste de stock sigue cubierto por sus cuatro pruebas. Las comunicaciones se recargan después de una operación y, en F3-I05, el historial mostró una sola “Entrega registrada”. La bandera `TRANSACTIONAL_NOTIFICATIONS_ENABLED` permaneció en `false`.

La observación de Fase 2 sobre saltos de línea en el texto plano del correo sigue fuera de este alcance. El cupón que no libera su uso al cancelar tampoco entra en esta fase y no fue reabierto.

## 16. Limitaciones externas

Siguen pendientes, y este cierre no las convierte en aprobadas:

- Infraestructura donde las transacciones de MongoDB se confirman, y la migración del índice de idempotencia antes de usar datos históricos.
- Aceptación real de Resend, entrega al buzón y enlace de pago Wompi en un entorno autorizado.
- La bandera de notificaciones transaccionales permanece apagada.
- El recorrido integrado de Next.js con el backend de pruebas y una sesión autenticada quedó pendiente.
- No hubo prueba con lector de pantalla ni certificación WCAG. El teclado se comprobó en el foco del confirm y en un tabulador sobre componentes reales.

No se ejecutaron migraciones, no se leyó `.env`, no se envió correo ni se creó un pago.

## 17. Veredicto final

**PASS WITH BLOCKERS.**

El cierre funcional local de la Fase 3 queda sostenido por las 162 pruebas reproducidas, las 6 pruebas nuevas y el recorrido de los componentes reales en Chrome. La clasificación, los permisos, la separación entre entrega y recaudo y la recuperación de una respuesta ambigua permiten completar la operación diaria.

La autorización de despliegue queda pendiente de las verificaciones externas de las Fases 1 y 2 enumeradas en la sección 16. Esta auditoría no inicia la Fase 4.
