# E01 / NV-04 · contrato real

2026-11-23, America/Bogota. **VALIDADO EN SANDBOX, PARCIAL. No es aprobación de producción.**

## Qué se ejecutó realmente

El propietario autorizó las llamadas y transacciones Sandbox en este chat; autorizó además los consentimientos del checkout para una transacción ficticia de $150.000. Se comprobaron los prefijos test sin imprimir llaves. La configuración Mongo del proyecto apunta fuera del equipo: **no se utilizó ni se conectó**.

Se intentó crear un pedido en un replica set efímero y su enlace mediante el checkout actual. La solicitud a Wompi se inició y el checkout respondió 502; el arnés no conservó el diagnóstico HTTP del proveedor y cerró su réplica temporal. **No está determinada la causa ni se puede certificar el resultado de creación del enlace. No se generó otro pedido como reintento automático.** `evidencias/sandbox-real.json` y `sandbox-session.txt` conservan ese intento fallido. Se mejoró el diagnóstico del arnés para futuras intervenciones, sin volver a ejecutarlo.

Para comprobar el contrato externo se usó el enlace Sandbox **preexistente** documentado en `docs/checkout-evidencias/sandbox-link.json`, creado anteriormente con `wompiService.createPaymentLink`. El GET público confirmó su existencia, ambiente test y vigencia sin expiración. En el checkout oficial se observó MODO DE PRUEBAS, se usó tarjeta de prueba oficial y datos sintéticos. Wompi mostró **¡Pago aprobado!**. Se consultó ese mismo ID mediante GET privado autenticado con llave Sandbox; no se creó ni consultó una transacción productiva.

## Evidencia mínima redactada

| Dato | Resultado real |
|---|---|
| Recepción de resultado en navegador | 2026-11-23, aproximadamente 16:40 Bogotá |
| GET privado | HTTP 200, 2026-11-23 21:42:34 UTC / 16:42:34 Bogotá |
| ID de transacción | sha256:f37a55f19f39bb3b |
| ID de enlace esperado | sha256:043501bf97d24da9 |
| `payment_link_id` de GET | Presente, no null; sha256:043501bf97d24da9; **coincide exactamente** |
| Referencia del proveedor | sha256:638b250258b70f94; generada por Wompi, contiene el ID del enlace |
| Importe | 15.000.000 centavos = COP 150.000 |
| Moneda / estado | COP / APPROVED |
| Ambiente | Sandbox; comercio pub_test, enlace test; checkout en MODO DE PRUEBAS |
| Creación / finalización del pago | 21:40:50.288Z / 21:40:51.471Z |
| Webhook auténtico recibido por nuestro entorno | **No recibido / no capturado**; sin receptor HTTPS autorizado configurado |
| `payment_link_id` del webhook | **NO VERIFICADO** |
| Firma real del webhook | **NO VERIFICADA** |
| Pedido correspondiente | Referencia sintética del enlace preexistente, DIZ-QA-…; no se rebindeó a un pedido nuevo |
| Estado final persistido en DIZOR de ese pago | **NO DEMOSTRADO**; el ensayo de pedido nuevo falló y el enlace pagado pertenece al piloto anterior |

Evidencia: `sandbox-preflight.json`, `sandbox-transaccion-real.json`, `sandbox-aprobado.png`, `browser-sandbox-observaciones.json`. IDs textuales de informes se sustituyen por SHA-256 truncado para correlacionar sin publicar el registro completo. La captura muestra exclusivamente datos de prueba, tarjeta oficial enmascarada y la referencia ficticia.

## Conclusión y requisito para cerrar

Se resolvió una incertidumbre concreta: **esta transacción real de Payment Links sí trae el vínculo esperado en GET privado**. No se extrapola a todos los métodos ni a su webhook. El criterio completo E01 sigue **BLOCKED/PARCIAL** porque falta el evento auténtico y la asociación punta a punta de un pedido actual.

La documentación de [seguimiento de transacciones](https://docs.wompi.co/docs/colombia/seguimiento-de-transacciones/) respalda la consulta privada; su guía no sustituye una muestra auténtica del campo de asociación. La [guía de Links](https://docs.wompi.co/docs/colombia/links-de-pago/) se consultó para preservar la modalidad actual.

Para cerrar: preparar un backend aislado con datos de prueba y receptor HTTPS; registrar su URL **en el panel Sandbox**, con autorización; crear un único pedido trazable; completar una nueva transacción; guardar solo el extracto permitido del webhook, resultado de firma y GET privado; demostrar que ambos vínculos coinciden con el pedido y que el procesamiento final es único. Si falta el vínculo en cualquiera de las dos vías, conservar la evidencia y presentar decisión arquitectónica: no usar importe, correo, cercanía temporal, `sku` ni la referencia autogenerada como atajo de asociación.
