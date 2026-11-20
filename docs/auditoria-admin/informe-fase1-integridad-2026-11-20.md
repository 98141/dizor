# DIZOR — Fase 1: integridad de pedidos, pagos e inventario

Fecha: 20 de noviembre de 2026. Alcance: implementación local para revisión, sin despliegue.

La regresión de esta fase pasó **57 pruebas, 0 fallidas, 0 omitidas**, contra MongoDB 7.0.24 temporal en replica set. Incluye los 22 escenarios de la auditoría convertidos en aserciones y 35 pruebas adicionales de reglas comerciales, concurrencia, repetición y fallo. No se usaron bases, credenciales, pagos, clientes ni correos reales. No se hicieron commits, pushes ni migraciones de datos.

La revisión local queda condicionada, antes de cualquier puesta en servicio, a comprobar el soporte de transacciones del entorno destino y preparar el cambio controlado del índice de idempotencia. Los errores de lint preexistentes y otras limitaciones se detallan abajo; no se declara un despliegue validado.

## 1. Referencias e inspección

La ruta real del documento obligatorio es `docs/auditoria-admin/informe-auditoria-admin-2026-11-20.md`, no `docs/informe-auditoria-admin-2026-11-20.md`. Se leyeron su diagnóstico, los 22 escenarios originales y sus resultados en `docs/auditoria-admin/evidencias/` antes de implementar. Los archivos originales de auditoría se conservaron.

Se localizaron los modelos Order/Product/Coupon, checkout, rutas de pedidos y catálogo, webhook, servicios Wompi e inventario, permisos y los componentes administrativos reales. No se trabajó en las copias `copia/` ni `despliegue/`. Los cambios concurrentes de Home, estilos, detalle de producto y reseñas no forman parte de esta fase y no se sobrescribieron.

## 2. Correcciones y relación con ADM

| Hallazgo | Corrección aplicada |
|---|---|
| ADM-01 | Despacho y entrega no cambian el pago. Contraentrega queda pendiente hasta registrar explícitamente el recaudo. |
| ADM-02 | Tabla central de transiciones por estado, método, pago, rol, inventario e incidencias. Rechaza saltos, reactivaciones y estados financieros por edición ordinaria. La UI recibe las transiciones permitidas del backend. |
| ADM-03 | La confirmación manual admite únicamente recaudo contraentrega por admin/superadmin. Wompi usa webhook verificado o consulta autenticada al proveedor. |
| ADM-04 | Confirmación manual sobre cancelado/devuelto/rechazado bloqueada; sin nuevos descuentos de stock. |
| ADM-05 | Rechazo Wompi no cancela el pedido. Una aprobación posterior puede completar el pago. Si ya se canceló, conserva la cancelación y el dinero recibido con incidencia visible. |
| ADM-06 | El cobro aprobado se persiste antes de intentar surtir el pedido. Faltantes, diferencias de monto/moneda y fallos quedan con evidencia e incidencia; no se autoriza preparación. |
| ADM-07 | La edición de producto ignora el stock absoluto recibido para variantes existentes. Ventas y edición usan transacciones; los ajustes son operaciones relativas separadas. |
| ADM-08 | Autocancelación limitada a antes de preparación y sin pago aprobado. Wompi se consulta cuando hay transacción identificada; un estado no verificable se remite a revisión. No hay reembolsos automáticos. |
| ADM-09 | Bandeja durable PaymentEvent y aplicación transaccional de pedido, stock, movimientos y cupón. Duplicados concurrentes no vuelven a descontar. |
| ADM-10 | Número nuevo con fecha de Bogotá y sufijo aleatorio criptográfico de 80 bits, protegido por índice único. Se elimina el conteo diario que colisionaba. Errores públicos sin detalles de MongoDB. |
| ADM-19 | Cantidades enteras positivas seguras en carrito/movimientos/pedido; stock entero no negativo en variantes nuevas y ajustes. |
| ADM-27 | Guía limitada a preparación/enviado y pago válido cuando corresponde. Registrar guía pasa por la misma transición; pedidos cerrados no admiten cambios de guía. |
| ADM-28 | Una sola declaración del índice único de número; idempotencia sin default null e índice parcial para cadenas. Se eliminaron declaraciones redundantes equivalentes de Product.slug y Coupon.code, conservando su unicidad. No se modificaron índices existentes en una base real. |

