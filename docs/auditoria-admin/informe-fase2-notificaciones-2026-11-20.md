# DIZOR — Informe de Fase 2: comunicaciones transaccionales

Fecha: 20 de noviembre de 2026. Alcance: implementación y verificación local con datos ficticios. Estado: **lista para auditoría independiente local**. No se certifica aceptación ni entrega real de correo.

## 1. Resumen ejecutivo

Se implementó una bandeja persistente de salida para los eventos de pedidos y pagos, reutilizando MongoDB, las transacciones existentes y el cliente Resend. La operación comercial publica el evento; un trabajador separado entrega el mensaje. Los reintentos no ejecutan operaciones financieras ni movimientos de inventario.

El administrador dispone de historial por pedido, reintento de la misma comunicación y reenvío explícito confirmado, con responsable y motivo. Las alertas existentes incluyen fallos de comunicación e inventario por variantes. El vendedor conserva acceso de consulta limitado.

La regresión conjunta aprobó **119/119 pruebas**: 57 originales de Fase 1, 53 nuevas de Fase 2, cinco de compatibilidad con el cierre independiente y cuatro del ajuste de stock. Pasaron ocho comprobaciones de navegador, sintaxis y build local aislado. ESLint no introduce diagnósticos nuevos; persisten cuatro errores y dos advertencias anteriores en los archivos frontend intervenidos y una advertencia anterior en backend.

La entrega externa exige `TRANSACTIONAL_NOTIFICATIONS_ENABLED=true`, además de la configuración existente de Resend. **No se activó esta variable, no se editaron secretos y no se enviaron correos reales.** Los eventos quedan persistidos aunque la entrega esté desactivada. No hubo despliegues, migraciones reales, pagos reales, commits ni pushes.

## 2. Arquitectura implementada

Se revisaron el informe general de auditoría, el informe de integridad de Fase 1, el cierre independiente, su informe de correcciones y sus pruebas. Se conservaron la definición financiera conciliada y la protección inmediata del ajuste de stock.

El flujo es:

1. Checkout, transición de pedido o resultado Wompi verificable determina un evento comercial.
2. `notificationEvents` hace un upsert de la notificación **en la misma sesión transaccional** que confirma el cambio del pedido. Un rollback también elimina la publicación.
3. `notificationDelivery` reclama atómicamente una fila disponible, verifica destinatario y vigencia del evento, congela el mensaje y llama al cliente Resend existente fuera de la transacción.
4. El resultado se guarda con un código controlado, historial y programación de recuperación cuando procede.
5. Historial y alertas consultan esa evidencia; no infieren entrega a partir del estado del pedido.

Se retiraron del checkout y de los controladores de despacho las llamadas directas anteriores. `orderReceiptService` conserva su interfaz de compatibilidad y el constructor del acuse, pero publica en la bandeja. Los puntos antiguos de correo de pedidos delegan en ella. No hay un segundo servicio de entrega para esos eventos.

El trabajador se inicia con el servidor únicamente cuando la entrega está habilitada. Ejecuta un ciclo inmediato y cada 30 segundos, con exclusión local y reclamación persistida entre procesos; procesa hasta 20 comunicaciones por ciclo. No incorpora Redis, colas externas ni otro servicio. Esta integración de código no constituye una validación de infraestructura productiva.

## 3. Archivos modificados y nuevos

Las rutas siguientes son relativas a la raíz del repositorio `dizor`.

