# 07 · Evaluación del plan de despliegue controlado

**Fuentes:**
- `docs/auditoria-privacidad/06-plan-despliegue-reversion.md`: secuencia en cPanel/Passenger, compatibilidad de la API, variables y reversión.
- `docs/auditoria-admin/CHECKLIST_DESPLIEGUE_PENDIENTE.md`.
- `preproduccion/04` (V-01) y `preproduccion/08`.

**No existe un plan único y vigente para *esta* versión**: Wompi, checkout y municipios. Los planes existentes son de fases anteriores y anuncian expresamente que no están ejecutados.

| # | Paso exigido | ¿Existe un procedimiento? | ¿Es seguro? | Falta |
|---|---|---|---|---|
| 1 | Congelar el commit de lanzamiento | **No.** HEAD `23ce3a6` más 16 archivos modificados y más de 10 sin seguimiento. `main` va 1 commit por delante de `origin` | — | Commit o etiqueta de release con **todo** lo auditado, y repetir las suites sobre ese SHA |
| 2 | Respaldar la base de datos | Mencionado en el checklist | Sin ensayo | Respaldo con fecha, alcance y cifrado, más restauración probada en un destino no productivo |
| 3 | Verificar infraestructura | Lista en `preproduccion/03` | — | Todo `04` §2 |
| 4 | Desplegar backend compatible | "API primero" (`06-plan` §2.2), contratos tabulados | Razonable | Revisar que la tabla cubra los contratos nuevos: bandeja, archivar y concluir, municipios, transportadora ignorada. Inventario previo de índices (`autoIndex`) |
| 5 | Desplegar frontend | Build con `NEXT_PUBLIC_*` y purga de LiteSpeed/ISR | Razonable | Build de **ese** commit en el entorno de entrega |
| 6 | Configurar el webhook autorizado | No detallado para producción | — | URL, prueba de TLS, secreto `prod_events_` y responsable |
| 7 | Verificar la salud del servicio | No hay endpoint ni criterio documentado | — | Lista de comprobaciones de solo lectura (`06-plan` §5) adaptada |
| 8 | Smoke test no financiero | Mencionado en el checklist | — | Guion: login por rol, contraentrega controlada, panel, alertas |
| 9 | Prueba productiva controlada | No definida | — | Autorización, importe mínimo, pedido identificado, devolución documentada |
| 10 | Conciliar esa transacción | Herramienta disponible (conciliar por ID) | LO | Ejecutarlo en producción y guardar evidencia |
| 11 | Comprobar pedido, inventario y alertas | — | — | Criterios de aceptación escritos |
| 12 | Abrir pagos al público tras la aceptación | **No hay un interruptor de Wompi independiente del despliegue.** Wompi se ofrece si `WOMPI_PRIVATE_KEY` y `WOMPI_EVENTS_SECRET` existen (`isWompiConfigured`). Habilitar la prueba controlada implica habilitarlo para todos | **Riesgo** | Procedimiento operativo: ventana sin tráfico, configurar llaves solo durante la prueba, o restricción temporal aprobada. **No exijo un cambio de código**, pero sí un procedimiento explícito |
| 13 | Monitorear fallos | Alertas del panel | Entrega real no probada | Responsable, frecuencia y canal |
| 14 | Reversión controlada | `06-plan` §6 "compatible con los datos nuevos"; el checklist prohíbe "revertir pagos con cambios manuales de estado" | Correcto en principio | Ver abajo |

## Reversión: requisitos que deben cumplirse

1. **Revertir solo la aplicación, nunca la base de datos.**
   - No se restaura un respaldo sobre datos con pagos posteriores.
   - Los documentos nuevos (`PaymentEvent`, `administrativeArchive`, `incidents.resolution`, `AuditLog`) son campos adicionales que una versión anterior ignora.
   - Hay que comprobar que la versión anterior no **falla** con ellos.
2. **Mantener V-01 contenido** aunque se revierta (`preproduccion/04`, "Reversión segura").
3. **Wompi seguirá enviando eventos** de los enlaces creados por la versión nueva.
   - Si se vuelve a una versión antigua, esos eventos pasan a ser tratados por la lógica vulnerable anterior: asociación débil (WP-06) y pérdida de no asociados (WP-01).
   - **Requisito:** antes de revertir, suspender la creación de enlaces nuevos (retirar las llaves Wompi o desactivar el método) y conciliar los pendientes con la herramienta de la versión nueva o de forma manual.
4. **No reescribir estados financieros a mano.** Los cobros recibidos durante la ventana se concilian con evidencia.

**Valoración:** los principios son correctos, pero **no existe un procedimiento ejecutable ni ensayado para esta versión**. El paso 1 (commit congelado) ni siquiera es posible hoy.
