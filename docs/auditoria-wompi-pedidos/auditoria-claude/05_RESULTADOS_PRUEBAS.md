# 05 · Resultados de pruebas y auditoría de las pruebas

## 1. Entorno

- **Software:** Node v24, MongoDB 8.3.2 en replica set efímero en loopback (`mongodb-memory-server`, tomado de un proyecto hermano en modo de solo lectura).
- **Proveedor y red:** Wompi simulado y red externa bloqueada.
- **Credenciales:** llaves ficticias con prefijo `prv_test_` y secreto de eventos aleatorio por ejecución.
- **Correo:** desactivado.
- **Lo que no se usó:** `.env`, Atlas y llaves reales.

Desvío de escrituras: `evidencias/preservar-claude.cjs` manda a `evidencias/salidas/<ejecución>/` cualquier escritura bajo `docs/`. La suite histórica intentó reescribir `docs/auditoria-admin/fase2-evidencias/cierre-independiente-resultados.json` y quedó desviada.

Huella SHA-256 de 3.931 archivos tomada antes y después de las ejecuciones: idéntica.

### Comandos

Se ejecutan desde la raíz del repositorio, en Git Bash.

```bash
export MMS_DIR=".../RicardoMelo/ecommerce-mern/backend" MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe" MONGOMS_RUNTIME_DOWNLOAD=false
E=docs/auditoria-wompi-pedidos/auditoria-claude/evidencias
CLAUDE_RUN=adversarial node --require ./$E/preservar-claude.cjs --test --test-concurrency=1 $E/adversarial.test.cjs
CLAUDE_RUN=x node --require ./$E/preservar-claude.cjs --test docs/auditoria-wompi-pedidos/remediacion/regresiones.test.cjs
CLAUDE_RUN=x node --require ./$E/preservar-claude.cjs --test docs/auditoria-wompi-pedidos/remediacion/limites.test.cjs
CLAUDE_RUN=x node --require ./$E/preservar-claude.cjs docs/auditoria-wompi-pedidos/remediacion/auditoria-contrato.cjs
CLAUDE_RUN=x node --require ./$E/preservar-claude.cjs docs/auditoria-wompi-pedidos/evidencias/auditoria-wompi.cjs
```

La suite histórica se ejecuta desde `backend/`:

```bash
node --require ../$E/preservar-claude.cjs --require ../docs/auditoria-wompi-pedidos/remediacion/contrato-fixtures.cjs --test --test-concurrency=1 test/*.test.js
```

## 2. Cifras (sin sumar conjuntos distintos)

| Conjunto | Ejecutadas | PASS | FAIL | N/A | Observación |
|---|---|---|---|---|---|
| Adversariales propias C01–C34 | **35** | **31** | **4** | 0 | FAIL: C07 (NV-01), C08 y C08c (NV-03), C12 (NV-02) |
| Regresiones de Codex R01–R27 | 27 | 27 | 0 | 0 | Reproducido |
| Limitadores de Codex L01–L02 | 2 | 2 | 0 | 0 | Reproducido. L02 depende del orden (consume la petición que dejó L01) |
| Suite histórica con el adaptador de contrato de Codex | 275 | 273 | 2 | 0 | FAIL: P06 y P23, que exigen la política antigua (§4) |
| Matriz original, modo contrato | 50 | 44 | 5 | 1 | FAIL: P13, P20, P22b, P28 (flujo antiguo), X07 (WP-07 abierto) |
| Matriz original sin adaptador | 50 | 28 | 21 | 1 | Informativa: mide la dependencia nueva de `GET` antes de aplicar, no defectos de negocio |
| Externas E01–E06 | 0 | — | — | — | 6 BLOCKED |

**Error corregido en mis propias pruebas.** La primera ejecución de C05 usó el código de error de Mongo 91, que es reintentable. El driver lo reintentó y el webhook respondió 200, lo que no es un defecto del producto. La cambié al código 2, igual que la prueba original P14, y repetí toda la batería. También eliminé de C13 una aserción débil sobre `ProductHistory` que no aportaba garantía. Las cifras de la tabla corresponden a la ejecución corregida.

