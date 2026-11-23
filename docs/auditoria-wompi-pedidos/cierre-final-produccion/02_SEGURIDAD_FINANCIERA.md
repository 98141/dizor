# 02 · Seguridad financiera: invariantes

**Tipos de evidencia:**
- **LO:** demostrado con pruebas locales ejecutadas en esta ronda sobre el árbol actual (`05`).
- **SB:** Sandbox real.
- **PR:** producción.

**"Demostrado (LO)" significa que el código lo garantiza en un entorno simulado. No equivale a "demostrado con Wompi real".**

| # | Invariante | Demostrado (LO) | Evidencia real (SB/PR) | Estado para producción |
|---|---|---|---|---|
| 1 | No se pueden confirmar pagos falsos | Sí: C02 (5 variantes con 401), P09, P10, P26 | Firma real no verificada (E02) | **PARCIAL** |
| 2 | El cliente no puede alterar el importe | Sí: P21, P22, C27, `checkout.test.js` | — | **DEMOSTRADO (LO)**. El importe se calcula en el servidor |
| 3 | Una transacción no se aplica a otro pedido | Sí: C04, C10, C24, C28, C29, D14, D21 | `GET` real trae el vínculo correcto (1 muestra) | **PARCIAL**: falta el vínculo en el webhook real |
| 4 | Los webhooks se autentican | Sí: C02, P09, P10 | No verificado | **PARCIAL** |
| 5 | Los eventos auténticos no desaparecen | Sí: C01, C05, C07, D01, D07 | Reintentos reales no observados | **PARCIAL** |
| 6 | Los reintentos son idempotentes | Sí: C06, C13, D08, D23, F08, F10, P11, P16 | — | **DEMOSTRADO (LO)** |
| 7 | Los pagos rechazados no quedan confirmados | Sí: P02, D02, D03 | Rechazo real no ejecutado | **PARCIAL** |
| 8 | Los pendientes no permiten despachos indebidos | Sí: P03, `canFulfill`, F06 | — | **DEMOSTRADO (LO)** |
| 9 | Las anulaciones bloquean operaciones incompatibles | Sí: C22–C26, D05, D06, F05, F27, G06 | Anulación real no ejecutada | **PARCIAL** |
| 10 | La conciliación recupera pagos auténticos | Sí: C09, D10, D12, F01–F08 | `GET` privado real funciona (1 muestra) | **PARCIAL**: sin un pedido de DIZOR recuperado en real |
| 11 | Los errores del proveedor no producen confirmaciones falsas | Sí: D07, D11, D22, G05; el 502 real no confirmó nada | El 502 real dejó el pedido `failed` | **DEMOSTRADO (LO + 1 caso SB)** |
| 12 | Las incidencias conservan trazabilidad | Sí: D12, F30, G01, G09, R12 | — | **DEMOSTRADO (LO)** |
| 13 | El inventario no presenta sobreventa no gestionada | Se **gestiona** (incidencia y bloqueo: P34, Q05), pero **puede ocurrir** (WP-08) | — | **RIESGO RESIDUAL NO ACEPTADO** |
| 14 | Los enlaces vencen o tienen un control equivalente aprobado | **No:** X07 FAIL | `expiresAt: null` (SB) | **NO CUMPLE** |
| 15 | Los cupones cumplen la política | Parcial: C17, P35 | — | **RIESGO RESIDUAL NO ACEPTADO** |
| 16 | Un checkout incierto no genera cobros ni pedidos duplicados en silencio | Duplicados de pedido evitados (P15, P16, `checkout.test.js`) | **Un 502 real dejó un resultado desconocido en el proveedor**, sin recuperación soportada | **NO DEMOSTRADO** |
| 17 | Contraentrega funciona de forma independiente | Sí: C30, P31, P32, `checkout.test.js` | — | **DEMOSTRADO (LO)** |

**Resumen:**
- **Cerradas por el código (LO), sin dependencia externa:** 6 (las #2, #6, #8, #11, #12 y #17).
- **Pendientes de evidencia real:** 7 (de la #1 a la #10).
- **Con riesgo comercial no aceptado:** 2 (#13 y #15).
- **No cumplen o no están demostradas:** 2 (#14 y #16).

**Lo que el código sí garantiza.** Ninguna prueba local, en cinco rondas y más de 200 casos adversariales, consiguió:
- Confirmar dinero falso.
- Aplicar un cobro al pedido equivocado.
- Duplicar efectos.
- Perder en silencio un evento auténtico.

**Lo que falta** es demostrar que el sistema real se comporta igual y cerrar las políticas.