| Archivos | Cambio |
|---|---|
| `backend/src/models/notification.js` (nuevo) | Bandeja, claves únicas, historial, reclamación y relaciones de reenvío. |
| `backend/src/services/notificationEvents.js` (nuevo) | Publicación central por evento lógico y destinatario. |
| `backend/src/services/notificationTemplates.js` (nuevo) | Instantánea permitida, HTML escapado y texto plano. |
| `backend/src/services/notificationDelivery.js` (nuevo) | Entrega, recuperación, autorización, idempotencia y reintentos. |
| `backend/src/controllers/notificationAdminController.js` (nuevo) | Historial, reintentar, reenviar y alertas agrupadas. |
| `backend/src/models/order.js` | Revisión de guía, origen de cancelación y fecha de comprobación de comunicaciones. |
| `backend/src/models/paymentEvent.js` | Marca de recuperación de aviso de incidencia. |
| `backend/src/services/orderOperations.js` | Publicación dentro de la transacción de cambios; opción acotada de no tocar `updatedAt`. |
| `backend/src/services/orderService.js` | Publicación del registro de pedidos listos. |
| `backend/src/controllers/checkoutController.js` | Acuse al finalizar registro y origen de autocancelación; elimina envío administrativo directo. |
| `backend/src/services/wompiPaymentService.js` | Publicación del resultado confirmado y recuperación de avisos de incidencias. |
| `backend/src/services/wompiService.js` | Consulta verificable del enlace para alternativas de pago rechazado. |
| `backend/src/controllers/orderAdminController.js` | Elimina disparadores de despacho duplicados. |
| `backend/src/services/orderReceiptService.js`, `emailService.js` | Compatibilidad con la bandeja y reutilización del cliente Resend. |
| `backend/src/routes/adminOrderRoutes.js` | Rutas de comunicaciones con permisos explícitos. |
| `backend/src/server.js` | Inicialización de la nueva colección y ciclo de entrega optativo. |
| `backend/src/controllers/adminAlertController.js`, `dashboardAdminController.js` | Fallos de comunicación y alertas de variantes; indicador reutilizable. |
| `backend/package.json` | Comando `test:phase2`, sin dependencias nuevas. |
| `frontend/src/components/admin/OrderCommunications.jsx`, `OrderCommunications.module.css` (nuevos) | Historial compacto, estados, confirmación y bloqueo inmediato. |
| `frontend/src/components/admin/CommunicationAlerts.jsx` (nuevo) | Avisos agrupados con enlace al pedido. |
| `frontend/src/components/admin/OrderDetail.jsx`, `AlertBell.jsx` | Integración puntual en vistas existentes. |
| `frontend/src/app/admin/alertas/page.js` | Comunicaciones, conciliación y detalle de variantes afectadas. |
| `frontend/src/services/orderAdminService.js` | Tres operaciones de API de comunicaciones. |
| `backend/test/phase2.test.js`, `backend/test/helpers/phase2Fixture.cjs` (nuevos) | 53 pruebas y fixture aislado reutilizado. |
| `backend/test/phase2-compatibility.test.js` (nuevo) | Ejecuta las cinco regresiones de cierre sin alterar la evidencia anterior. |
| `frontend/test/communications-browser.cjs` (nuevo) | Verificación real del componente React en Chrome aislado. |
| `docs/auditoria-admin/fase2-evidencias/` (nuevo) | Resultados, capturas, previsualizaciones y scripts reproducibles de build y estática. |

No se editaron las pruebas originales de Fase 1 ni los archivos del cierre independiente. Se conservaron los cambios concurrentes del Home, estilos públicos, detalle de producto y reseñas; no se atribuyen a esta implementación. El build verifica la instantánea local disponible al ejecutarlo.

## 4. Matriz de eventos y destinatarios

| Hecho confirmado | Evento | Destinatario | Condición y contenido |
|---|---|---|---|
| Pedido registrado | `order.received` | Comprador del pedido | Acuse, productos, valores y condiciones configuradas. Un enlace Wompi no implica pago. |
| Contraentrega registrada | `admin.ready` | `ADMIN_NOTIFY_EMAIL` | Solo con inventario aplicado y sin bloqueo de revisión. No significa recaudo. |
| Wompi aprobado sin bloqueo | `payment.approved` | Comprador | Pago verificado; no afirma despacho ni entrega. |
| Wompi aprobado y preparable | `admin.ready` | `ADMIN_NOTIFY_EMAIL` | Una sola publicación lógica de pedido listo. |
| Wompi rechazado, anulado o con error | `payment.declined` | Comprador | Resultado del intento y atención; enlace solo tras verificación. No cancela el pedido. |
| Aprobación con revisión pendiente | `payment.review` | Comprador | Mensaje diferenciado de revisión; no confirma preparación ni reembolso. |
| Incidencia financiera o de aplicación del pago | `admin.incident` | `ADMIN_NOTIFY_EMAIL` | Revisión administrativa; no habilita preparación. |
| Aprobación después de cancelación | `admin.incident` | `ADMIN_NOTIFY_EMAIL` | Conserva evidencia. No publica confirmación normal de compra ni pedido listo. |
| Despacho registrado | `order.shipped` | Comprador | Transportadora y guía registradas. |
| Corrección posterior de guía/transportadora | `shipping.corrected` | Comprador | Nueva revisión distinguible; no vuelve a enviar la guía pendiente obsoleta. |
| Entrega registrada | `order.delivered` | Comprador | Distingue entrega de confirmación del recaudo contraentrega. |
| Cancelación registrada | `order.cancelled` | Comprador | Estado de pago al cancelar; nunca confirma un reembolso sin evidencia. |
| Cancelación del cliente | `admin.cancelled` | `ADMIN_NOTIFY_EMAIL` | Se añade al aviso del comprador; una cancelación administrativa no se atribuye al cliente. |
| Fallo de comunicación | Indicador del panel | Administrador | Error controlado, intentos y recuperación. No genera otro correo de error. |
| Variante baja/agotada o sin variantes disponibles | Alerta del panel | Administrador | Agrupada por producto; SKU y stock afectado. Sin campañas de inventario. |

