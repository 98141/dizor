# 01 · Informe independiente de la remediación Wompi y pedidos

**Fecha:** 2026-11-23
**Auditor:** Claude, en modo de solo lectura sobre el código funcional.
**Objeto:** los cambios locales de Codex, sin commit, sobre el commit base `9289c7b`.
**Fuentes revisadas:**
- Los 9 documentos de la auditoría original.
- Los 7 documentos y scripts de `remediacion/`.
- El diff completo: 22 archivos modificados y 3 nuevos.
- La documentación oficial de Wompi, consultada hoy.

## Conclusión

**Veredicto: NO-GO.** El detalle está en `07_VEREDICTO_PREPRODUCCION.md`.

La remediación es **sustancialmente correcta y de alcance adecuado**: corrige con evidencia ejecutada los defectos centrales WP-01, WP-03, WP-04, WP-05 y WP-06. Los cambios en el código funcional se limitan a esos hallazgos, sin dependencias nuevas ni cambio de modalidad. No recomiendo revertir ningún archivo.

**La remediación no está cerrada.** Mis pruebas adversariales encontraron:

- **2 defectos corregibles P2 introducidos por la propia remediación:**
  - **NV-01:** una lectura rezagada del proveedor puede marcar como "procesado" un APPROVED auténtico sin aplicarlo ni alertar.
  - **NV-02:** un ID de transacción mal digitado deja un pedido pagado bloqueado sin salida.
- **1 dependencia externa agravada (NV-04).** La asociación ahora exige que **también** la consulta privada `GET /v1/transactions/{id}` devuelva `payment_link_id`, y la documentación oficial no documenta ese campo.

Además siguen abiertos:
- V-01: el webhook Nequi sin firma en producción.
- Las verificaciones externas E01–E06.
- Las decisiones comerciales WP-07, WP-08, WP-12 y WP-15.

## Qué se ejecutó

Todo se ejecutó con MongoDB en memoria (replica set), Wompi simulado y la red externa bloqueada. No se usó Atlas, credenciales ni dinero real.

| Conjunto | Resultado | Archivo de salida |
|---|---|---|
| Regresiones de Codex R01–R27 (reproducidas) | 27/27 PASS | `evidencias/ejec-regresiones-codex.txt` |
| Limitadores de Codex L01–L02 (reproducidos) | 2/2 PASS | `evidencias/ejec-limites-codex.txt` |
| Suite histórica con el adaptador de contrato | 273 PASS / 2 FAIL (P06, P23: cambios de política) | `evidencias/ejec-suite-historica.txt` |
| Matriz original con el adaptador de Codex | 44 PASS / 5 FAIL / 1 N/A | `evidencias/ejec-matriz-contrato.txt` |
| Matriz original sin adaptador (informativa) | 28 PASS / 21 FAIL / 1 N/A | `evidencias/ejec-matriz-original-sin-adaptador.txt` |
| **Pruebas adversariales propias C01–C34** | **35 ejecutadas: 31 PASS / 4 FAIL** | `evidencias/ejec-adversarial.txt`, fuente `adversarial.test.cjs` |
| Verificaciones externas E01–E06 | 6 BLOCKED | — |

Notas sobre estas cifras:

- **Matriz sin adaptador.** La matriz original no simula la consulta `GET /transactions`. El código nuevo la exige antes de aplicar un evento asociado, así que sus 21 FAIL miden esa dependencia, no defectos de negocio. Sirve solo para documentar la dependencia.
- **Prueba adversarial mal especificada.** La primera versión de C05 usaba un error de Mongo reintentable (código 91), que el driver reintenta solo. La corregí al código 2, como la prueba original P14, y la volví a ejecutar. Las cifras de la tabla son de la ejecución corregida.

## Qué está bien (demostrado)

