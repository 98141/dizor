# Auditoría Wompi, pagos y pedidos — DIZOR (2026-11-23)

Auditoría independiente previa a producción. Solo documentación y pruebas aisladas: no se modificó código, configuración ni datos, ni se hicieron commits o despliegues.

| Documento | Contenido |
|---|---|
| [01_INFORME_EJECUTIVO.md](01_INFORME_EJECUTIVO.md) | Resumen, riesgos y conclusión |
| [02_ARQUITECTURA_Y_FLUJOS.md](02_ARQUITECTURA_Y_FLUJOS.md) | Componentes reales, diagrama Mermaid y ciclo del pedido |
| [03_MAQUINA_ESTADOS.md](03_MAQUINA_ESTADOS.md) | Estados, transiciones y mapeo Wompi |
| [04_SEGURIDAD_WOMPI.md](04_SEGURIDAD_WOMPI.md) | Firmas, llaves, asociación, monto y ataques |
| [05_MATRIZ_PRUEBAS.md](05_MATRIZ_PRUEBAS.md) | 56 filas, comandos, resultados |
| [06_HALLAZGOS_PRIORIZADOS.md](06_HALLAZGOS_PRIORIZADOS.md) | WP-01 a WP-15 |
| [07_CHECKLIST_PRODUCCION.md](07_CHECKLIST_PRODUCCION.md) | Lista verificable (repositorio vs externo) |
| [08_VEREDICTO_FINAL.md](08_VEREDICTO_FINAL.md) | **NO-GO** y bloqueos previos |

Evidencias en `evidencias/`: arnés `auditoria-wompi.cjs`, resultados JSON, salida de ejecución y resumen de la suite existente.