Correcciones vinculadas necesarias para que los casos originales se conviertan en regresiones útiles: ADM-12 (acuse sin proveedor no se declara enviado), ADM-14 (notas internas fuera del DTO de comprador), ADM-16/17 (contraentrega por preparar e incidencias en alertas existentes), ADM-18 (variantes agotadas visibles), ADM-20 (ventas conciliadas excluyen pagos en disputa/cancelaciones/devoluciones), ADM-21 (vigencia verificable de Wompi sin cancelaciones por antigüedad, conforme a la decisión comercial), ADM-22 (consumo de cupón en la misma transacción que pedido y stock), ADM-23 (costos fuera del detalle de vendedor), ADM-26 (búsqueda literal segura) y ADM-37 (asignación solo a personal activo). Son correcciones limitadas al flujo y a las regresiones; no completan todas las mejoras propuestas en esos hallazgos. No se añadieron plantillas de correo ni se reorganizó navegación.

## 3. Reglas de estados y permisos

Flujo operativo habitual: pendiente/pago_pendiente/pagado → en_preparacion → enviado → entregado. `pagado` operativo se conserva como etiqueta compatible con los datos anteriores; la entrega se acredita aparte con `deliveredAt` y `deliveredBy`.

- Contraentrega se puede preparar con stock descontado aunque el recaudo siga pendiente. Ni despacho ni entrega acreditan dinero.
- Para Wompi y otros métodos históricos electrónicos, preparar/enviar exige pago registrado, inventario asignado y ninguna incidencia activa.
- El recaudo contraentrega exige entrega registrada, referencia y fecha válida no futura. Se guarda fecha del recaudo, fecha del registro, responsable y comprobante opcional. No modifica el estado de entrega. Las repeticiones devuelven éxito sin nuevo recaudo, movimiento ni historial duplicado.
- Admin/superadmin pueden cancelar antes del despacho y registrar devolución desde enviado/entregado. Una operación con dinero recibido conserva ese hecho y deja pendiente su tratamiento administrativo. No se inventa un reembolso.
- Cancelado y devuelto no se reactivan por edición convencional. Un rechazo histórico solo puede cerrarse mediante cancelación administrativa.
- Vendedor consulta pedidos, prepara, despacha y registra entrega. No recauda, concilia Wompi, cancela, devuelve, asigna estados de pago ni recibe costos internos de los ítems. Las restricciones son del backend; las funciones de solicitudes especiales permanecen disponibles.
- Las incidencias resueltas por una conciliación segura conservan fecha de resolución y evidencia; no se borran. Diferencias financieras, pagos adicionales y aprobaciones sobre cancelaciones requieren tratamiento administrativo posterior.

## 4. Wompi, fallos e inventario

Se conservaron checksum SHA-256, comparación en tiempo constante, ventana de eventos y comprobación de entorno. Se exigen los campos mínimos firmados del proveedor. El webhook ya no busca mediante identificadores vacíos/undefined. Cada evento guarda ID, estado, monto, moneda, referencia, entorno, checksum y fecha del proveedor; sus reintentos comparten la misma clave.

Una aprobación registra `paymentStatus=pagado` y evidencia financiera antes de la operación transaccional de inventario. Si esta falla, devuelve error para permitir el reintento del proveedor y mantiene la incidencia. El reintento puede completar stock y resolver únicamente la incidencia técnica correspondiente. Una aprobación sin stock, de monto distinto o sobre cancelación no se transforma en rechazo del pago.

`POST /api/admin/orders/:id/reconcile-wompi` consulta el ID guardado con la llave privada configurada y aplica las mismas reglas. Solo admin/superadmin. Permite asignar stock después de una reposición; no permite escribir un estado aprobado en el cuerpo de la solicitud ni ejecutar reembolsos.

Pedido, movimientos de inventario y cambios de stock se confirman juntos usando `withTransaction`, snapshot y mayoría. No existe fallback a escrituras parciales cuando MongoDB no soporta transacciones. La reposición y `stockDeducted=false` se guardan juntos, evitando reponer varias veces. Las líneas repetidas se verifican agregadas antes de aplicar un pago.

