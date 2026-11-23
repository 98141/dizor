# 05 · Hallazgos nuevos

**No encontré ninguna vulnerabilidad nueva de prioridad P1 ni P2.** Hay un único hallazgo, P3, y no bloquea.

---

## RC-01 · P3 · El "seguimiento financiero" de un evento archivado no tiene ninguna salida y mantiene el contador de alertas por encima de cero

**Dónde:**
- `backend/src/services/paymentEventArchive.js:7-9` y `:52-53`: `financialFollowUp: true` se fija siempre y ninguna operación lo cambia.
- `backend/src/controllers/adminAlertController.js:47-51`: el grupo `financialFollowUp` se suma a `totalCount`.
- `frontend/src/app/admin/alertas/page.js:202`: "Todo en orden" solo aparece con `totalCount === 0`.

**Causa:** es una decisión deliberada de Codex ("Todo archivo sigue en supervisión financiera"). No distingue entre dos situaciones:
- Una contradicción cuyo dinero ya está conciliado y aplicado.
- Una que todavía requiere gestión económica.

**Reproducción (F32, FAIL):**
1. Un DECLINED firmado con `GET` APPROVED.
2. Se concilia el pedido: queda pagado, sin incidencias y preparable (preparar da 200).
3. Se archiva con motivo y recibo autenticado.

Los grupos de eventos de pago (pendientes más seguimiento) pasan de **16 a 17** y no hay ninguna acción que los devuelva a 16 (F31: el archivo solo mueve el evento de "pendiente" a "seguimiento").

**Impacto:**
- Es la parte de NR-03 que sigue abierta: fatiga de alertas. Cada contradicción archivada suma un elemento permanente, y la página nunca vuelve a "Todo en orden".
- No hay riesgo financiero: es la opción conservadora, que nunca oculta nada.
- El caso es raro, porque requiere una inconsistencia real del proveedor o un secreto comprometido.

**Corrección mínima.** Es una decisión del dueño, no un defecto de seguridad. Cualquiera de estas dos opciones basta:
- **(a)** Una segunda decisión auditada, "concluir seguimiento". Solo admin o superadmin, con motivo y `AuditLog`. Exige que el pedido del recibo probatorio no tenga incidencias abiertas y que su estado de pago sea coherente con la observación autenticada. Pone `financialFollowUp: false` y conserva todo lo demás.
- **(b)** Mantener la lista de seguimiento visible, pero no sumarla a `totalCount` ni impedir "Todo en orden".

**Regresión:**
- F32 en PASS.
- F31 y F25 deben seguir en PASS.
- Concluir el seguimiento con incidencias abiertas en el pedido debe dar 409.

**¿Bloquea producción?** No.

---

## Observaciones (no son defectos)

| ID | Observación |
|---|---|
| OBS-1 | Las pruebas originales D04b y D19b fallan por diseño correcto (`03` §NR-03). La variante de Codex es la prueba adecuada. Mi archivo D no se modifica |
| OBS-2 | Al recuperar un recibo, `providerObservation` guarda la **última** consulta y `lastError` se limpia. La observación rezagada anterior no queda en el recibo, aunque el hecho sigue rastreable por el aviso `admin.payment_event` y por `notificationQueuedAt`. Es un comportamiento anterior a este cierre |
| OBS-3 | Archivar y reabrir no escriben en el historial del pedido: el evento contradictorio no suele tener pedido. La trazabilidad completa está en `AuditLog` (`entityType: payment_event`, estado previo y nuevo; F30) |
| OBS-4 | Al volver a archivar tras una reapertura, se sobrescribe `administrativeArchive` en el evento. La decisión anterior se conserva en `previousData` del `AuditLog` |
| OBS-5 | Cada reconsulta sigue añadiendo una línea al historial del pedido, ahora etiquetada "Reconsulta". Es correcto, aunque genera algo de ruido |
| OBS-6 | No ejecuté la interfaz del panel. La revisé en el código y me apoyo en la evidencia de navegador de Codex (`panel-result.json` y capturas) |
