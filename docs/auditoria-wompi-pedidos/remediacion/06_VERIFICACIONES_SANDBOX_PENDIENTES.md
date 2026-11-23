# Contrato Wompi y verificaciones pendientes

Consulta documental: 23/11/2026. No se usaron credenciales, Sandbox real ni medios financieros. Toda transacción de las pruebas locales es simulada.

## Evidencia documental oficial

- [Links de pago](https://docs.wompi.co/docs/colombia/links-de-pago/): POST con llave privada, single_use deja de aceptar nuevas transacciones tras aprobación, monto fijo y expires_at UTC. Documenta redirect_url, pero no garantiza aquí un parámetro id de retorno ni el poblado del vínculo en eventos. No se encontró en esta guía un endpoint para desactivación; esto no prueba que no exista.
- [Eventos](https://docs.wompi.co/docs/colombia/eventos/): firma por propiedades, timestamp y secreto. Ejemplo incluye payment_link_id:null y no sku. HTTP 200 confirma recepción; ante otro código, tres reintentos en 24 h (30 min, 3 h, 24 h). Recibir duraderamente para revisión puede confirmarse con 200; fallar al guardar exige no-200.
- [Seguimiento](https://docs.wompi.co/docs/colombia/seguimiento-de-transacciones/): referencia autogenerada en Links; consulta GET /v1/transactions/{id} exige llave privada desde backend. VOIDED es anulación de tarjeta. Un ID de navegador, email o panel es sólo una pista para consultar, nunca prueba del pago ni vínculo suficiente.
- [Ambientes y llaves](https://docs.wompi.co/docs/colombia/ambientes-y-llaves/): sandbox prv_test_/test_events_; producción prv_prod_/prod_events_. Secreto de eventos distinto del secreto de integridad.

## E01–E06 (todos BLOCKED, no ejecutados)

| ID | Ejecución requerida por operador autorizado | Evidencia y criterio |
|---|---|---|
| E01 | Crear Link en Sandbox, completar transacción, comparar evento firmado y GET autenticado | ID/enlace/importe/moneda/ambiente/timestamps, payload mínimo redactado, properties firmadas. payment_link_id debe identificar inequívocamente el Link en ambas vías. Si está ausente: NO-GO de confirmación automática; conservar inbox |
| E02 | Recibir evento Sandbox por HTTPS público | Firma validada, 200 tras inbox/outbox, stock y repetición sin duplicar; ocultar secretos y datos sensibles |
| E03 | Capturar URL final del Link tras aprobado/rechazado/PENDING | Probar si se añade ID y nombre exacto del parámetro. No extrapolar Widget. Sin evidencia no se implementa recuperación automática desde retorno |
| E04 | Rechazo y reintento del mismo Link, PSE/Nequi/tarjeta | Transacciones distintas, mismo Link, aplicación coherente e idempotente; single_use probado |
| E05 | Solicitar a Wompi contrato soportado de desactivación/expiración | Endpoint/método/roles/respuesta o confirmación oficial de alternativa; expiración no demuestra cancelación de PENDING |
| E06 | Revisión de panel e infraestructura destino | URL, TLS, ambiente/prefijos sin valores, proxy/IP real, replica set, índices existentes, backup restaurable, responsable y fecha |

## Decisión de modalidad

Se conserva Payment Links. La remediación local no acredita su contrato externo.

| Alternativa | Condición | Impacto |
|---|---|---|
| Links con payment_link_id verificable | E01 demuestra vínculo y E02 recepción; ID administrativo legítimo recuperable | Menor cambio, inbox y conciliación reutilizados |
| Web Checkout con reference comercial e integridad | Contrato oficial revisado, Sandbox y autorización expresa de migración | Checkout, llaves, firma, referencias, retornos, reintentos y webhooks deben probarse juntos |
| Otra modalidad oficial | Wompi aporta contrato verificable de asociación/consulta | Análisis específico; sin asociación por importe, email o tiempo |

No hay migración automática ni fallback por sku. No se da por aceptado ninguno de los riesgos por silencio del propietario.

## Contención V-01 — preparada, NO ejecutada

Responsable: operador de hosting autorizado por el propietario; auditor conserva evidencia. Complementa, sin sobrescribir, `docs/auditoria-privacidad/06-plan-despliegue-reversion.md` §7.

1. Identificar versión real API/frontend y leer lógica Nequi desplegada. Registrar nombres/presencia de variables, nunca valores; respaldo controlado en gestor de secretos.
2. Estado esperado para versión vulnerable: NEQUI_ENV=disabled; sin NEQUI_WEBHOOK_SECRET/CLIENT_ID/CLIENT_SECRET/API_KEY. En versión corregida, rutas Nequi 410. No confundir ambos contratos.
3. Operador aplica configuración y reinicia API bajo autorización específica. No se ejecuta desde esta remediación.
4. Comprobación segura: GET checkout/config no ofrece nequi_api; lectura de logs/rutas/código constata webhook 401 en antiguo o 410 en actual. NO enviar eventos de prueba al webhook productivo, ni crear cobros/pedidos productivos para validar.
5. Conservar versión, timestamp Bogotá/UTC, captura redactada de configuración, reinicio, respuesta GET y logs sin PII, nombre del ejecutor y revisión independiente. Conciliar históricos mediante lectura contra extractos, sin marcar pagado manualmente.
6. Reversión: mantener contención al revertir código. Restaurar configuración vulnerable reabre V-01 y exige decisión explícita del propietario; preferir suspender checkout/ruta vulnerable según procedimiento del hosting. No restaurar mock como recuperación rutinaria.

Sin estos artefactos de infraestructura V-01 sigue ABIERTO. Nequi manual de versión antigua necesita instrucción operativa: no aceptar nuevas transferencias por canal retirado.
