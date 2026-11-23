# E02 a E05 · resultados y procedimiento

Consultas documentales y ensayos: 2026-11-23. Solo Wompi Sandbox. Ningún cambio del panel productivo.

## E02 · webhook auténtico — BLOCKED

No se encontró una URL HTTPS de pruebas configurada ni acceso al panel de eventos Sandbox. No hay captura auténtica, firma real validada, acuse HTTP medido ni evidencia de persistencia de ese evento en el pedido del ensayo. **Cero eventos artificialmente firmados se presentan como notificación real.** Las pruebas locales existentes usan firmas ficticias solo como regresión local.

Procedimiento ejecutable una vez provisionado el entorno:

1. Operador prepara HTTPS de pruebas hacia `/api/webhooks/wompi`, con almacenamiento aislado y secretos test. No redirigir eventos test a una API productiva.
2. Configura la URL en el dashboard **Sandbox** y registra fecha/ambiente sin mostrar secretos.
3. Crea un pedido ficticio por el checkout actual y guarda su referencia y vínculo en evidencia privada controlada.
4. Completa el pago con datos de la [guía oficial Sandbox](https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/).
5. Observa recepción real: evento, ambiente, instante, campos financieros permitidos, propiedades firmadas y resultado booleano de checksum. No guardar cuerpo completo, contactos ni información de tarjeta.
6. Comprueba PaymentEvent, pedido, stock y outbox. Reenvío y fallo transitorio se prueban únicamente allí, con autorización; repetir una copia propia demuestra idempotencia local, **no** el reintento auténtico del proveedor.
7. Para acreditar reintento real, induce un fallo controlado no-200 exclusivamente en el receptor de pruebas; registra el reenvío de Wompi y la recuperación. No usar el webhook productivo para pruebas.

La [documentación de eventos](https://docs.wompi.co/docs/colombia/eventos/) describe checksum y recepción mediante webhook. La configuración documental no acredita recepción, entrega de correo ni recuperación efectiva.

## E03 · retorno — VALIDADO EN SANDBOX, alcance limitado

Tras el pago aprobado se pulsó “Volver al comercio”. URL observada, redactada:

```text
http://localhost:3000/pedido/confirmacion?order=<pedido_prueba>&payment=wompi&id=<sha256:f37a55f19f39bb3b>&env=test
```

Este Link añadió **id y env=test**, conservando los parámetros originales. No se extrapola desde Widget. El retorno llegó a una instancia localhost ya abierta; no se operó su panel, no se crearon pedidos desde ella ni se certificó su base o el procesamiento del pago. El pedido de este piloto no fue dado de alta en esa instancia por nosotros.

El ID es una pista para consultar desde backend y comprobar ambiente/vínculo/importe; nunca acredita pago por sí mismo. **No se modificó la página de confirmación ni se añadió conciliación automática del navegador.**

## E04 · reintentos — PARCIAL

Ejecutada una tarjeta aprobada real de Sandbox. No se ejecutaron tarjeta rechazada, PSE, Nequi dentro de Wompi, PENDING, rechazo→aprobación, segunda transacción en el mismo enlace ni eventos reales fuera de orden. Los consentimientos se autorizaron para esta prueba concreta.

El enlace informa `single_use=true` y, **después del pago, `active=true`**. No se deduce de ese flag que admita o rechace otra aprobación. La reutilización requiere un ensayo específico; no se inició un segundo pago para inferir su resultado.

Matriz pendiente: rechazado→reintento en mismo enlace si se permite, IDs distintos, aprobación posterior, reutilización después de APPROVED, reenvío auténtico y orden invertido. Comparar conteo de pedidos, movimientos y avisos antes/después. Las suites locales conservan un único descuento/aviso, pero no acreditan el comportamiento del proveedor real.

## E05 · 24 horas — VALIDADO EN SANDBOX, PARCIAL

Se creó **un enlace independiente E05**, sin pedido ni transacción, para comprobar el parámetro propuesto. No fue un reintento del pedido fallido.

| Campo | Evidencia real |
|---|---|
| POST Sandbox | HTTP 201 |
| TTL solicitado | 24 horas |
| Fecha base | 2026-11-23T21:44:03.871Z |
| `expires_at` solicitado y devuelto | **2026-11-24T21:44:03.871Z**, mismo instante |
| Vencimiento Bogotá | 24/11/2026, 16:44:03.871 |
| ID redactado | sha256:ebc5bb7b6a2d9134 |
| `single_use` | true |
| Pago generado por ese enlace | Ninguno |

`evidencias/sandbox-expiracion-real.json` y el ejecutable `sandbox-expiry.cjs` conservan el ensayo. La [guía oficial de Links](https://docs.wompi.co/docs/colombia/links-de-pago/) sitúa la expiración en UTC y la vincula a nuevas transacciones. **No demuestra que anule una transacción en curso.**

No se esperó el vencimiento ni se probó PENDING cruzando ese instante. Tampoco se demostraron cierre/desactivación, reintento vencido, tratamiento de links antiguos o pagos tardíos en el proveedor. Los enlaces existentes del flujo actual siguen sin fecha: se observó expiresAt=null en el Link pagado. **X07 sigue FAIL y no se habilitó la vigencia en el código de DIZOR.**

Para completar: conservar ID en registro operativo privado, observar antes/después de vencimiento, intentar inicio posterior con datos test y comprobar el rechazo; iniciar PENDING antes, observar finalización tardía y validar conservación del cobro/revisión sin liberar stock por presunción. Si el proveedor no permite ese ensayo o no ofrece un cierre verificable, documentar la limitación y mantener el bloqueo correspondiente.
