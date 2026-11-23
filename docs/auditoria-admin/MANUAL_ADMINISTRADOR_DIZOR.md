# Manual del administrador DIZOR

Versión local de Fase 7 · 2026-11-21. Describe las opciones implementadas. Su publicación no habilita correo, pagos ni despliegue. Las acciones disponibles las decide el servidor según el estado del pedido y el rol.

## 1. Acceso y navegación

En **Iniciar sesión**, escriba correo y contraseña y pulse **Entrar**. Cada persona debe usar su cuenta. El vendedor entra a su panel; administrador y superadministrador acceden al administrador. El menú agrupa Inicio, Pedidos, Productos, Atención al cliente, Tienda online, Marketing y Configuración; Finanzas corresponde al superadministrador. En móvil abra el menú, seleccione una opción y ciérrelo con su botón o Escape. El foco vuelve al control que lo abrió.

## 2. Revisar pedidos nuevos

En **Inicio**, consulte las tareas y sus contadores. Abra **Pedidos → Por preparar**. Contraentrega puede estar listo para preparar con pago pendiente. Wompi necesita una aprobación verificable y stock descontado. Use las bandejas **Por preparar**, **Por despachar**, **En camino**, **Pendientes de recaudo**, **Requieren revisión**, **Todos** y **Comunicaciones por revisar**. Aplique los filtros; búsqueda, página y bandeja quedan en la URL. **Volver a pedidos** conserva el contexto desde el detalle.

## 3. Preparar

Abra el detalle y revise cliente, productos, variante, cantidad y siguiente acción. Si aparece **Comenzar preparación**, puede añadir una nota interna y pulsarlo una vez. Espere la confirmación. La siguiente acción cambia cuando el servidor confirma el registro. Un pedido en revisión o sin pago Wompi verificado no debe prepararse.

## 4. Despachar y corregir guía

Con el pedido en preparación, seleccione **Transportadora**, escriba **Número de guía** y, si corresponde, una nota interna. Pulse **Registrar envío y despachar**, revise el resumen y **Confirmar despacho**. Guía y despacho se guardan juntos; esto no registra recaudo. Mientras está en camino, **Corregir guía → Guardar corrección de guía → Confirmar corrección de guía** conserva la revisión y genera la comunicación correspondiente. **Volver sin confirmar** cancela la intención sin registrar el cambio.

## 5. Registrar entrega

Use **Registrar entrega → Confirmar entrega** sólo con evidencia de entrega. Contraentrega seguirá con pago pendiente hasta verificar el giro o confirmación de la transportadora. Compruebe **Historial del pedido**, fecha y estado después de la operación. Entrega y dinero son hechos separados.

## 6. Registrar recaudo contraentrega

Un administrador autorizado puede usar **Registrar recaudo** después de la entrega. Complete **Referencia o comprobante del recaudo**, **Fecha y hora del recaudo (Colombia)** y, si existe, **URL de evidencia**. Revise **Confirmar recaudo**. No use la entrega como única prueba de cobro. La confirmación no cambia despacho ni entrega; el registro pagado entra a ventas conciliadas sólo si no hay incidencias activas ni cierre excluyente.

## 7. Pagos Wompi

Crear un enlace no confirma el pago ni descuenta stock. La aprobación la verifica el backend con evidencia del proveedor. El administrador puede disponer de **Consultar y conciliar con Wompi** cuando existe una transacción consultable; no es una aprobación manual. Un intento rechazado no cancela automáticamente el pedido. Un enlace de reintento sólo se presenta si se pudo verificar su validez con Wompi. No invente una fecha de vencimiento ni un enlace alternativo.

## 8. Incidencias, cancelaciones y devoluciones

Abra **Requieren revisión** y lea la evidencia y los motivos en **Información de pago**. Un pago recibido sin inventario o después de cancelar se conserva como evidencia y no se trata como venta conciliada. Si se permite **Cancelar pedido** o **Registrar devolución**, confirme un motivo interno; el inventario se restaura cuando corresponde. Ninguna de estas acciones ejecuta reembolso automático. La gestión del dinero y la decisión comercial deben resolverse por un responsable con evidencia; no fuerce estados ni edite datos directamente en la base.

## 9. Comunicaciones del pedido