- **Firma y autenticidad:** los eventos con firma, secreto, timestamp o propiedades incorrectas reciben 401 y no se persiste nada (C02).
- **Eventos no asociables (WP-01):** se guardan de forma durable, se alertan una sola vez, resisten 8 entregas concurrentes (C06) y el fallo de escritura (C05), y se recuperan por reproceso (C01, C04).
- **Pagos sin webhook (WP-02):** se recuperan introduciendo el ID; la operación es idempotente y concurrente con el webhook (C09, C13). Un ID de otro pedido no se aplica (C10).
- **Resolución de incidencias (WP-03):** queda limitada por rol y por código, exige evidencia coherente con el cobro guardado y es atómica con `AuditLog` (C14–C19). Además:
  - Un pago duplicado devuelto, un cupón asumido y una cancelación previa al pago ahora tienen salida (C16, C17, C33).
  - Resolver una incidencia no convierte en pagado un pedido no pagado (C18, C21).
- **Anulaciones (WP-04):** un VOIDED bloquea la preparación y el envío y saca el pedido de finanzas. Un APPROVED antiguo no lo rehabilita aunque el proveedor responda con un estado rezagado (C22–C26).
- **Importes y asociación (WP-05/06):** un importe menor o mayor, o una moneda distinta, nunca dejan el pedido como `pagado` (C27). Una transacción ya aplicada no puede aplicarse a otro pedido (C28), y un enlace duplicado se trata como ambiguo (C29).
- **Sin regresiones** en contraentrega, en los métodos de pago desactivados, en la cancelación del cliente ni en los permisos (C11, C30–C32).

## Qué falla

| ID | Prioridad | Resumen | Prueba |
|---|---|---|---|
| NV-01 | P2 | Si `GET` todavía responde PENDING tras un APPROVED firmado, el recibo se marca procesado, el pedido sigue pendiente, sale de la bandeja y los reintentos de Wompi no lo recuperan | C07 FAIL |
| NV-02 | P2 | Un ID erróneo en "Consultar y conciliar" crea `reconciliation_query_failed`. Esa incidencia no tiene decisión de cierre y solo se cierra conciliando con el mismo ID erróneo, así que el pedido pagado queda bloqueado | C12 FAIL |
| NV-03 | P3 | Los recibos originales quedan para siempre en la bandeja de eventos tras un reproceso exitoso con otro estado o con moneda alterada | C08, C08c FAIL |
| NV-04 | P1 condicional (BLOCKED por E01) | La asociación exige `payment_link_id` idéntico en el evento **y** en `GET`. Si `GET` no lo trae, ningún pago se asocia y no hay recuperación dentro de la aplicación | C34 (comportamiento seguro, sin recuperación) |
| NV-05 a NV-07 | P3 | Consulta HTTP al proveedor dentro de la transacción de Mongo, aviso "pago rechazado" al comprador tras anular un pedido enviado y referencia de devolución única solo por pedido | código, C21 |

El detalle, con líneas de código, escenario, corrección mínima y prueba de regresión, está en `04_NUEVAS_VULNERABILIDADES.md`.

## Riesgos residuales que siguen abiertos

- **P19 y WP-07:** los enlaces no vencen y se pueden pagar pedidos ya cancelados. Ahora el caso tiene salida administrativa (C33).
- **P34 y WP-08:** dos clientes pueden pagar la última unidad.
- **P05b y WP-12:** un checkout de resultado incierto puede duplicar el pedido si el cliente usa una clave nueva.
- **P37 y WP-10:** ninguna alerta sale realmente del sistema mientras el correo esté apagado.

El detalle está en `03_HALLAZGOS_PERSISTENTES.md` §3.

## Qué debe hacer Codex (únicamente)

1. **NV-01.** No permitir que una observación no final del proveedor sustituya un estado final firmado. En ese caso, dejar el recibo `failed`, alertar y responder 503.
2. **NV-02.** Si `GET` responde 404 o con un ID inválido, no crear la incidencia y devolver 409. Al conciliar con éxito, cerrar todas las incidencias `reconciliation_query_failed` del pedido.
3. **NV-03.** Al reprocesar con éxito, marcar como procesado el recibo original e indicar el motivo, conservando la evidencia.
4. **NV-04.** No cambiar código. Incluir en E01 la respuesta redactada de `GET /v1/transactions/{id}` y preparar la decisión de modalidad si no trae `payment_link_id`.
5. **P06 y P23.** Versionar las dos aserciones históricas sustituidas sin editar los originales. El dueño debe aceptar por escrito el cambio de política de autocancelación Wompi.

Las instrucciones exactas están en `07_VEREDICTO_PREPRODUCCION.md` §4.
