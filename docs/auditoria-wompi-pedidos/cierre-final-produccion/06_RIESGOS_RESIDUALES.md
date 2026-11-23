# 06 · Riesgos residuales y políticas comerciales

## 1. Hallazgos de esta auditoría final

| ID | Prioridad | Hallazgo | Bloquea |
|---|---|---|---|
| FF-01 | **P1** | **No existe un release identificable.** Lo auditado es HEAD `23ce3a6` más 16 archivos modificados y más de 10 sin seguimiento (pagos, archivo y conclusión, checkout, municipios). `main` va 1 commit por delante de `origin`, y producción, unos 53 commits por detrás. Ningún GO puede referirse a un commit que no existe | **Sí** |
| FF-02 | **P1** | El checkout actual **no inició** un cobro en el Sandbox real: 502 con causa desconocida y resultado en el proveedor desconocido (`03` §Hallazgo) | **Sí** |
| FF-03 | **P1** | Sin webhook auténtico (E02): firma real, vínculo en el evento y procesamiento de DIZOR sin observar | **Sí** |
| V-01 | **P1** | Contención en producción no ejecutada | **Sí** |
| FF-04 | P2 | `autoIndex` sobre datos de producción no inventariados: el fallo de un índice único (por ejemplo, `idempotencyKey`) deja sin protección la idempotencia o la unicidad, **sin error visible** | Sí, hasta inventariar |
| FF-05 | P2 | No hay un interruptor de Wompi separado del despliegue: la prueba productiva controlada abre los pagos a todos (`07` #12) | Requiere procedimiento |
| FF-06 | P3 | Se puede **concluir** el seguimiento de una contradicción de **importe firmado** (G03: 200). Como el importe va firmado, es una señal de posible compromiso del secreto de eventos. Hace falta un procedimiento: tratarlo como incidente de seguridad (rotar `WOMPI_EVENTS_SECRET` e investigar) antes de concluir. No exijo cambio de código | No, con procedimiento |
| FF-07 | P3 | `docs/checkout-evidencias/sandbox-link.json` (commiteado) contiene la URL completa de un enlace de Sandbox. Sin dinero real, pero no conviene publicarlo en el repositorio remoto | No |

**Heredados abiertos:**
- NV-05, NV-06 y NV-07 (P3).
- OBS-3: `npm test` depende de `docs/`.
- El 404 de checkout original sigue sin explicar (`docs/checkout-audit-fixes.md`).

## 2. Políticas comerciales

Criterio del encargo: cada política debe estar **implementada y probada**, o **mitigada mediante un control operativo demostrado y un riesgo residual aceptado expresamente**.

| Política | Implementación | Pruebas | Control operativo y aceptación | Estado |
|---|---|---|---|---|
| Cancelación de un Wompi pendiente | Implementada: el cliente recibe 409 y la cancelación es administrativa | C31, P23-v2 (LO) | **Aceptación escrita del dueño pendiente** (P23 original FAIL) | **No cerrada** |
| Vigencia de enlaces | **No implementada**: `expires_at` no se envía | X07 FAIL (LO); `expiresAt: null` (SB) | Ninguno aceptado | **No cerrada** |
| Última unidad | **No implementada** (sin reserva). Se detecta con `approved_without_stock` | P34, Q05 (LO): detecta, no impide | Diseño propuesto (`preproduccion/05`); sin aceptación ni procedimiento de devolución probado | **No cerrada** |
| Checkout incierto | Pedido `failed` con vigilancia e incidencia; sin recuperación soportada del enlace | P05b (LO); **ocurrió en Sandbox real (502)** | Ninguno demostrado | **No cerrada** |
| Cupones limitados | Consumo transaccional e incidencia `coupon_reconciliation` con `accept_discount` | C17, P35 (LO) | Sin aceptación del riesgo de descuento extra | **No cerrada** |
| Devoluciones manuales | Atestación de superadmin con evidencia (`manual_refund_confirmed`) | C16 (LO) | **Sin procedimiento escrito de doble control** ni prueba real | **No cerrada** |
| Pago aprobado sin stock | Dinero reconocido, bloqueo, incidencia y salida | C/P35, C21 (LO) | Depende de la devolución manual | **Parcial** |
| Pago aprobado tras cancelar | `approved_after_cancellation` bloquea y alerta | P19, C33 (LO) | Depende de la devolución manual | **Parcial** |

**Ninguna política comercial cumple el criterio de cierre.** Las que están implementadas carecen de la aceptación expresa del dueño. Las demás no tienen ni implementación ni un control operativo demostrado.

## 3. Riesgos que el dueño podría aceptar de forma expresa (una vez cerrados los P1)

Para un lanzamiento controlado de bajo volumen, serían aceptables con **aceptación escrita, responsable y procedimiento ensayado**:
- **WP-08 (última unidad):** con un procedimiento de devolución en 48 h.
- **WP-15 (cupones):** con un límite de cupones activos.
- **WP-07 (vigencia):** con conciliación diaria y cancelación administrativa de pedidos antiguos.
- **NV-05 a NV-07 y FF-07.**

**No son aceptables por simple decisión:** FF-01, FF-02, FF-03 y V-01.