Consulte el historial de comunicaciones en el detalle y la bandeja **Comunicaciones por revisar**. **Aceptado por el proveedor** no prueba llegada a la bandeja del cliente. Un fallo temporal puede admitir **Reintentar**; un resultado ambiguo exige revisar antes de un nuevo envío. Un reenvío autorizado requiere confirmación y motivo según el formulario. No cambie destinatarios para resolver un fallo sin verificar la identidad. **Abrir conversación en WhatsApp** sólo abre una conversación; el administrador decide si envía el mensaje. Los avisos del entorno QA usan transporte ficticio.

## 10. Productos y variantes

En **Productos**, use búsqueda, filtros y paginación. Revise SKU, publicación, variante, precio y disponibilidad. La ficha comercial no sustituye los movimientos de stock: en variantes existentes, las existencias se gestionan mediante ajuste. Los SKU no deben repetirse. Las variantes históricas conservan sus identificadores y pueden quedar inactivas. Un producto o variante con Wompi pendiente puede impedir su baja para proteger la compra pendiente. El vendedor puede consultar el catálogo permitido sin costos internos.

## 11. Ajustar inventario

En la vista de existencias, identifique producto, variante y SKU. Abra el ajuste, escriba una cantidad entera relativa y un motivo verificable; una cantidad negativa retira unidades. Pulse **Registrar ajuste** una vez. El botón se bloquea mientras procesa. Compruebe el stock confirmado y su movimiento después del éxito. Si se pierde la respuesta, use la recuperación disponible de esa operación: conserva la misma clave para evitar otro movimiento. No cree un ajuste nuevo para resolver una operación cuyo resultado aún se desconoce.

## 12. Historial y alertas de inventario

En **Movimientos e historial**, filtre por producto, variante, SKU, tipo, responsable y fechas. Revise existencias anteriores y posteriores, motivo y responsable. Las alertas se evalúan por variante: una variante agotada no queda escondida por otra disponible. Stock ausente o fraccionario histórico significa **revisión**, no cero confirmado. La lectura del panel no corrige esos registros. Un saneamiento histórico requiere análisis y procedimiento propio.

## 13. Tienda online y Marketing

**Tienda online** reúne contenido editorial; **Marketing** reúne popup, newsletter, carritos y cupones. Espere que la carga termine antes de editar. Un error de carga no representa una configuración vacía. Use el botón de reintento de la sección. Al guardar, espere confirmación; ante resultado sin confirmar, verifique la lectura antes de volver a enviar. La pantalla conserva el borrador cuando corresponde y bloquea escrituras inseguras. Los recordatorios de carritos y servicios externos continúan desactivados mientras no exista autorización específica.

## 14. Atención al cliente, solicitudes y PQR

Abra las solicitudes o PQR desde **Atención al cliente**, filtre y abra el detalle correcto. En PQR, revise el registro del cambio antes de guardar estado y respuesta; confirme luego el historial. Diferencie carga fallida, lista vacía y búsqueda sin coincidencias. Las solicitudes mantienen su ruta histórica y el contexto de navegación. No interprete un error como ausencia de solicitudes.

## 15. Límites del vendedor y finanzas

El vendedor trabaja con las funciones operativas permitidas en Inicio, Pedidos y solicitudes. No registra recaudos, aprueba pagos, concilia Wompi, ve costos internos, modifica inventario ni obtiene exportaciones restringidas. Ocultar una opción no concede autorización: el backend también rechaza esas operaciones. El superadministrador consulta **Finanzas**, sus períodos, historial y exportaciones; los rangos se interpretan en fechas de Colombia. Las ventas conciliadas excluyen cancelaciones, devoluciones, reembolsos e incidencias activas; el dinero en disputa sigue requiriendo tratamiento independiente.

## 16. Errores y resultados desconocidos

Espere el estado **Procesando**. Ante un rechazo explícito, lea el mensaje, corrija lo permitido y reintente. Si la respuesta se pierde o no puede confirmarse, evite repetir la acción: en pedidos use **Actualizar pedido**; en ajustes conserve la operación pendiente; en configuración use la verificación y recuperación de la sección. Compruebe estado e historial antes de una acción nueva. Si persiste la incertidumbre, registre número de pedido o SKU, hora, pantalla y mensaje y solicite revisión al responsable técnico; no comparta tokens, contraseñas ni datos de pago.
