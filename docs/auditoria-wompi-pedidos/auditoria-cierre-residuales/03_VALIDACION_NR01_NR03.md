# 03 · Validación de NR-01, NR-02 y NR-03

**Prefijos de prueba:**
- **F:** batería nueva de esta auditoría, `evidencias/adversarial-cierre.test.cjs` (28 casos).
- **D:** mi batería anterior, sin modificar.
- **Z:** pruebas residuales de Codex.

Los valores observados (`OBS ...`) están en `evidencias/ejec-*.txt`.

## NR-01: un pedido pagado ya no queda en revisión sin motivo

**Cambio:** `orderAdminController.js:228`. Ahora `requiresReview` se recalcula desde las incidencias abiertas siempre que se cierre algún fallo de consulta, y no solo cuando la transacción es APPROVED.

**Intento de romperlo.** Busqué dejar un pedido pagado en revisión sin incidencia explicativa:

| Prueba | Escenario | Resultado |
|---|---|---|
| D13 (original) | APPROVED aplicado, fallo 500 y conciliación del intento DECLINED | **PASS** (antes FAIL): `requiresReview=false`, preparar da 200 |
| F01 | El anterior, y luego la conciliación correcta | PASS. Sigue pagado con la transacción principal intacta; stock −1 |
| F02 | DECLINED primero, APPROVED después en el mismo enlace, timeout y conciliación del DECLINED | PASS. Preparable |
| F03 | DECLINED, ERROR y APPROVED; dos pistas fallidas (502 y timeout); conciliación del ERROR | PASS. Las 2 incidencias cerradas; preparable |
| F04 | **Incidencia legítima:** segundo APPROVED (`additional_approved_payment`), fallo y conciliación de un DECLINED | PASS. Solo se cierra el fallo de consulta; la incidencia financiera sigue abierta y preparar da 409 |
| F05 | Pago anulado (VOIDED), fallo y conciliación de un DECLINED | PASS. `payment_voided` abierto; sigue bloqueado |
| F06 | Pedido **no** pagado, fallo y conciliación de un DECLINED | PASS. No se vuelve preparable ni mueve stock |
| F07 | **Fallo real de Mongo** (`commitTransaction`, código 2) durante la conciliación | PASS. Responde 500 con la incidencia aún abierta (sin desbloqueo parcial). El reintento converge, con un único `AuditLog` |
| F08 | 3 conciliaciones DECLINED, 1 APPROVED y 1 fallida, simultáneas | PASS. Converge sin incidencias, con un `AuditLog`, stock −1 y un aviso |
| Z01, N08, D16 | Pruebas de Codex y mías anteriores | PASS |

**Conclusión: CERRADO.** No logré dejar un pedido pagado bloqueado sin motivo, y ninguna incidencia legítima se elimina. El recálculo es seguro: `addIncident` siempre registra la incidencia de cualquier condición que bloquee, y `canFulfill` sigue exigiendo `stockDeducted` (F06).

## NR-02: metadatos del recibo veraces

**Cambios:**
- `orderAdminController.js:283`: solo se etiqueta una sustitución si el recibo verificado es **otro**. Si es el mismo, conserva su asociación y limpia `lastError`.
- `wompiPaymentService.js:140-145` y `:228`: `processedAt ||=` en la fase 2 y en la rama de sustitución del webhook, esta última ahora dentro de una transacción.
- `:214` y `:222`: las consultas repetidas se registran como "Reconsulta".

**Auditoría de campos de `PaymentEvent`:**

| Campo o propiedad | Prueba | Resultado |
|---|---|---|
| Identidad (`_id`, `key`, `transactionId`, `status`, importe, moneda, referencia, ambiente, vínculo, `checksum`, `providerTimestamp`, `source`) | F10 (12 campos comparados antes y después de reprocesos, reenvío y conciliación concurrentes) | PASS. Sin cambios |
| Fecha original (`createdAt`) | F10 | PASS |
| `processedAt` (primer proceso) | F10, F11, F12, F13, D18, Z02 | PASS. Se mantiene al milisegundo tras repetir el reproceso, el webhook, la conciliación y la concurrencia |
| Estado de procesamiento | F10–F13 | PASS |
| Motivo de sustitución | D17b, F10 (misma clave: `associationError=""`, `lastError=""`), F11–F13 (otra clave: `superseded…` o `provider_binding_mismatch` conservado) | PASS |
| Referencias circulares | F10, F11, F12, F13 | PASS. El original solo apunta al recibo verificado, nunca a sí mismo |
| Asociación (`order`) | F10, F11 | PASS |
| Evidencia del proveedor (`providerObservation`) | F10 | Conserva la **última** observación (APPROVED). La observación rezagada anterior (PENDING) se sobrescribe al recuperar: comportamiento que ya existía (OBS-2). El hecho del rezago sigue rastreable por el aviso `admin.payment_event` y por `notificationQueuedAt` |
| Historial ante repeticiones | F10 | PASS. Una sola línea "Wompi APPROVED verificado" y las siguientes como "Reconsulta Wompi APPROVED". Ya no se describe dos veces como primer proceso |
| Cierres falsos | D20, N14, N15 | PASS. Un fallo no cierra el original |

**Conclusión: CERRADO.** No encontré pérdida de identidad, fechas reescritas, referencias circulares ni cierres falsos.

