# Handoff independiente · preproducción

**VALIDACIONES EXTERNAS PARCIALES. Producción NO-GO.** No se cambian contratos por suposición. Hay evidencia real nueva de Sandbox y una corrección local acotada de RC-01.

## Árbol exacto y preservación

Raíz: `C:\Users\Asus ExpertBook\Desktop\Desarrollo_MBT\Dizor\dizor`; rama main; HEAD 23ce3a6c8d9d36253f8c0e7b1499ce63ce8f95e6. Sin commits/push/deploy de esta fase. Ya existían los deltas de cierre residual y checkout/municipios más auditorías sin seguimiento. No interpretar el HEAD por sí solo como release listo.

`evidencias/control.cjs` tomó hashes de **4320 archivos** antes de modificar código y copió las seis fuentes previstas. `preservacion.json`, `codigo-final-sha256.json` y `rc01.diff` comparan contra esa línea base; el diff global de Git incluye cambios anteriores. Checkout, stock, cupones, firma, consulta privada, asociación y wompiService quedan intactos respecto al inicio.

## RC-01 · se combinan ambas opciones para casos resueltos

Nueva operación admin/superadmin `POST /api/admin/orders/payment-events/:eventId/conclude-follow-up` con motivo. Reconsulta privada fuera de la transacción; luego revalida evento archivado, prueba autenticada procesada, mismo ambiente/transacción, vínculo, importe COP y pago primario aplicado; exige pedido preparable, sin revisión/incidencias y sin VOIDED durable. El cierre no confirma dinero, no mueve inventario ni resuelve incidencias.

Actualiza solo metadata de archivo y AuditLog en la misma transacción. **Escribe __v del pedido** para serializar la decisión con cambios financieros concurrentes; no cambia sus hechos de pago, stock, cupón o estado. Un fallo de auditoría revierte ambos metadatos y esa revisión. Repetición igual conserva una sola decisión/fecha; cambiar conclusión exige reapertura.

El seguimiento concluido deja de sumar al grupo financiero y al total, pero sigue en `view=closed-follow-up` y la tarjeta administrativa, con motivo/fecha y reapertura. Lo abierto sigue contado. Una anulación posterior conserva la alerta/incidencia de pedido y bloquea preparar; no se borra por una conclusión anterior.

Seis fuentes: paymentEventArchive.js, models/paymentEvent.js (cuatro campos opcionales), orderAdminController.js, adminOrderRoutes.js, PaymentEventAlerts.jsx y orderAdminService.js. Sin dependencia ni migración. Detalle y pruebas en 10.

## Evidencia externa nueva, sin exagerar alcance

- La tentativa de pedido nuevo en Mongo efímero devolvió 502 al crear link. Causa no determinada y resultado del POST desconocido; no se repitió con otro pedido. El arnés cerró la réplica.
- Se pagó **un Link test preexistente del piloto anterior** con tarjeta oficial de pruebas, datos sintéticos y consentimiento expreso. Wompi real mostró APPROVED por COP 150.000.
- GET privado real devolvió HTTP 200, `payment_link_id` presente y **exactamente igual** al Link esperado. Evidencia textual redactada y captura, no cuerpos de webhook.
- El retorno de ese Payment Link añadió `id` y `env=test` conservando los parámetros previos. No cambió la página de confirmación.
- Un ensayo independiente E05 creó un Link sin pedido/pago: `expires_at` UTC +24h aceptado con HTTP 201 y eco del mismo instante. No se habilitó TTL en la app ni se validó qué ocurre con PENDING.
- **No hubo webhook auténtico capturado**; E01 completo/E02 y procesamiento DIZOR real siguen pendientes. No se asociaron artificialmente registros del piloto a un pedido nuevo.

Revisar `sandbox-transaccion-real.json`, `sandbox-aprobado.png`, `sandbox-preflight.json`, `sandbox-expiracion-real.json`, `sandbox-real.json` y `browser-sandbox-observaciones.json`. La captura es de prueba; no contiene datos de clientes reales ni PAN completo. Nunca se cargó el MONGO_URI remoto del proyecto; solo se seleccionaron llaves test de su .env con parser.

## Pruebas y diferencias honestas

RC: nueve fallos antes → 9/9 tras corrección; ampliada **11/11** con carrera VOIDED tras GET y superadmin. C 35/35; Z 12/12; R 27/27; L 2/2; N 18/18; v2 2/2; histórica **273/275 (P06/P23)**; matriz **44/5/1 (incluido X07 FAIL)**.

F original **27/28**: F32 no llama a la conclusión motivada y sigue fallando por el flujo anterior. Variante aparte añade solo esa decisión y conserva aserciones: **28/28**. F31/F25 originales permanecen PASS. D original **26/28**; variante D con archivo, **28/28**. No modificar ni reinterpretar los originales como si todos pasaran. Los SHA y transformaciones quedan registrados.

Build aislado del frontend actual y ESLint de las dos fuentes modificadas: PASS. Checkout/catálogo backend **14/14** y municipios/campos frontend **6/6**; logs en 06. **No se probó por navegador el nuevo control de conclusión**: revisión API/compilación/lint. El navegador sí verificó pago y retorno reales de Wompi Sandbox.

## Pendientes que mantienen NO-GO

E01/E02 con receptor HTTPS y pedido actual, E04/E05 completos, E06 destino/backups/avisos y **V-01 producción no contenido/verificado**. El plan cPanel exacto está en 04, listo para aprobación de ventana separada; no se ejecutó. La autorización del usuario fue de Sandbox, no hosting productivo.

Políticas definidas como objetivos en el nuevo encargo; reservas de última unidad/cuota de cupón, recuperación de checkout incierto y vigencia operativa requieren el diseño 05 y una intervención separada. No se implementaron cambios de esquema de inventario ni de ciclo financiero. NV-05/06/07 anteriores no se tocaron.

Validar independientemente: seguridad del nuevo cierre, serialización por revisión de pedido, evidencia real mínima y sus límites, estado exacto del checkout y ausencia de cambios fuera de seis fuentes. No aprobar producción por los mocks ni por el solo GET correcto de una muestra.
