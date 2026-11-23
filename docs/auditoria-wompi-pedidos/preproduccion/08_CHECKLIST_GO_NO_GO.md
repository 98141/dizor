# Checklist de salida · sin autorización de despliegue

**Veredicto técnico de esta fase: VALIDACIONES EXTERNAS PARCIALES. Producción: NO-GO.**

| Requisito | Estado | Evidencia / pendiente |
|---|---|---|
| Cierre local NR-01/02/03 aprobado por Claude | Cumplido previamente | auditoria-cierre-residuales/07_VEREDICTO.md |
| RC-01 conclusión auditada + archivo sin sumar al cerrar | VALIDADO SOLO EN LOCAL | 11/11 Q, variante F 28/28; auditoría nueva pendiente |
| Pago test aprobado real | VALIDADO EN SANDBOX | Captura + GET 200, 01 |
| Vínculo GET privado de Payment Links | VALIDADO EN SANDBOX para muestra | Coincide con ID de Link, 01 |
| Vínculo y firma en webhook auténtico | **BLOCKED** | Receptor HTTPS y dashboard Sandbox |
| Procesamiento DIZOR punta a punta del pago real | **BLOCKED** | No acreditado con pedido actual; ensayo de creación devolvió 502 |
| Retorno Payment Link id/env | VALIDADO EN SANDBOX para muestra | URL redactada en 02 |
| Rechazo/PENDING/reintento/reutilización/medios | **PARCIAL / PENDIENTE** | Solo una tarjeta aprobada |
| expires_at 24h aceptado en API | VALIDADO EN SANDBOX | POST 201, fecha idéntica |
| Expiración efectiva y PENDING compatibles con reservas | **BLOCKED** | No habilitar TTL en app antes de completar |
| Nequi antiguo contenido en producción | **ABIERTO** | Plan exacto preparado, no ejecutado |
| Infraestructura real / backup restaurado / entrega de avisos | **BLOCKED** | 03 y responsables |
| Política de autocancelación restringida | Conservada localmente | Objetivo definido; aplicación actual sin cambios |
| Última unidad / cuota de cupón garantizadas | **DISEÑO, INTERVENCIÓN SEPARADA** | 05; sin reserva improvisada |
| Checkout incierto sin duplicado automático | Conservado y diseñado | Intento fallido no se reintentó; recuperación real pendiente |
| Release completo identificado | **PENDIENTE** | main/23ce3a6 más cambios previos y seis fuentes RC-01; SHA en evidencias |
| Pruebas locales y build | Ejecutadas | 06; FAIL históricos y X07 conservados |
| Auditoría final independiente de este delta | **PENDIENTE** | Handoff 09 |
| Autorización de hosting, contención y despliegue | **NO CONCEDIDA por esta fase** | La autorización recibida fue para pruebas Sandbox y consentimientos de una prueba |

No convertir casillas DOCUMENTADO o VALIDADO SOLO EN LOCAL en validación de infraestructura real. No aceptar el conteo global de tests como sustituto de webhook/backup/V-01. Las políticas comerciales están definidas como objetivos; sus cambios significativos siguen requiriendo intervención propia y pruebas.

## Orden concreto para desbloquear

1. Identificar/provisionar receptor HTTPS Sandbox aislado y operador de dashboard; obtener flujo completo E01/E02 con pedido nuevo controlado, sin retry ciego del intento desconocido.
2. Ejecutar por separado la contención V-01 con autorización de ventana y evidencia del hosting; mantenerla en cualquier rollback.
3. Completar E04/E05/E06 y pruebas de operación; resolver diseño/implementación de reservas y checkout incierto en intervenciones separadas.
4. Seleccionar release exacto, auditar checkout y este cambio RC-01, verificar restauración/avisos y solicitar revisión independiente final.

Este documento prepara una decisión futura; **no autoriza desplegar ni activar ventas reales**.
