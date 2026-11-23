# Inventario inicial de Fase 7

Fecha: 2026-11-21. Referencia: auditoría original ADM-01–39, informes de implementación y cierres independientes F1–F6. Repositorio limpio al inicio. Esta clasificación orienta las pruebas; no equivale a cierre por lectura de código.

| Riesgo | Fase responsable | Verificación prevista |
|---|---|---|
| ADM-01–10,14,19,20,22,23,28,33,35,37: integridad financiera, transiciones, concurrencia, permisos, datos de entrada | F1 y correcciones | Regresión Node original e independiente, compra real COD/Wompi, finanzas y carreras |
| ADM-11–13,15,27,34,36: comunicaciones y trazabilidad | F2 | Outbox, reclamos atómicos, reintentos, fallos, mensajes y eventos integrados; transporte ficticio |
| ADM-16,17,24–26,32,38: operación de pedidos | F3 | Bandejas, búsqueda literal, URL, paginación, estados finales, fechas Bogotá y permisos |
| ADM-07,18,19,23,31: inventario | F4 | Metadatos versus venta, ajustes, bajas, SKU, stock histórico inválido, catálogo |
| ADM-29,30,33: navegación y configuración | F5 | Menús por rol, alias, configuración completa, fallos y respuestas ambiguas |
| ADM-39 y observaciones visuales | F6 | 195 casos navegador originales, taxonomías 33 y límites responsive, accesibilidad automatizada y teclado |
| Históricos/infraestructura | F1/F4/externo | Explicar sin migrar: índices reales, SpecialRequest, SKU global e inventario inválido |
| ADM-21 y cobros externos | Proveedor/decisión | No inventar vencimientos, devolución automática ni políticas de cupón; documentar pendientes |

Hallazgos posteriores explícitos: historia financiera y doble ajuste F1; omisiones de envío en configuración, exportación y shell vendedor F5; F5A01 carga incompleta/respuesta tardía/guardado ambiguo; F6-I01 recorte de acciones en taxonomías; stock ausente convertido en cero en dashboard F6. Todos requieren evidencia ejecutada existente y regresión nueva. Observaciones menores: nombres accesibles repetidos, PQR móvil, saltos de línea en correo, lint previo (7 errores, 3 advertencias en alcance F6).