## NR-03: archivo administrativo de contradicciones permanentes

**Cambio:**
- `models/paymentEvent.js:18`: subdocumento opcional `administrativeArchive`.
- `services/paymentEventArchive.js` (nuevo): archivar y reabrir.
- Dos rutas para admin y superadmin.
- La vista "pending" excluye los eventos archivados; el grupo "seguimiento financiero" los incluye.
- El reproceso exige reabrir primero.

**Intentos de abuso:**

| Intento | Prueba | Resultado |
|---|---|---|
| Archivar sin autenticación, como vendedor o como cliente | F20, Z04 | 401 / 403 / 403. Reabrir como vendedor: 403. Sin efectos |
| Sin motivo: cuerpo ausente, vacío, solo espacios, >1000 caracteres o un objeto `{$gt:''}`; sin evidencia, evidencia inválida o inyección `{$ne:null}` | F21, Z04, Z11 | 400 en los 9 casos. Reabrir sin motivo: 400. Ningún `AuditLog` |
| Archivar un pago sin conciliación (sin recibo autenticado procesado) | F22 | 409. Sigue en la bandeja |
| **Archivar un APPROVED firmado** (posible cobro perdido), aunque exista un recibo DECLINED autenticado; y un APPROVED con `GET` rezagado | F23, Z05 | 409 en ambos. **Un APPROVED firmado no puede ocultarse por esta vía** |
| Evento de otro pedido o evidencia de otra transacción | F24 | 409 |
| Evidencia inválida: el propio evento, un recibo no procesado o de otro ambiente | F33, Z11 | 409 |
| Evento sin asociación confiable (sin vínculo) | F35, Z05 | 409. Sigue en la bandeja |
| Archivar repetidamente o de forma concurrente | F26, Z06 | Un solo `AuditLog`. Repetir con el mismo cuerpo es idempotente; un motivo distinto da 409 hasta reabrir |
| Archivar y recibir de nuevo el webhook | F27 | 503 (la contradicción persiste). El archivo y la evidencia no cambian; no se confirma nada |
| Archivar y recibir un VOIDED nuevo de la misma transacción | F27 | Se procesa (`rechazado` con `payment_voided`). Queda visible y el seguimiento continúa |
| Reprocesar un evento archivado | F28 | 409. Tras reabrir (auditado, idempotente): vuelve a la bandeja y el reproceso da 503 sin cerrar en falso |
| Archivar con un fallo real de Mongo (`insert` de `AuditLog`, código 2) | F29, Z08 | 500. **Ni archivo ni auditoría** (atomicidad); el reintento registra una sola decisión |

**Lo que el archivo NO puede hacer:**

| Garantía | Prueba | Resultado |
|---|---|---|
| Confirmar pagos, desbloquear preparación, modificar importes, descontar inventario o tocar cupones y avisos | F25 (contradicción de estado y de importe), Z07 | PASS. El documento `Order` completo es idéntico antes y después; stock y número de notificaciones iguales |
| Borrar evidencia | F25 | PASS. Todos los campos del evento salvo `administrativeArchive` y `updatedAt` son idénticos; `processedAt` sigue en `null` |
| Ocultar permanentemente una discrepancia | F31 | PASS. Sale de la bandeja principal (−1), entra en el seguimiento financiero (+1), sigue en el total de alertas y aparece en `?view=financial-follow-up` |
| `AuditLog` completo | F30, Z03 | PASS. Actor, rol (admin o superadmin), motivo, recibo probatorio, `entityType: payment_event`, estado previo y nuevo, también al reabrir |
| Vistas sin inyección ni ambiente ajeno | F34 | `verified` sin ID, `transactionId[$ne]` o una vista desconocida dan 400; un vendedor, 403 |

**Mis pruebas originales D04b y D19b siguen fallando (26/28), y el resultado es el correcto.**
- Las escribí cuando no existía ninguna acción de cierre, y su aserción exige que el recibo desaparezca de la bandeja **sin ninguna decisión**.
- Mi propia recomendación (`auditoria-claude-2/05` §NR-03) pedía un archivo **explícito, con motivo y auditado**, no una retirada automática. Para pasar, el código tendría que ocultar evidencia por su cuenta.
- La variante de Codex (`cierre-residuales/evidencias/adversarial-con-archivo.test.cjs`):
  - Carga mi archivo sin modificarlo; el SHA coincide con el actual.
  - Inserta solo la llamada de archivo, con motivo y recibo probatorio, antes de las mismas aserciones.
  - Da 28/28, que reproduje.
- Acepto la variante como la expresión correcta del criterio. **No modifico mi archivo original**, que queda como evidencia de la línea base.

**Conclusión: CERRADO en su núcleo, con un residuo P3 (RC-01).**
- **Cerrado:** ya existe una vía de cierre auditada, segura y que no puede usarse para ocultar un cobro.
- **Residuo:** el impacto que describí entonces, "el contador de alertas nunca vuelve a cero", **persiste por diseño**. El evento archivado pasa a un grupo de seguimiento financiero que cuenta en el total y no tiene ninguna acción de conclusión, aunque el dinero ya esté conciliado y el pedido sea preparable (F32: los grupos de pago pasan de 16 a 17). Ver `05`.