Preparar un pedido no crea una segunda confirmación de pago ni otro aviso de pedido listo. Antes de entregar se descartan resultados de pago o guías que ya contradigan el pedido actual. Una comunicación aceptada representa un hecho histórico; la bandeja no puede retirar un correo ya aceptado por el proveedor.

## 5. Plantillas creadas o reutilizadas

Las once plantillas de la matriz de correo comparten estructura de tablas, estilos inline, ancho máximo de 600 px, colores negro/arena y fuentes de sistema/Georgia. No requieren imágenes ni recursos externos para comprender el contenido. Cada una produce HTML escapado y texto plano. Los mensajes están en español y reutilizan la identidad y atención configuradas en `businessInfo`.

La instantánea permite exclusivamente número de pedido, comprador, productos/variantes, valores de compra, dirección cuando procede, método/estado, transportadora, guía y condiciones de entrega guardadas. Excluye costos internos, notas privadas, tokens, credenciales y datos de tarjetas. Los errores del proveedor no se interpolan en el correo ni en la respuesta administrativa.

Para rechazo Wompi se consulta el enlace con timeout y se comprueban identificador, estado activo, moneda COP, monto, vencimiento cuando existe y coincidencia con la URL registrada. Solo se admite el dominio HTTPS de checkout Wompi y la ruta de enlace, sin parámetros arbitrarios. Si la verificación falla se ofrece atención, sin inventar una URL ni prometer disponibilidad futura. No se inventaron enlaces de seguimiento de transportadoras.

Se reutilizó el acuse existente mediante su fachada, preservando las condiciones de entrega configuradas. Recuperación de contraseña, solicitudes especiales y marketing conservan sus servicios anteriores: no se migraron ni activaron en esta fase.

## 6. Persistencia

`Notification` almacena pedido, evento, audiencia, correo autorizado, canal, estado, fechas, intentos, aceptación, identificador del proveedor, error controlado, próximo intento, historial y datos de reclamación. El reenvío añade responsable, motivo, referencia al original y relación de reemplazo. Destinatario completo, cuerpo, instantánea y motivo se excluyen de la selección habitual y no se retornan en el historial operativo.

Hay claves únicas para el evento lógico y la solicitud manual, e índices nuevos para recuperar filas por estado/fecha y por pedido. Solo se crearon en bases efímeras de prueba. No se cambiaron índices históricos ni se ejecutaron migraciones o backfills reales.

La recuperación de incidencias usa las evidencias existentes, incluso incidentes históricos sin `_id` ni fecha. Su identidad se deriva de posición y hechos dentro del historial append-only; evita usar los identificadores que Mongoose puede generar al leer documentos antiguos. Para un `PaymentEvent` aprobado interrumpido hay una espera mínima de un minuto antes de publicar el aviso de revisión; esto **no es un plazo para cancelar pedidos Wompi**. No se vuelve a aplicar el pago ni el stock.

Los metadatos exclusivos de comunicaciones se guardan con `timestamps:false`; no alteran la fecha operativa del pedido ni indicadores como despachos del día. La opción de `mutateOrder` únicamente permite ese ajuste de timestamp: no reemplaza la sesión transaccional ni la validación.

Los acuses históricos con `sentAt`/`claimedAt` se muestran como registros anteriores sin evidencia verificable en esta bandeja. No se reenvían automáticamente. No se reconstruyó un historial de correos que el sistema anterior no conservaba.

## 7. Idempotencia, concurrencia y reintentos

