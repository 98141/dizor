# Decisiones y procedimientos pendientes

## No volver a pedir que se definan los objetivos ya indicados

El encargo del propietario, sección 10 de “VALIDACIÓN REAL WOMPI SANDBOX Y PREPARACIÓN FINAL DE PRODUCCIÓN”, fijó: autocancelación restringida, propuesta 24h, impedir doble cobro de última unidad, recuperar el pedido ante incertidumbre y respetar límite de cupones. **Se registran como requisitos del trabajo**, sin inventar firma, nombre de responsable o aceptación de un riesgo distinto.

La aceptación del objetivo no equivale a aceptar descuentos extra, devoluciones por sobreventa o ausencia de vencimiento. Estas alternativas requieren otra decisión expresa; no se dan por aprobadas.

| Política | Estado técnico | Decisión/ejecución pendiente |
|---|---|---|
| Autocancelación | Restricción actual implementada y probada; Wompi incierto se gestiona por administración | Registrar responsable/procedimiento de atención y su aceptación operativa |
| 24h | API Sandbox acepta el parámetro; aplicación no lo envía | Completar PENDING/vencimiento/pago tardío antes de habilitar, o aceptar otro control demostrado. No cerrar X07 por el eco del API |
| Última unidad | Se detecta pago sin stock; no hay reserva | Implementar reserva segura en intervención propia, o aprobar/ensayar una mitigación comercial concreta. No se acepta sobreventa por defecto |
| Cupones limitados | usedCount transaccional; no reserva previa de cuota para links simultáneos | Reserva/control equivalente o política operativa expresamente aceptada; nunca conceder descuento extra silencioso |
| Checkout incierto | Se conserva pedido, incidencia e idempotencia; ahora hay diagnóstico y creación real 201 demostrada | Ensayar recuperación ante resultado desconocido; no repetir POST externo ni crear otro pedido automáticamente |
| Devolución manual | App registra atestación privilegiada con evidencia; no devuelve dinero automáticamente | Designar ejecutor y revisor distintos, plazo y registro global de referencias; ensayar antes de aceptar el procedimiento |

Los diseños de reserva y sus matrices están en preproduccion/05. Cambian concurrencia/esquemas/ciclo financiero y deben tener una intervención separada. El interruptor permite mantener suspendidas nuevas compras mientras se cierran estos requisitos; no se usa como prueba de que ya están implementados.

## Procedimiento ante checkout con resultado desconocido

Conservar pedido, clave, fecha y código seguro del error; detener nuevos intentos de creación para ese caso. El operador consulta el panel del ambiente correcto y cruza evidencia del intento con el proveedor. No asociar por importe/correo/hora ni inventar una búsqueda API por sku. Si existe cobro, conciliar por ID con la verificación vigente; si no puede demostrarse vínculo o ausencia de cobro, mantener revisión y contactar al proveedor. No ofrecer otro cobro como recuperación automática.

El 403 reproducido explica una configuración de pruebas rechazada; no elimina el riesgo general de timeout después de una creación exitosa. El intento antiguo de resultado desconocido permanece documentado.

## FF-06 · contradicción de importe firmado

Tratarla como posible incidente de seguridad antes de concluir seguimiento. Mantener el evento/observación, recibo probatorio y seguimiento abiertos; comparar panel/GET autenticado y propiedades firmadas, sin guardar PII/cuerpos completos. Investigar acceso al secreto y logs con responsable de seguridad. Suspender nuevas creaciones si procede.

Si se confirma o no puede descartarse compromiso, el operador coordina rotación del secreto en proveedor y servidor, conserva registro restringido y concilia eventos durante la ventana. El código actual valida un secreto: no asumir que una rotación admite automáticamente reintentos firmados con el anterior. No se rotó ningún secreto ni se modificó el panel aquí. Cerrar seguimiento solo con investigación documentada y dinero reconciliado; no hace falta cambiar la regla financiera ya aprobada para escribir este procedimiento.

## Doble control de devolución y operación diaria

Un responsable verifica el cobro y ejecuta la devolución por el canal autorizado; otra persona comprueba transacción, importe/moneda, destinatario y referencia única contra un registro global. Después se registra la atestación en DIZOR con evidencia. La app no sustituye esa ejecución ni prueba que llegó el dinero al comprador. Plazo y personas deben designarse; no se inventa un compromiso de 48 horas.

Asignar revisión de inbox/seguimientos, pedidos con más de 24h, cruce diario con Wompi y guardia de lanzamiento. Probar entrega real de avisos y escalamiento antes de abrir. NV-05/06/07 anteriores no se cierran por esta documentación; el control global de referencias mitiga operativamente el alcance limitado actual de NV-07, pendiente de ensayo/aceptación.