`POST /api/admin/catalog/products/:id/stock` recibe variante, delta entero, motivo y clave de operación. El movimiento guarda antes/después, fecha y responsable. La misma clave no permite repetir el ajuste ni cambiar su contenido. Un ajuste nunca se infiere del stock absoluto de un formulario.

Una variante omitida al editar se desactiva conservando su ID y existencias, para proteger referencias históricas. Las nuevas variantes admiten stock inicial entero. Una existencia histórica fraccionaria no se redondea: el movimiento se rechaza para conciliación previa.

## 5. Cancelación y expiración de Wompi

La [documentación oficial de enlaces de Wompi](https://docs.wompi.co/docs/colombia/links-de-pago/) establece que `expires_at` es opcional y que los enlaces pueden no expirar. La integración actual de Dizor no solicita una duración. Ahora se conserva el valor devuelto cuando es válido y se interpreta en UTC según esa documentación; el administrador lo ve en hora de Colombia. Sin fecha verificable, el pedido permanece pendiente: no se calcula ningún vencimiento desde `createdAt` y no se ejecuta cancelación automática.

La [consulta oficial por ID de transacción](https://docs.wompi.co/docs/colombia/seguimiento-de-transacciones/) requiere llave privada en el backend. Antes de autocancelar un Wompi con ID conocido se consulta ese estado. Si ya está aprobado, se reconoce el pago y se rechaza la autocancelación. Si sigue pendiente/rechazado, se permite cancelar antes de preparación y se conserva vigilancia mediante incidencia por posible aprobación tardía.

**Limitación explícita:** el flujo actual de enlace no proporciona a Dizor una enumeración completa de todos sus intentos de pago. Sin un ID consultable no se afirma que no hubo cobro: se registra revisión y se responde 409. Si el proveedor no responde, se devuelve 503 y se conserva el pedido. Esta restricción es necesaria para la decisión comercial de no cancelar a ciegas; requiere ampliar la conciliación del enlace para habilitar ese supuesto de autocancelación con garantías.

La consulta de un intento conocido tampoco demuestra que no exista otro intento todavía no notificado. Por ello, incluso tras consultar, una cancelación Wompi mantiene vigilancia y una aprobación tardía queda cancelada, pagada y con incidencia, sin descontar stock ni reactivar el pedido.

## 6. Checkout e identificadores

La identificación nueva tiene formato `DIZ-AAAAMMDD-<20 hex>`, fecha en `America/Bogota`, longitud 33 y unicidad garantizada por la base. No se modifican números anteriores. Se verificaron peticiones de compra concurrentes y 1.000 identificadores generados simultáneamente.

La clave de idempotencia es opcional; si se envía debe ser una cadena de 16–128 caracteres permitidos. Un hash canónico vincula actor y contenido de compra. Misma clave/actor/contenido devuelve el pedido listo, sin nueva compra, stock, cupón ni acuse. Contenido o actor distintos se rechazan con 409. Las peticiones simultáneas en curso pueden devolver 409 y deben reintentar la misma clave.

Un fallo después de registrar el pedido no lo elimina: queda marcado para revisión y no se crea otro con la misma clave. Un fallo ambiguo al crear un enlace Wompi conserva el pedido porque el proveedor podría haber creado el enlace. El tratamiento de un checkout fallido requiere revisión antes de otra compra. No se reutilizan automáticamente claves históricas sin hash de contenido, para no emitir acceso a una solicitud que no se puede comparar de forma fiable.

El checkout usa respuestas públicas sin stack incluso en modo desarrollo. El fallo transaccional anterior a crear el pedido revierte stock, movimientos y pedido; una repetición posterior de esa misma solicitud puede completarse.

## 7. Pruebas y resultados

Evidencias:

- `backend/test/phase1.test.js`: 22 escenarios originales + P01–P35, con aserciones.
- `docs/auditoria-admin/evidencias/fase1-pruebas.txt`: salida completa de la ejecución final (57/57, 18,50 s; cero intentos de red externa).
- `docs/auditoria-admin/evidencias/fase1-sintaxis.json`: 26 archivos JavaScript de backend/pruebas verificados sin errores de sintaxis; los cambios posteriores también fueron cargados por la ejecución final de regresión.
- `docs/auditoria-admin/evidencias/fase1-eslint.json`: lint de los ocho archivos frontend intervenidos.
- `docs/auditoria-admin/evidencias/fase1-eslint-comparacion.json`: comparación del lint con los contenidos de HEAD, sin reescribirlos.
- `backend/test/README.md`: reproducción aislada.

Cobertura comercial requerida:

| Caso solicitado | Regresión |
|---|---|
| Contraentrega creada/preparada/enviada sin cobrar | B1, P01 |
| Entrega sin recaudo | P01 |
| Recaudo autorizado | P02, P03 |
| Vendedor intenta confirmar pago | B4, P03 |
| Wompi pendiente intenta enviarse | B2 |
| Aprobación correcta | C1, P04 |
| Webhook duplicado secuencial | P04 |
| Tres webhooks concurrentes | C3 |
| Aprobación tras rechazo | C1 |
| Aprobación tras cancelación | P05, P23 |
| Pago sin stock | C2, P25 |
| Autocancelación contraentrega antes de preparar | P08 |
| Autocancelación en preparación | C4, P09 |
| Autocancelación Wompi pagado | P09, P22 |
| Edición de producto simultánea con venta | E1, P13 |
| Cantidades fraccionarias | E2, P12, P15 |
| Recaudo repetido | P02 |
| Identificadores simultáneos | A2, P17 |
| Idempotencia checkout | P14, P26, P27, P33 |
| Restricciones vendedor | B3, B4, G1, P03, P12, P25 |
| Conservación histórica | P16, P31 |
| Errores sin detalles internos | P15, P21, P27, P33 |

Adicionalmente: rollback tras fallo de almacenamiento después de cobrar, último stock y último uso de cupón disputados, consumo único de cupón ante eventos concurrentes, líneas repetidas, cancelaciones administrativas paralelas, montos/monedas discrepantes, pago adicional, reembolso histórico y ventas conciliadas. Todos se ejecutaron con fixtures `example.test`, transportes simulados y respuestas Wompi ficticias. El binario Mongo ya estaba disponible: no se instalaron dependencias en el proyecto ni se descargó software durante la ejecución.

**Lint:** persisten seis errores preexistentes (cinco `react-hooks/set-state-in-effect` y uno `react-hooks/purity`) y cuatro advertencias, sin errores nuevos respecto de HEAD. ESLint termina con código 1: no se presenta como aprobado. No se hizo refactor general de hooks ni build de producción; la sintaxis JSX fue revisada por ESLint. La auditoría original y la comparación permiten reproducir esta diferencia.

La inicialización aislada también detectó un índice duplicado preexistente de `SpecialRequest.requestNumber`, fuera de esta fase. Se registra en la salida como `unrelated-indexes`; los índices de Order, Product, Coupon, ProductHistory y PaymentEvent sí se verificaron. No se modificó ese modelo ajeno para ocultar el fallo.

La sandbox bloqueó inicialmente el socket local con EACCES. La ejecución posterior autorizada usó exclusivamente el replica set temporal local; el bloqueo no se interpretó como fallo funcional de la aplicación.

## 8. Compatibilidad y cambios que requieren preparación

1. **Infraestructura MongoDB:** antes de usar estos cambios en otro entorno, verificar replica set o clúster compatible con transacciones. Una instancia standalone no es suficiente. No se inspeccionó ni conectó a la base real para comprobarlo. Preparar un entorno de staging aislado; no rebajar las garantías mediante fallback.
2. **Índice histórico de idempotencia:** el esquema nuevo define índice único parcial para cadenas. Si ya existe el índice sparse con el mismo nombre, MongoDB no lo reemplaza automáticamente. Hace falta un cambio controlado de índice, con revisión previa de claves/nulos/duplicados en una copia, respaldo y pausa coordinada de escrituras. No ejecutar `syncIndexes` ni borrar índices a ciegas. Esta fase no ejecuta esa migración ni modifica documentos reales.
3. **Datos históricos:** no inferir recaudo o entrega de `orderStatus=pagado`. Los campos nuevos no reconstruyen evidencia ausente. Revisar pagos/cancelaciones antiguos y existencias fraccionarias por un procedimiento autorizado; no redondear ni cambiar estados masivamente.
4. **Referencias externas:** revisar consumidores ajenos que asuman sufijo numérico de cuatro dígitos. Las rutas inspeccionadas usan el identificador como texto y Wompi admite el nuevo valor dentro de su límite de SKU. No renumerar pedidos históricos.
5. **Clientes antiguos:** los formularios antiguos siguen guardando metadatos, pero su stock absoluto se ignora para variantes existentes. Los ajustes deben usar la operación nueva. Las claves antiguas sin fingerprint se conservan y requieren revisión al reutilizarse.
6. **Checkout fallido y pagos en disputa:** la fase conserva evidencia e incidencias. No incluye un flujo general para decidir reembolso, rehacer enlaces ambiguos o liberar todas las incidencias comerciales. La conciliación técnica Wompi sí permite recuperar faltantes de stock o fallos transitorios con evidencia del proveedor.

No se incluye un script de migración ejecutable sobre producción: las decisiones anteriores necesitan inventario de índices y datos históricos en una copia autorizada. Se continuó con todas las correcciones seguras sin tocar esos datos.

## 9. Pendientes y siguiente fase

- Validar con un entorno Wompi sandbox autorizado los payloads reales de enlaces, reintentos, timestamps y consultas; esta fase solo usó simulaciones. Correlacionar enlaces cuyo alta remota haya tenido una respuesta ambigua y ampliar consulta de intentos cuando el proveedor lo permita.
- Preparar el procedimiento controlado de índices y confirmar la infraestructura transaccional. Resolver el índice duplicado de solicitudes en su fase correspondiente.
- Diseñar el tratamiento administrativo de dinero recibido pendiente de devolución/conciliación, con comprobantes y permisos. No hacer reembolsos automáticos ni reinterpretar pagos históricos.
- Incorporar recuperación operativa de checkout incompleto y supervisión de eventos pendientes que excedan los reintentos del proveedor; no cancelar por antigüedad.
- Revisar en navegador los controles mínimos nuevos de recaudo y ajuste de stock. La fase no rediseñó la experiencia general ni validó visualmente todas las pantallas.
- Corregir el lint preexistente en un cambio separado. Abordar navegación, bandejas y nuevas comunicaciones solo en la fase posterior autorizada.

## 10. Archivos de esta fase

La siguiente lista incluye exclusivamente los archivos de aplicación y pruebas editados o creados en esta implementación. Los cambios concurrentes ajenos de Home/estilos se excluyen.

- `backend/package.json`
- `backend/src/controllers/adminAlertController.js`
- `backend/src/controllers/checkoutController.js`
- `backend/src/controllers/dashboardAdminController.js`
- `backend/src/controllers/orderAdminController.js`
- `backend/src/controllers/productAdminController.js`
- `backend/src/controllers/wompiWebhookController.js`
- `backend/src/middlewares/errorMiddleware.js`
- `backend/src/models/coupon.js`
- `backend/src/models/order.js`
- `backend/src/models/paymentEvent.js`
- `backend/src/models/product.js`
- `backend/src/models/productHistory.js`
- `backend/src/routes/adminCatalogRoutes.js`
- `backend/src/routes/adminOrderRoutes.js`
- `backend/src/services/cartService.js`
- `backend/src/services/financeService.js`
- `backend/src/services/inventoryService.js`
- `backend/src/services/orderOperations.js`
- `backend/src/services/orderReceiptService.js`
- `backend/src/services/orderService.js`
- `backend/src/services/orderTransitions.js`
- `backend/src/services/transactionService.js`
- `backend/src/services/wompiPaymentService.js`
- `backend/src/services/wompiService.js`
- `backend/src/utils/orderPermissions.js`
- `backend/test/README.md`
- `backend/test/phase1.test.js`
- `frontend/src/app/(auth)/cuenta/page.js`
- `frontend/src/app/admin/alertas/page.js`
- `frontend/src/components/admin/AlertBell.jsx`
- `frontend/src/components/admin/OrderDetail.jsx`
- `frontend/src/components/admin/OrdersList.jsx`
- `frontend/src/components/admin/ProductForm.jsx`
- `frontend/src/services/adminCatalogService.js`
- `frontend/src/services/orderAdminService.js`

Se agregan este informe y los archivos de evidencia `fase1-*` indicados arriba.
