# Riesgos y bloqueos fuera de NV-01–NV-03

No se emite GO de producción. Se conserva el NO-GO previo para producción hasta demostrar las dependencias y decisiones pendientes.

## NV-04 / E01 — BLOCKED, sin cambio de código

El contraste sigue exigiendo vínculo verificable tanto en evento como en GET privado. No se elimina, flexibiliza ni sustituye por importe, email, proximidad temporal o referencia no verificable.

Procedimiento pendiente para operador autorizado de Sandbox:

1. Crear un Payment Link con datos ficticios y llaves autorizadas de Sandbox, en una ejecución posterior autorizada; no se realizó aquí.
2. Capturar el evento auténtico recibido por HTTPS y su metadata de firma, y consultar el mismo ID desde backend con llave privada.
3. Comparar ID de transacción y payment_link_id, importe en centavos, moneda, estado y ambiente de ejecución/credenciales. Una observación rezagada se conserva para recuperación según NV-01; no se llama progresión por la hora de consulta.
4. Redactar email, teléfono, dirección, datos del pagador, tokens/llaves/cabeceras y cualquier información sensible antes de guardar. Conservar únicamente evidencia mínima necesaria, fecha y método de captura.
5. Separar campos garantizados por contrato oficial de campos sólo observados en esa transacción; un mock o un único ejemplo no demuestra garantía general.
6. Si el vínculo falta en cualquiera de las vías necesarias, mantener BLOCKED. Pedir a Wompi una fuente autenticada de asociación oficialmente soportada, o analizar Web Checkout con referencia comercial/firma de integridad. Una migración requiere autorización expresa y validación propia; no está implementada.

Fuentes documentales ya revisadas por Claude: [eventos](https://docs.wompi.co/docs/colombia/eventos/), [seguimiento](https://docs.wompi.co/docs/colombia/seguimiento-de-transacciones/) y [Links](https://docs.wompi.co/docs/colombia/links-de-pago/). Esta segunda intervención no añade evidencia externa ni afirma haberlos probado con Wompi real.

## Otros pendientes conservados

- E02–E06: firma real, retorno de Links, reintento, cierre/vigencia e infraestructura real: todos sin ejecutar.
- V-01: contención Nequi productiva no demostrada; plan anterior vigente, ningún cambio productivo realizado.
- NV-05, NV-06 y NV-07: expresamente fuera del alcance. No se edita paymentIncidentResolution, ni avisos por VOIDED ni unicidad global de referencias. El error tipado del helper compartido puede llegar a otros llamadores, pero no se cambió su arquitectura ni se declara cerrado NV-05.
- WP-07/08/12/15 y decisiones comerciales previas: sin cambios. No reservas, TTL, cupones ni reintentos financieros nuevos.
- Aceptación escrita del dueño de la política de autocancelación Wompi: PENDIENTE. La v2 documenta conducta vigente, no sustituye la decisión comercial ni las aserciones históricas.
- Correo real/alertas e infraestructura destino: sin activar ni verificar.

## Riesgos introducidos y límites

La precedencia es deliberadamente conservadora: una transición no demostrada queda failed/503 para recuperación, aunque un caso futuro del proveedor resulte válido. No se presume una progresión PENDING→VOIDED sin la transición intermedia conocida. La bandeja y el outbox existentes conservan esas discrepancias; tras los tres reintentos de Wompi la atención administrativa sigue siendo necesaria.

La aplicación financiera y el cierre operativo/auditoría son fases separadas: ante fallo posterior puede existir pago aplicado con incidencia o recibo original aún abierto. El reintento es seguro e idempotente; no se borra evidencia ni se fuerza pago/desbloqueo. Los avisos duplicados se evitan con las claves de outbox existentes.

Durante la ejecución aparecieron cambios concurrentes ajenos de checkout (04). No se deshicieron ni incorporaron al patch. La auditoría debe considerar su procedencia y pruebas por separado antes de integrar o desplegar el árbol completo. No hay evidencia que permita atribuir estos cambios a producción.