- Clave SHA-256 de pedido, tipo, identidad lógica, destinatario y canal; upsert transaccional e índice único. Webhooks repetidos y concurrentes conservan una fila por evento lógico.
- Reclamación atómica con lease de 60 segundos y token de propietario; solo ese propietario puede finalizar su reclamación. Timeout externo de 10 segundos y recuperación de leases vencidos.
- Mensaje completo congelado antes de la primera llamada externa. Reintentos conservan **clave y cuerpo**, aun si cambia la configuración. La autorización vuelve a comprobar destinatario y vigencia del evento.
- Hasta cinco intentos, con esperas de 1 minuto, 5 minutos, 30 minutos y 2 horas para fallos recuperables. Errores permanentes no se repiten automáticamente. Ausencia de configuración queda como no enviado, recuperable manualmente.
- Se utiliza la clave de idempotencia del SDK Resend. Resend documenta retención de 24 horas; el sistema limita la recuperación automática a 23 horas desde el primer intento externo. Después exige revisión y no convierte una aceptación ambigua en un correo nuevo. Véase [documentación oficial de Resend](https://resend.com/changelog/idempotency-keys).
- Si el proceso falla después de aceptación pero antes de persistirla, el lease vencido recupera la **misma** comunicación y clave. La prueba simula el registro idempotente del proveedor; no verifica el servicio real.
- Un reintento administrativo conserva la fila y no reinicia el contador indefinidamente. El reenvío explícito crea una fila nueva, exige confirmación/motivo y, si el resultado anterior es ambiguo, reconocimiento del posible duplicado.
- El reenvío reemplaza la vía de recuperación anterior: `supersededBy`, `retryable=false` y sin próximo intento. Conserva el historial, evita que corran simultáneamente el reintento original y la copia, y cierra ramas adicionales desde el mismo original. Si la copia falla, la recuperación continúa desde ella.
- En React una referencia bloquea el envío **antes del siguiente render**. La misma acción conserva clave y contenido tras una respuesta ambigua; botón, edición y cancelación se bloquean cuando corresponde. El backend serializa también solicitudes con claves distintas para el mismo original.

No se promete entrega exactamente una vez sin límites: un reenvío deliberado de un resultado ambiguo puede duplicar un correo que el proveedor ya aceptó. La interfaz lo explica y exige reconocimiento; la ventana del proveedor no se prolonga artificialmente.

## 8. Estados de envío

| Estado persistido | Presentación | Evidencia |
|---|---|---|
| `pending` | Pendiente | Publicación guardada, todavía no aceptada. |
| `processing` | En procesamiento | Reclamación activa de un trabajador. |
| `sent` | Aceptado por el proveedor | Respuesta satisfactoria con identificador; conserva `acceptedAt`. |
| `failed` | Fallido | Fallo temporal, permanente o resultado ambiguo, con código y política de recuperación. |
| `skipped` | No enviado | Configuración ausente, entrega desactivada, destinatario inválido/cambiado o evento obsoleto. |
| `delivered` | Entrega verificada | Estado reservado para evidencia futura verificable; esta fase no lo asigna por aceptación. |

No se implementó un webhook de entrega de Resend. No hay evidencia de llegada a Gmail, Outlook ni otro buzón. Las fechas de aceptación de las pruebas son simuladas.

## 9. Integración en el administrador

El detalle de pedido incluye una sección compacta con evento, destinatario enmascarado, fecha, estado, intentos, último intento, aceptación, próximo reintento y error controlado. Tiene paginación de 20 registros, actualización, mensajes de carga/error/éxito y confirmación inline accesible mediante teclado. No se añadió una entrada principal al menú ni se rediseñaron tablas o checkout.

Las alertas agrupadas muestran hasta diez grupos recientes por pedido y error, con contador total y enlace al detalle. Separan fallos temporales, permanentes y configuración ausente de las incidencias financieras. Las filas históricas reemplazadas no siguen apareciendo como fallos activos sin resolver. El dashboard expone el dato para reutilización posterior, conservando su diseño.

Inventario conserva umbral 5 y total real del producto, identifica SKU/stock de variantes activas afectadas y productos sin variantes activas disponibles. Si hay agotados, se muestra una sola entrada del producto con sus variantes afectadas. La gestión completa de inventario queda fuera de este alcance.

## 10. Permisos, privacidad y separación de canales

| Rol | Consulta | Recuperación |
|---|---|---|
| Admin / superadmin | Comunicaciones del pedido, destinatario enmascarado e historial controlado; alertas existentes. | Reintentar cuando la política lo permite; reenvío confirmado y auditado. |
| Vendedor | Solo comunicaciones al comprador necesarias para la operación. Sin correo administrativo, cuerpo, instantánea ni historial interno. | No puede reintentar ni reenviar. |
| Cliente / anónimo | Sin acceso a estas rutas administrativas. | Sin acceso. |

Las acciones validan simultáneamente ID de pedido y de comunicación. No admiten un correo de destino enviado desde la interfaz. El trabajador verifica el correo del comprador asociado al pedido o el administrativo configurado antes de cada intento. Un cambio de destinatario requiere revisión, en vez de entregar a un correo anterior.

Las rutas nuevas usan la autenticación y autorizaciones existentes. Los motivos y responsables se conservan para auditoría sin exponer notas privadas al vendedor. No se incorporaron suscripciones comerciales ni recordatorios de carrito abandonado; Nequi directo/manual sigue desactivado. No se amplió ninguna automatización de WhatsApp.

## 11. Pruebas ejecutadas y cobertura

Evidencias y comandos: [fase2-evidencias/README.md](fase2-evidencias/README.md).

| Grupo | Casos | Resultado |
|---|---:|---|
| Fase 1 original, sin editar | 57 | Aprobados |
| Fase 2 `N01–N53` | 53 | Aprobados |
| Cierre independiente y coherencia financiera/exportaciones | 5 | Aprobados |
| Ajuste de stock frontend | 4 | Aprobados |
| **Regresión conjunta** | **119** | **119 aprobados, 0 fallidos, 0 omitidos** |
| Navegador Chrome / componente React real con API aislada | 8 comprobaciones | Aprobadas; sin errores de página ni solicitudes externas observadas por el harness |
| Sintaxis Node | 25 archivos | Sin errores |
| Build Next local aislado | 1 | Salida 0 |

Cobertura de los 30 escenarios solicitados:

| Escenarios | Pruebas |
|---|---|
| Contraentrega, Wompi sin pagar, aprobación/rechazo, enlace utilizable | N01–N06 |
| Webhook repetido y tres eventos concurrentes | N07–N08 |
| Preparado, despacho, corrección de guía, entrega | N09–N12, N34, N42 |
| Cancelación de cliente y administrativa, aprobación tardía, falta de stock | N13–N16 |
| Configuración ausente, fallos temporales/permanentes, reintentos | N17–N21, N30, N37–N38, N44, N46, N53 |
| Reenvío, solicitudes simultáneas, historial y motivo | N22–N23, N36, N41, N51–N52; doble clic real en navegador |
| Vendedor, acceso no autorizado y pedido ajeno | N24–N25, N35, N40 |
| HTML escapado, privacidad y destinatarios | N26–N27, N35, N39 |
| Rollback y reejecución tras interrupción | N28–N29, N43, N47–N50 |
| Alertas agrupadas y variantes agotadas | N31–N32 |
| Regresión del acuse y registro histórico | N33, N45 y D2 de Fase 1 |

Las pruebas verifican la presencia de eventos requeridos y la ausencia de confirmaciones prohibidas. Comprueban que un fallo de entrega no cambia estados financieros ni inventario. El fixture usa bases efímeras en `127.0.0.1`, replica set, datos `.test`, transporte simulado, claves ficticias y bloqueo de salida externa. No carga `.env` ni arranca el servidor real.

## 12. Resultados y evidencia verificable

- `regresion-completa.txt`: ejecución conjunta de 119 pruebas.
- `compatibilidad-cierre.txt` y `cierre-independiente-resultados.json`: comprobación independiente reutilizada; se conservan sus aserciones originales.
- `navegador.json` / `navegador.txt`: estados, teclado, doble clic, procesamiento/éxito, recuperación, solicitud ambigua con misma clave, vendedor y móvil de 360 px.
- `comunicaciones-escritorio.png`, `comunicaciones-movil.png`: capturas del componente real.
- `correo-recepcion-escritorio.*`, `correo-despacho-movil.*`: HTML, texto plano y capturas de plantillas con datos ficticios.
- `estatico-resumen.json`, `sintaxis.json`, `eslint-*.json`: resultados y comparación contra `HEAD` de los archivos existentes.
- `build-fase2.json` / `build-fase2.txt`: compilación Next.js `--webpack` en copia temporal, sin `.env`, credenciales heredadas ni acceso fetch/TCP.

El build y la comprobación estática usan dependencias ya presentes. El navegador usa Chrome con perfil temporal, componente compilado y API ficticia propia. Las capturas de correo verifican el render en Chrome; no sustituyen pruebas dentro de clientes de correo reales.

## 13. Errores y limitaciones

**No se identificaron defectos funcionales locales pendientes dentro de la cobertura ejecutada.** Esto no sustituye la auditoría independiente ni extiende la garantía a casos no probados.

ESLint completo del frontend intervenido sigue devolviendo cuatro errores anteriores: dos en `app/admin/alertas/page.js` (`set-state-in-effect`, `purity`), uno en `AlertBell.jsx` y uno en `OrderDetail.jsx` (`set-state-in-effect`). Persisten dos advertencias anteriores de dependencias de efecto/imagen en `OrderDetail.jsx`. Los componentes nuevos y el servicio modificado no generan diagnósticos. La comparación conserva los mensajes y marcos de código antes/después; el desplazamiento de líneas no se trata como un error nuevo.

Backend no tiene una configuración ESLint propia. Se aplicaron explícitamente `no-unreachable`, `no-dupe-keys` y `no-unused-vars`: cero errores y una advertencia previa por importación no usada de `addIncident` en checkout. Esto es lint básico explícito, no una afirmación de cobertura de reglas de un proyecto backend inexistente. `git diff --check` no detectó errores de espacios.

Otros límites: recuperación mediante polling y ciclos acotados; conservación sin política de borrado de la bandeja; no hay confirmación real de entrega ni rebotes del proveedor; los errores permanentes y resultados ambiguos fuera de ventana requieren intervención. No se garantiza retirada de mensajes ya aceptados ni ausencia absoluta de duplicados frente a un reenvío deliberado. No hay backfill automático de acuses históricos.

## 14. Compatibilidad con Fase 1

Se mantienen pagos verificables, protección frente a webhooks repetidos, registro de dinero con incidencias, separación entre entrega y recaudo, transacciones y control de stock. Las notificaciones no modifican las reglas de transición ni la definición central de venta conciliada.

Las pruebas del cierre volvieron a comprobar un solo pedido válido por $80.000 en reporte e historial, exclusión de cancelaciones/disputas y coherencia de indicadores, métodos, tendencia y exportaciones CSV/XLSX/PDF. También verifican ajustes concurrentes con compras, claves reutilizadas y conflicto por distinto movimiento. Las cuatro pruebas frontend conservan la protección síncrona contra doble clic del ajuste.

El runner de compatibilidad ejecuta las pruebas anteriores sin modificar sus aserciones y redirige exclusivamente su JSON generado a esta fase. Algunos campos `detail.note` de ese JSON contienen el diagnóstico histórico literal del auditor original: **no son hallazgos actuales**. Los veredictos y valores comprobados corresponden a esta ejecución; todos pasan.

## 15. Validaciones externas pendientes

Pendientes externos, distintos de defectos funcionales locales:

1. Aceptación real con cuenta Resend y remitente de un entorno de pruebas expresamente autorizado; comprobar identificador e idempotencia reales.
2. Llegada al buzón, spam, rebotes y render en Gmail, Outlook y móviles reales. Esta fase no afirma que esos correos fueron entregados.
3. Alternativa de enlace Wompi en sandbox autorizado; aquí solo se usó su simulación, respetando la [documentación de enlaces Wompi](https://docs.wompi.co/docs/colombia/links-de-pago/).
4. Si se solicita posteriormente evidencia `delivered`, diseñar y verificar la recepción autenticada de eventos del proveedor antes de asignar ese estado.

No se realizaron estas validaciones ni tareas de despliegue o infraestructura productiva. La bandera de activación es un control del código entregado; permanece desactivada. La configuración, operación e índices en producción requieren una actividad futura autorizada, fuera del alcance local de esta fase.

## 16. Recomendaciones para Fase 3

Reutilizar los indicadores de comunicaciones y la distinción entre pendiente, aceptación y entrega al revisar el dashboard. Resolver los errores previos de hooks en su alcance correspondiente. Revisar el flujo de WhatsApp ya existente en `OrderDetail`: se conservó sin ampliarlo y debe evitar competir con la confirmación explícita de operaciones. Evaluar visibilidad de antigüedad de pendientes, retención de evidencias y futura recepción de eventos de entrega con una decisión de alcance expresa.

Estas recomendaciones no se implementaron como Fase 3. La experiencia integral de inventario sigue reservada para Fase 4.