## 3. Los 5 FAIL de la matriz original, repetidos con el flujo correcto

| Original | Por qué sigue en FAIL en la matriz | Flujo correcto ejecutado | Resultado |
|---|---|---|---|
| P13 | Concilia sin aportar un ID | C09: el administrador introduce el ID del panel | PASS |
| P20 | Intenta preparar sin resolver | C16: el superadmin atesta la devolución del cobro adicional | PASS |
| P22b | Igual | C17: `accept_discount` | PASS |
| P28 | No archiva la vigilancia | C33: cancelar, archivar y recibir un pago tardío | PASS |
| X07 | Sin `expires_at` | — | **FAIL vigente** (WP-07) |

Codex no modificó las aserciones de la matriz para obtener estos resultados. Eso es correcto.

## 4. Los dos FAIL históricos (P06 y P23)

| Prueba | Qué exige | ¿Debe cambiar el código? | Recomendación |
|---|---|---|---|
| `backend/test/phase1.test.js:559` P06 | `paymentStatus === "pagado"` con importe o moneda discrepantes | **No.** Es exactamente el defecto WP-05; C27 y R06 demuestran el comportamiento correcto | No editar el original. Añadir `backend/test/phase1-v2.test.js` (o similar) con la expectativa vigente y un registro `docs/.../pruebas-sustituidas.md` que cite WP-05 y esta auditoría |
| `phase1.test.js` P23 | El cliente cancela con 200 un Wompi PENDING consultado | **No**, si el dueño acepta la política. La cancelación definitiva de un intento que aún puede aprobarse es insegura (WP-09) | Aceptación escrita del dueño y la misma técnica de versionado |

Ninguna de las dos aserciones se editó, se omitió ni se marcó como skip. Eso es correcto, y la suite no debe presentarse como 275/275.

## 5. Auditoría de las pruebas de Codex

| Pregunta del encargo | Hallazgo |
|---|---|
| ¿Detectan el defecto original? | Sí. Codex conserva `nuevas-antes.txt` con las 11 nuevas en FAIL antes del cambio, y R26 y R27 fallaron antes del ajuste final (`bordes-antes.txt`). Revisé el código de R01–R27: ejercen la ruta HTTP real del webhook, la conciliación y la resolución |
| ¿Los mocks respetan el contrato oficial? | Parcialmente. Ya no se usa `sku` en las pruebas nuevas (0 apariciones) y los eventos usan las propiedades firmadas oficiales. **Pero** `contrato-fixtures.cjs` y `auditoria-contrato.cjs` publican en el proveedor simulado, antes de firmar, el mismo estado que el evento, y `GET` devuelve `payment_link_id`. Es un **fixture favorable**: nunca ejerce un proveedor rezagado (por eso no detectó NV-01) ni un `GET` sin vínculo (NV-04), que es justo lo que la documentación no garantiza |
| ¿Se sigue usando `sku`? | Sí en el código fuente histórico (`phase1.test.js:161`, sin tocar). El adaptador lo sustituye en memoria por `payment_link_id`. Es aceptable y está documentado |
| ¿Aserciones debilitadas? | R08 acepta stock 4 o 5 en la carrera APPROVED/VOIDED, una aserción débil pero justificable por el orden no determinista. C22 cubre el caso determinista. R11 prueba solo el predicado `canSelfCancel`; verifiqué el botón en el código del frontend y C31 cubre la API |
| ¿Escenarios adversariales omitidos? | Un `GET` rezagado o sin vínculo, un ID erróneo en la conciliación, la limpieza de la bandeja tras el reproceso, la anulación de una transacción ajena con el vínculo alterado, un pedido entregado más VOIDED y un pago tardío tras archivar la vigilancia. Los cubren C07, C12, C08, C24, C26 y C33 |
| ¿`catch` genéricos que ocultan fallos? | En el producto: `wompiPaymentService.js:208` y `:218` capturan solo la cola de avisos secundaria y vuelven a lanzar el error original (aceptable). `paymentIncidentResolution.js:37` deja escapar errores HTTP como 500 (NV-05). En las pruebas no encontré `catch` que oculten aserciones |
| ¿Pruebas que no ejercen la ruta crítica? | R10, R12 y C18 inyectan la incidencia `coupon_reconciliation` directamente en la base. Son fixtures favorables, compensados por P22b (matriz) y C17, que recorren el flujo real de cupón |
| ¿Dependen del orden? | L02 depende de L01, y está declarado en el código. R13 y R14 cambian temporalmente el rol del admin y lo restauran en `finally`. No observé dependencia en mis ejecuciones repetidas |
| ¿Pueden modificar evidencias o datos reales? | La suite histórica escribe en `docs/auditoria-admin/*-evidencias`. `preservar.cjs` de Codex la desvía, pero solo intercepta `writeFileSync`. Ningún runner usa `.env` ni Atlas: los fixtures reinicializan las variables. No encontré escrituras sin desviar (huella SHA-256 idéntica) |
| ¿"Cientos de PASS" como prueba de seguridad? | No lo acepto: los 273 PASS históricos no ejercen ni NV-01 ni NV-02 |

