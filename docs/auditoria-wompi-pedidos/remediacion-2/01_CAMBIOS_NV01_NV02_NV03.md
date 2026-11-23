# Segunda remediación — NV-01, NV-02 y NV-03

23/11/2026. **REMEDIACIÓN LOCAL COMPLETA, PENDIENTE DE AUDITORÍA INDEPENDIENTE**, limitada a los tres defectos del encargo. No es GO productivo ni cierre de otros hallazgos.

## Línea base y conservación

Rama main, HEAD `9289c7b1451d3b800ca8412d788a9a13c45cc514`. Se preservaron los cambios de primera remediación. Sus 25 archivos coincidían al comenzar con el manifiesto anterior. La reproducción independiente confirmó C07/C08/C08c/C12: **0/4 PASS, 4 FAIL**, sin modificar sus aserciones. Las 18 pruebas específicas nuevas dieron **6 PASS/12 FAIL** antes del cambio.

Sólo se editaron tres archivos funcionales: wompiPaymentService.js, wompiService.js y orderAdminController.js. Se añadió phase1-v2.test.js. No se editó ningún modelo, frontend, paquete, política de stock/cupón/COD, modalidad, firma o contraste de asociación.

Durante el trabajo aparecieron modificaciones concurrentes ajenas en checkoutController.js y tres archivos frontend, más dos archivos nuevos de checkout. Se conservaron íntegramente y se registran aparte en 04 y en evidencia. No se incorporan al patch de esta intervención ni se atribuyen a estas correcciones.

## NV-01 — corregido y probado

`wompiPaymentService.canAdvanceTransactionStatus` explicita las únicas progresiones aceptadas: mismo estado, PENDING→APPROVED/DECLINED/ERROR y APPROVED→VOIDED. No se confunde lectura posterior con estado posterior.

La discrepancia no compatible conserva providerObservation, estado failed, lastError diagnóstico, processedAt nulo y un aviso idempotente. `deferProviderDiscrepancy` confirma la transacción antes de que el llamador lance 503. Un fallo de persistencia produce no-200 y no elimina el recibo. Una aplicación concurrente ya completada no se degrada a failed.

Se mantiene la defensa de GET privado, comparación de Link/moneda/importe y precedencia de VOIDED. Se comprueba que la aplicación del estado progresado realmente terminó antes de completar la observación anterior.

Evidencia: C07 PASS; N01-PENDING/N01-DECLINED/N02/N03/N04; R22 y C22–C26 conservados en verde. Duplicados con GET rezagado responden 503 sin multiplicar avisos; tras actualización del GET el mismo recibo se aplica una sola vez.

## NV-02 — corregido y probado

`wompiService.getTransaction` conserva la consulta privada y diferencia ID inválido/404 (409) de HTTP distinto de 404, timeout y conectividad (503 con código diagnóstico). No convierte 401/403/429/5xx en un 404 ni registra secretos. El controlador no crea incidencia para ID inválido o inexistente.

Se conserva la incidencia operativa para indisponibilidad. Una conciliación autenticada y completada cierra todas las incidencias abiertas reconciliation_query_failed del mismo pedido, aunque sus pistas fueran otros IDs. Conserva código, detalle y fecha originales; añade resolución con actor/fecha/decisión/ID consultado, statusHistory y AuditLog en la misma transacción. No toca otras incidencias ni pedidos.

El cierre es atómico con su auditoría, no con las dos fases financieras anteriores: si AuditLog falla, el pago auténtico puede seguir registrado, pero el fallo de consulta permanece abierto y el pedido bloqueado hasta reintentar. La prueba N09 verifica esa recuperación. Repeticiones concurrentes no duplican la auditoría de cierre.

Evidencia: C12 PASS; N05–N10. Un ID ajeno no asocia dinero al pedido solicitado; un pago válido vuelve a ser preparable sólo si no quedan otras condiciones bloqueantes.

## NV-03 — corregido y probado

`processTransaction` devuelve el recibo cuya aplicación terminó (o el ya completado), manteniendo el servicio financiero existente. El reproceso valida el ID exacto consultado, progresión e importe firmado, asociación actual y recibo completado. Después verifica dentro de transacción el recibo confiable por ID/entorno/pedido/processedAt antes de cerrar el original.

Se preservan los campos del evento original (key, transacción, estado, importe, moneda, referencia, entorno, Link, checksum, timestamp y origen). Se conserva provider_binding_mismatch incluso si el proceso reutiliza la misma clave. El cierre usa processingState/processedAt y metadatos existentes: associationError de sustitución cuando corresponde y lastError con el ID del recibo confiable que lo sustituye. No se borra ni migra ningún recibo.

Si falla aplicación o cierre, el original no queda falsamente cerrado; si el pago ya fue aplicado antes de fallar el cierre, el reintento completa la metadata sin repetir stock/avisos. El reproceso con GET rezagado tampoco puede ocultar un APPROVED original. Una incidencia financiera genuina procesada sigue bloqueando el pedido aunque su observación de inbox se haya atendido.

Evidencia: C08 y C08c PASS; N11–N15, incluyendo Mongo, concurrencia, moneda alterada, respuesta de otro ID e inmutabilidad de evidencia.

## Pruebas históricas versionadas

P06/P23 originales permanecen intactas y en FAIL. Las nuevas P06-v2/P23-v2 pasan y aportan evidencia adicional. La aceptación comercial de autocancelación sigue pendiente: no se presume por este encargo. Registro detallado en pruebas-sustituidas.md.
