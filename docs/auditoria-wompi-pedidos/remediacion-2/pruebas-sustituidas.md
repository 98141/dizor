# Versiones independientes P06 y P23

Las aserciones originales de `backend/test/phase1.test.js` permanecen intactas y siguen ejecutándose: P06 (línea 559, aserción `paymentStatus === pagado`) y P23 (línea 753, aserción HTTP 200 al autocancelar PENDING). No se borran, editan, saltan ni ocultan sus FAIL.

`backend/test/phase1-v2.test.js` contiene dos pruebas nuevas independientes, con el proveedor desacoplado del evento del fixture de Claude:

- **P06-v2 / WP-05:** monto o moneda discrepantes no se presentan como pago íntegro; evento e incidencia conservan el hecho, stock intacto y preparación bloqueada. El original exige precisamente el defecto financiero corregido.
- **P23-v2 / WP-09:** verifica la política actualmente implementada: cliente no autocancela Wompi PENDING, backend devuelve 409, estado e inventario se conservan. Es evidencia de comportamiento, no aprobación comercial.

**Aceptación del dueño:** sigue PENDIENTE una aceptación escrita específica de la retirada de autocancelación Wompi. Este encargo autoriza versionar/verificar las pruebas y prohíbe cambiar decisiones de negocio; no se interpreta como aceptación del cambio anterior.

**Sustitución formal:** NO realizada ni aprobada. Se conserva la cifra real histórica 273/275 cuando así resulte. Para separar conjuntos, la ejecución histórica enumera todos los archivos previos excepto el nuevo phase1-v2; las dos pruebas v2 se ejecutan en otro comando. `npm test` incluiría también la versión v2 al usar el glob: no convertir ese aumento del denominador en una afirmación de 275/275 históricos.

Fuentes: auditoría Claude 05 §4 y 07 §4/5; primera remediación 03/04; encargo de segunda remediación §6.