## 6. Ciclo financiero completo: invariantes

Ciclo reconstruido: cliente → checkout (precio en servidor, clave de idempotencia) → pedido `pendiente` y enlace `single_use` → Wompi → evento firmado → inbox `PaymentEvent` → `GET` privado → asociación por vínculo → transacción 1 (reconocimiento financiero) → transacción 2 (stock, cupón, avisos) → administración (preparación por `canFulfill`) → despacho → conciliación (ID, reproceso o resolución).

| # | Invariante | Estado | Evidencia |
|---|---|---|---|
| 1 | Un pago no se confirma desde información manipulable por el cliente | CUMPLE | C02 y C11. La confirmación del navegador solo lee (`confirmacion/page.js`). El precio se calcula en el servidor (P21/P22 de la matriz) |
| 2 | Un webhook no auténtico nunca autoriza dinero | CUMPLE | C02: 5 variantes con 401 y 0 recibos |
| 3 | Un pago auténtico no desaparece en silencio | **NO CUMPLE** | C07 (NV-01) y C34 (NV-04, condicional). Cumple en C01, C05 y C06 |
| 4 | El pago de un pedido no confirma otro | CUMPLE | C04, C10, C24, C28, C29 |
| 5 | Un mismo efecto no se aplica dos veces | CUMPLE | C06, C09, C13, C19, C22. P11 y P16 de la matriz |
| 6 | Una transacción anulada no autoriza nuevos despachos | CUMPLE | C22, C23, C25, C26 |
| 7 | Un pago discrepante no se presenta como íntegro | CUMPLE | C27 |
| 8 | Una incidencia resuelta no equivale a pago conciliado | CUMPLE | C18, C21 (rechazado, fuera de finanzas, `canFulfill` falso tras resolver) |
| 9 | La confirmación del dinero y el cumplimiento se representan con coherencia | CUMPLE, con matiz | El estado operativo (`enviado`) y el económico (`rechazado`) coexisten tras una anulación (C21), lo que es correcto. NV-06 en la comunicación |
| 10 | Ninguna condición de carrera provoca pérdidas o duplicados silenciosos | CUMPLE para carreras | C06, C13, C19, C22, R08. NV-01 no es una carrera sino una lectura rezagada |
| 11 | Contraentrega conserva sus reglas | CUMPLE | C30. P31 y P32 de la matriz |
| 12 | Los datos financieros son auditables | CUMPLE, con matiz | `PaymentEvent`, `providerObservation`, `resolution` y `AuditLog` transaccional (R12). NV-07 |
