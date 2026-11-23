# 08 · Checklist final

**Tipos de evidencia:**
- **SB:** Sandbox real.
- **PR:** producción.
- **LO:** prueba local.
- **DO:** documental.
- **BL:** bloqueo abierto.

**Ninguna casilla autoriza un despliegue por sí sola.** Los responsables son los que propone Codex. Ninguno está designado de forma nominal: lo debe hacer el dueño.

## A. Bloqueantes (deben quedar marcados con evidencia antes de cualquier GO)

| ☐ | Tarea | Responsable | Estado | Tipo |
|---|---|---|---|---|
| ☐ | **V-01:** contener el webhook Nequi en producción según `preproduccion/04`, con release, configuración redactada antes y después, reinicio y logs | Administrador del cPanel de la API | No ejecutado | BL |
| ☐ | **FF-01:** congelar un commit de release que incluya **todo** lo auditado, publicarlo en `origin` y repetir las suites sobre ese SHA | Dueño y desarrollador | No existe | BL |
| ☐ | **FF-02:** diagnosticar el 502 del checkout real; crear **un** pedido nuevo con el checkout de ese SHA y obtener su enlace en Sandbox | Operador de Sandbox | Falló, causa desconocida | BL |
| ☐ | **E01/E02:** receptor HTTPS de pruebas; pago Sandbox de ese pedido; webhook auténtico con firma válida, `payment_link_id` igual al del `GET` y al pedido; pedido `pagado`, stock −1 y un aviso; reenvío sin duplicar | Operador de Sandbox | `GET` OK en 1 muestra; el resto sin ejecutar | SB parcial + BL |
| ☐ | **E04:** tarjeta rechazada, PENDING, PSE, Nequi en Wompi; rechazo seguido de aprobación en el mismo enlace; intento de segundo pago tras APPROVED | Operador de Sandbox | Solo una aprobada | BL |
| ☐ | **E06:** replica set del destino; inventario de índices y duplicados (FF-04); variables (`04` §3); TLS; CORS; `trust proxy` | Operador de infraestructura | Nada | BL |
| ☐ | Respaldo cifrado y **restauración probada** en un destino no productivo | Operador de infraestructura | Nada | BL |
| ☐ | Entrega real de alertas (Resend) a un buzón administrativo | Operador | Nada | BL |
| ☐ | Procedimiento para habilitar Wompi **solo** durante la prueba controlada (FF-05) | Dueño y operador | No existe | BL |

## B. Decisiones del dueño (aceptación escrita con procedimiento probado)

| ☐ | Decisión | Estado |
|---|---|---|
| ☐ | WP-09: retirada de la autocancelación de Wompi | Pendiente |
| ☐ | WP-07: vigencia de enlaces (implementar `expires_at` o aceptar la conciliación diaria) | Pendiente |
| ☐ | WP-08: última unidad (reserva, o aceptación con devolución en un plazo) | Pendiente |
| ☐ | WP-12: checkout incierto (procedimiento ante un 502, como el ocurrido) | Pendiente |
| ☐ | WP-15: cupones limitados | Pendiente |
| ☐ | Devoluciones manuales con doble control (escrito y ensayado) | Pendiente |
| ☐ | FF-06: procedimiento ante una contradicción de importe firmado (rotar el secreto de eventos) | Pendiente |

## C. Operación

| ☐ | Tarea | Estado |
|---|---|---|
| ☐ | Responsable y frecuencia de la bandeja de eventos y del seguimiento financiero | Sin designar |
| ☐ | Cruce diario entre el panel de Wompi y los pedidos (pendientes de más de 24 h) | Sin designar |
| ☐ | Guardia durante la ventana de lanzamiento y criterio de reversión (`07`) | Sin designar |
| ☐ | MFA y cuentas de administrador revisadas | Sin evidencia |

## D. Ya demostrado en local (LO), a repetir sobre el SHA del release

| ✔ | Conjunto | Resultado actual |
|---|---|---|
| ✔ | Seguridad financiera del código (`02`: #2, #6, #8, #11, #12, #17) | Demostrado (LO) |
| ✔ | NR-01 a NR-03, NV-01 a NV-03 y WP-01 a WP-06 sin reaparecer | `05` |
| ✔ | Contraentrega, checkout y municipios (backend) | `05` |
| ✔ | `GET` privado real con el vínculo correcto | 1 muestra SB |
| ✔ | Retorno con `id` y `env` | 1 muestra SB |
| ✔ | El API acepta `expires_at` | SB |
