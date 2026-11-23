# DIZOR — Informe final QA Fase 7

Fecha de referencia: **2026-11-21, Colombia**. Alcance: desarrollo y funcionamiento local del administrador. Responsable: implementación y QA asistido; **no constituye auditoría independiente final ni autorización de despliegue**.

## 1. Resumen ejecutivo

Se revisó la auditoría ADM-01–39, los cierres y revalidaciones independientes F1–F6 y la implementación actual. Se preparó el inventario antes de ejecutar las pruebas nuevas. Los resultados se conservan en `fase7-evidencias/`; los informes, pruebas y evidencias anteriores se preservan mediante un preload que redirige únicamente las nuevas escrituras de regresión.

Se confirmó y corrigió un defecto adicional: un rango financiero de un día podía empezar el día anterior porque `new Date('YYYY-MM-DD')` se interpretaba en UTC y después se modificaba con métodos de la zona del servidor. El reporte, historial y tendencia mensual usan ahora límites civiles de Colombia. Los timestamps con zona explícita siguen admitidos. No se modificó ningún pedido histórico, política comercial, esquema, índice ni dato real.

El cierre de esta ejecución se resume en la sección 26. Las validaciones reales de infraestructura, Wompi, Resend y recepción de correo siguen pendientes y separadas de la calidad funcional local.

## 2. Estado de las siete fases y fuentes

| Fase | Estado y evidencia de referencia |
|---|---|
| F1 | Integridad de pedidos, pagos e inventario; correcciones independientes de historia financiera y doble ajuste incorporadas; regresión original de 57 casos dentro de los 295 |
| F2 | Outbox y comunicaciones; regresión de 53 casos, 5 de compatibilidad y 9 independientes |
| F3 | Operación por bandejas y siguiente acción; 34 Node, 6 independientes y 20 navegador |
| F4 | Catálogo, variantes, inventario e historial; 42 Node, 6 independientes y 20 navegador |
| F5 | Navegación y configuración; 31 Node, correcciones 31, independientes 5, revalidación 2; navegador 35+10+25+18 |
| F6 | Pulido admin y accesibilidad; 3 Node y 3 independientes, navegador 59; F6-I01 y revalidación final con 33 casos adicionales de taxonomías |
| F7 | QA transversal, compras por UI real, concurrencia, fechas financieras, rendimiento local, manual y pendientes; resultados de esta carpeta |

Fuentes obligatorias: `informe-auditoria-admin-2026-11-20.md`; informes de implementación F1–F6; `cierre-fase1` a `cierre-fase6`; correcciones y revalidación final F5; `cierre-fase6/INFORME_CORRECCION_F6-I01.md` y `cierre-fase6/INFORME_REVALIDACION_FINAL.md`. La última revalidación independiente confirma F6-I01 y autoriza avanzar al QA local; mantiene los bloqueos externos. La lectura no se usa por sí sola como prueba de corrección.

## 3. Matriz ADM-01–39

Claves: **CV** = corregido y verificado localmente en regresión; **P** = parcial; **M** = observación menor; **I** = infraestructura pendiente; **E** = proveedor externo; **D** = decisión comercial. `N1/N2/N3/N4/N5/N5C/N6` corresponden a `backend/test/phase*.test.js`; `B` a la regresión navegador original; `T` a taxonomías; `Q` a `backend/test/phase7.test.js`; `UI7` al recorrido nuevo real. Evidencia ejecutada: `regresion-node.txt`, `regresion-navegador.json`, `nuevas-node-final.txt` e `integracion-compras.json`. Los residuales no se convierten automáticamente en defectos críticos.

| ID | Problema original | Prioridad | Fase | Estado | Prueba/evidencia | Riesgo residual y acción pendiente |
|---|---|---|---|---|---|---|
| ADM-01 | Despachar marcaba contraentrega pagada | P0 | F1/F3 | CV | N1 B1/P01–03; B pedidos; UI7 COD | Recaudo requiere evidencia humana; nunca inferirlo de entrega |
| ADM-02 | Transiciones arbitrarias | P0 | F1/F3 | CV | N1 B2/B5; N3; Q12 | Mantener reglas de servidor y verificar cambios de política |
| ADM-03 | Confirmación manual Wompi/vendedor | P0 | F1 | CV | N1 B3/B4; Q12; UI7 roles | Consulta real del proveedor pendiente E |
| ADM-04 | Reconfirmar cancelado descontaba stock | P0 | F1 | CV | N1 B4/B5/P05; Q11 | Pagos tardíos quedan en revisión, sin reapertura automática |
| ADM-05 | Aprobación tras rechazo/cancelación incoherente | P0 | F1 | CV | N1 C1/P05/P20; Q11 | No confundir un nuevo cobro con evento duplicado |
| ADM-06 | Cobros sin stock/monto inválido invisibles | P0 | F1/F2 | CV | N1 C2/P05/P18; N2; Q05 | Dinero en disputa requiere resolución D/E, no se cuenta como venta |
| ADM-07 | Metadatos sobrescribían stock | P0 | F1/F4 | CV | N1 E1; N4 V15; Q01/Q03 | Ajustar existencias mediante operación relativa |
| ADM-08 | Cliente cancelaba pagados/preparados sin aviso | P0 | F1/F2 | CV | N1 C4/P09; N2 cancelaciones | Reembolso no automático; tratamiento D |
| ADM-09 | Webhooks concurrentes sin protección | P1 | F1 | CV | N1 C3/P20/P35; Q03/Q05 | Firma y repetición reales del proveedor pendientes E |
| ADM-10 | Número count+1 colisionaba | P1 | F1 | CV | N1 A2/P17, concurrencia y fecha Colombia | No se alteran números históricos |
| ADM-11 | Faltaban correos de estados | P1 | F2 | CV/E | N2 N01–15; B comunicaciones; UI7 | Aceptación simulada no acredita buzón; validar recepción real |
| ADM-12 | devMode aparentaba envío | P1 | F2 | CV/E | N1 D2; N2 N33/N44/N53 | Validar remitente y dominio real antes de activar |
| ADM-13 | Envío síncrono sin recuperación | P1 | F2 | CV/E | N2 reintentos, leases y ventanas; Q19 | Worker real y monitorización requieren entorno autorizado |
| ADM-14 | Notas internas en DTO público | P1 | F1 | CV | N1 C5; regresión de compatibilidad F2 | Revisar todo campo nuevo antes de exponerlo |
| ADM-15 | Aviso administrativo Wompi prematuro | P1 | F2 | CV | N2 N02/N03; UI7 Wompi | No preparar por existencia del enlace |
| ADM-16 | COD ausente de preparar y pendiente mezclado | P1 | F3 | CV | N1 F1; N3 U01/U02; UI7 | Contadores corresponden a filtros activos |
| ADM-17 | Alerta Nequi inoperante | P1 | F3 | CV | N3 alertas y revisión; B pedidos | Nequi permanece desactivado; activación fuera de alcance |
| ADM-18 | Total de producto ocultaba variante agotada | P1 | F4/F6 | CV | N4 V05–08/V30; N6 stock ausente; Q08 | Datos inválidos históricos se clasifican revisión, pendiente I/D |
| ADM-19 | Cantidades fraccionarias | P1 | F1/F4 | CV/I | N1 E2; N4 V11; Q08 | No se sanea automáticamente stock histórico |
| ADM-20 | Cancelados inflaban ingresos | P1 | F1/F7 | CV | N1 P32 y finanzas; Q05/Q14/Q15/Q17/Q18 | Evidencia de cobros en disputa permanece; costos históricos incompletos requieren revisión |
| ADM-21 | Wompi sin vencimiento comprobado | P1 | F1/F3 | P/E/D | N1 P26; N2 enlaces válidos/vencidos; N3 U02 | Se conserva expiración informada; falta validación externa. No inventar TTL ni autocancelación |
| ADM-22 | Carrera de cupón dejaba pedidos huérfanos | P1 | F1 | CV/D | N1 P34/P35 | Liberación/reutilización tras cancelar requiere política comercial |
| ADM-23 | Costos internos para vendedor | P1 | F1/F4 | CV | N1 G1; N4 V28; Q12 | Finanzas sólo superadministrador; sin exportación restringida |
| ADM-24 | Tres tarjetas y acciones financieras confusas | P2 | F3 | CV | B pedidos; UI7 operaciones | La siguiente acción sigue al backend; no selector libre |
| ADM-25 | Sin bandejas/filtros y errores ocultos | P2 | F3 | CV | N3; Q12; B 20 pedidos | Diferenciar error, vacío y sin coincidencias |
| ADM-26 | Regex cruda causaba 500 | P2 | F3 | CV | N1 G2; N3; Q12 búsqueda `(` | Mantener búsqueda literal |
| ADM-27 | Guía editable en finales y sin aviso | P2 | F1/F2/F3 | CV | N1 B6; N2 corrección; B pedidos; UI7 | Corrección sólo en estado permitido; historia/revisión persistida |
| ADM-28 | Índices null y duplicados históricos | P2 | F1 | CV/I | N1 A1/P17 y auditoría de esquema | Esquema local probado; inspección/migración de índices reales pendiente. No ejecutada |
| ADM-29 | Navegación extensa y mezcla comercial/CMS | P2 | F5 | CV | N5; B navegación 35+10 | Menú y alias preservados por rol |
| ADM-30 | Envío inactivo editable y IDs crudos | P2 | F5 | CV | N5/revalidación; B configuración | No activar campos/proveedores sin nueva autorización |
| ADM-31 | Catálogo limitado a 100 y baja insegura | P2 | F4 | CV | N4 V01/V25–27; Q06 | Baja lógica conserva referencias; pendientes Wompi protegen disponibilidad |
| ADM-32 | Hoy UTC y updatedAt para despachos | P2 | F3/F7 | CV | N3 fechas Bogotá; Q15/Q17/Q18 | Rangos financieros corregidos también; timestamps explícitos admitidos |
| ADM-33 | Shell vendedor incorrecto y poderes financieros | P2 | F1/F5 | CV | N1 permisos; N5; B navegación; UI7 | Alias solicitudes conserva shell vendedor; backend mantiene 403 |
| ADM-34 | Trazabilidad incompleta de eventos automáticos | P2 | F1/F2 | P | N1 historia; N2 recuperación; Q11/Q19 | Hechos nuevos trazados; no reconstruir autor/evidencia de históricos incompletos. AuditLog y statusHistory tienen alcances distintos |
| ADM-35 | Email/teléfono/departamento sin validar | P2 | F1 | CV | N1 validación checkout; compra UI7 | Validación no acredita identidad ni entregabilidad real del correo |
| ADM-36 | HTML de correo sin escape | P3 | F2 | CV | N2 plantillas y compatibilidad; Q13 todos los eventos | Revisar plantillas nuevas; correo cliente real pendiente E |
| ADM-37 | Asignación a personal no autorizado | P3 | F1 | CV/M | N1 G3; validación backend | No se agregó una nueva interfaz de asignación |
| ADM-38 | Métodos/etiquetas históricas y opciones obsoletas | P3 | F3/F5 | P/M/D | N3 compatibilidad; N5 navegación | Históricos conservados; no habilitar POS/manual/Nequi ni redefinir políticas |
| ADM-39 | Estilo inconsistente, alertas y foco deficientes | P3 | F6 | P/M | B 59 pulido, axe y teclado; T33 | Lint previo, nombres repetidos y revisión humana residual. No certificación WCAG |

## 4. Hallazgos posteriores de auditoría

| Hallazgo | Estado local/evidencia | Residual |
|---|---|---|
| F1 historia financiera incluía cancelaciones/incidencias | Criterio central conservado; Q05/Q14 y regresión original | F7 agrega corrección de límites civiles; no sanea datos |
| F1 doble ajuste por claves distintas antes de render | Ref inmediato, clave estable y ledger conservados; 4 pruebas de stock UI, N4 V12, Q09/Q10 | Reintentar operación pendiente con su clave |
| F5 configuración de envío, ámbito exportación y shell vendedor | Regresión N5 y navegación/revalidación sin cambios | Exportación general no se presenta como exportación filtrada por bandeja |
| F5A01 carga incompleta, tardía y PATCH ambiguo | N5C 31, navegador25, revalidación18; fallo nunca significa vacío editable | No se añadió CAS global entre sesiones |
| F6 dashboard convertía stock ausente en cero | N6 y Q08; lectura lean y revisión sin escritura | Datos históricos pendientes de saneamiento autorizado |
| F6-I01 botones de taxonomía recortados | T33, 110 mediciones en 22 anchos, prueba mutante y regresión | Etiquetas accesibles de fila repetidas siguen como observación menor |
| F7-01 fechas financieras desplazadas y dependientes del host | Corregido en tres archivos; Q15/Q17/Q18 | No cambia criterio contable ni fecha histórica del pedido |

## 5. Regresión existente

Conjunto único esperado: **295 Node +195 navegador +33 taxonomías**. No se modificaron los archivos ni aserciones originales. `regresion-node.cjs` enumera los 16 archivos Node; `regresion-navegador.cjs` enumera las nueve suites de navegador. Las repeticiones de una suite no se suman como casos nuevos.

La ejecución inicial Node pasó 295/295 y la inicial navegador 195/195 +33/33. La revalidación después de la primera corrección detectó cuatro fallos por rechazar timestamps explícitos; se corrigió el contrato del parser, sin cambiar pruebas, y se repitió el conjunto completo. **La ejecución final pasó295/295 Node,195/195 navegador y33/33 taxonomías**, con código0 en todos los runners. Se conservan las salidas intermedias para permitir revisar el proceso.

## 6. Pruebas nuevas y cobertura transversal

`backend/test/phase7.test.js` agrega **19 casos** de invariantes, no copias de implementación. El recorrido de navegador usa `phase7-next-browser.cjs`, `phase7BrowserFlow.cjs` y `phase7LastUnitFlow.cjs`. Los resultados de una preparación fallida de selectores no se cuentan como pruebas aprobadas; los intentos y sus causas se conservan.

| Área requerida | Cobertura ejecutable |
|---|---|
| 1 Compra COD completa | UI7 producto→carrito→checkout→confirmación→admin→entrega→recaudo |
| 2 Compra Wompi completa | UI7 navegación a proveedor simulado, webhook firmado y operación admin |
| 3 Rechazo Wompi | UI7 y N2: sin cancelación arbitraria, sin preparación y sin descuento |
| 4 Dos clientes/última unidad | UI7 dos contextos independientes; Q04/Q05 |
| 5 Checkout respuesta perdida | UI7 respuesta abortada después del commit; misma clave, un pedido |
| 6 Login y vendedor integral | UI7 login real, panel, pedidos y solicitudes; Q12 y N5 |
| 7 Siete bandejas | Q12 API real; N3 y B pedidos con URL, filtros y contadores |
| 8 Paginación y retorno | N3 y B pedidos/catálogo/navegación |
| 9 Error frente a vacío | B pedidos, F5A01 y B pulido |
| 10 Ventas frente a dinero recibido | Q05/Q11/Q14/Q18; N1 P32 |
| 11 Exportaciones | Q14/Q18, N1 finanzas y B navegación/configuración |
| 12 Stock frente a edición | Q01 y N4 V15 |
| 13 Venta frente a ajuste | Q01/Q03 |
| 14 Dos administradores | Q02 y N4 V14 |
| 15 Cancelación/restauración | Q02/Q06/Q11 |
| 16 Webhook frente a ajuste | Q03 |
| 17 SKU simultáneo | Q07 y N4 V21 |
| 18 Baja/variante inactiva | Q06 y N4 V25–27 |
| 19 Producto con Wompi pendiente | Q06 |
| 20 Stock ausente/fraccionario | Q08 y N6 |
| 21 Ajuste de resultado desconocido | Q09, UI stock original y N4 recuperación |
| 22 Intención rechazada tardía | Q10 y N4 tombstone |
| 23 Eventos transaccionales completos | N2 53, compatibilidad5, independientes9; UI7 |
| 24 Worker interrumpido/claims | Q19 y N2 leases/ventanas/aceptación ambigua |
| 25 Reintento/reenvío autorizado | N2 y navegador comunicaciones8 |
| 26 No escribir otras áreas | Q14/Q18/Q19; N5C y revalidación independiente |
| 27 Editorial→Marketing→fallo→recuperación | B navegación, configuración25 y revalidación18 con backend real |
| 28 Taxonomía CRUD/recorte | T33, cinco taxonomías, límites y mutante |
| 29 Responsive/accesibilidad | B pulido59 y T33; imágenes y AX/axe guardados |
| 30 Volumen y planes | Q16: datos ficticios, tiempos HTTP y explain; sin índices nuevos |

## 7. Recorridos end-to-end

El harness nuevo compila una copia aislada de **Next real**, arranca **Express real**, usa **MongoDB Memory Replica Set** y un perfil desechable de Chrome. Cliente, administrador, vendedor y superadministrador se autentican mediante el formulario real; no se inyectan cookies para reemplazar esos recorridos. APIs de fixture preparan datos y comprueban invariantes; no sustituyen los clics esenciales. La red externa se bloquea, Wompi se responde localmente y el transporte de correo es ficticio.

COD comprueba doble clic en la misma tarea JavaScript, pérdida de respuesta después de registrar el pedido, reintento con la misma clave, un pedido y stock descontado una vez. Preparación, despacho con guía, corrección, entrega y recaudo se realizan por UI. La entrega mantiene pago pendiente hasta registrar evidencia de recaudo.

Wompi comprueba stock intacto al crear el enlace, aprobación firmada repetida simultáneamente, un descuento y una notificación de aprobación. El intento rechazado conserva stock y bloquea preparación/despacho. La competencia por última unidad se ejecuta desde dos contextos de navegador independientes. Las evidencias finales del recorrido están en `integracion-compras.json`, `next-navegador.json`, capturas y log HTTP, con los límites y resultado efectivo de sección26.

## 8. Pedidos

El backend conserva autoridad sobre transiciones y siguiente acción. Se verifican finales, guía, cancelación, notas internas, pago pendiente, revisiones y permisos. La regresión de navegador conserva filtros en URL, retorno exacto, búsqueda literal, contadores, paginación de servidor, carga fallida y recuperación; una lista fallida no se anuncia como vacía. Repetir el mismo estado no crea otra transición y la UI muestra la respuesta explícita del servidor.

## 9. Finanzas

`reconciledSalesFilter` se mantiene centralizado: exige pago registrado y excluye cancelado/rechazado/devuelto, reembolso, bandera de revisión e incidencias activas incluso con bandera desactualizada. Un cobro en disputa no desaparece del pedido. Q14 prueba reportes, historia y exportaciones sin escribir documentos históricos.

F7-01 corrige exclusivamente rangos y agrupación: día20 = `2026-11-20T05:00:00Z` hasta `2026-11-21T04:59:59.999Z`. Q18 coloca pedidos a ambos lados de esos límites y compara reporte/gráfica/CSV. Q17 prueba tres zonas del proceso, frontera de año, semana ISO, rangos inválidos y timestamps explícitos. La tendencia mensual usa el mismo cálculo colombiano. Se conserva `createdAt` como base contable existente; no se cambió a fecha de recaudo ni se reescribieron costos históricos.

## 10. Inventario

Q01–10 prueban carreras y recuperación. El stock resulta de movimientos relativos transaccionales, no de guardar una ficha obsoleta. Misma clave corresponde a una operación y un movimiento; dos administradores con claves diferentes conservan ambas variaciones. Una intención rechazada no revive cuando llega stock nuevo. La baja conserva IDs históricos y Wompi pendiente protege producto/variante.

Stock ausente o fraccionario se presenta como revisión y no se normaliza por lectura, venta o ajuste ordinario. SKU tiene protección del servicio bajo concurrencia comprobada; no equivale a un índice global histórico ya migrado. La vista de historial, alertas y catálogo se revalida en N4, B catálogo y B pulido.

## 11. Notificaciones

La matriz de eventos incluye recepción, aprobación, rechazo, revisión financiera, listo para preparar, incidencia administrativa, despacho, corrección de guía, entrega y cancelación administrativa/cliente. N2 verifica reintentos temporales acotados, rechazo permanente, fallos de persistencia, procesamiento simultáneo, ventana de idempotencia, destinatario cambiado, aceptación ambigua y reenvío explícito autorizado. Q19 simula un worker interrumpido mediante lease vencido después de aceptación y recupera la misma clave/cuerpo, sin duplicar inbox ni modificar pedido/inventario.

Q13 recorre todas las plantillas: HTML escapado y texto con saltos reales `\n\n`; la observación de saltos literales no se reproduce en el código actual. No se necesita un cambio de plantilla. No se activa Resend ni se envía correo real. `sent`/identificador de proveedor ficticio acredita aceptación simulada, jamás llegada real ni ausencia de rebote.

## 12. Roles y permisos

Vendedor: menú, panel y pedidos permitidos; ruta histórica de solicitudes conserva shell. Escrituras de inventario, historial restringido, costos, recaudo, conciliación y exportación financiera se comprueban en backend (403), además de la ausencia de controles en UI. Cliente y anónimo no acceden al catálogo administrativo. Finanzas está restringido al superadministrador; administrador opera pedidos sin convertirse en autorizador manual de Wompi. UI7 añade autenticación real por formulario a las comprobaciones anteriores con cookies de fixture.

## 13. Navegación y configuración

Los grupos F5, alias, breadcrumbs y contexto de retorno se conservan. Exportación general conserva su ámbito comunicado. F5A01 sigue distinguiendo `loading`, carga fallida, listo, guardando, error explícito, verificando y resultado incierto. Respuestas completas válidas habilitan edición; respuestas parciales, fuera de orden o ambiguas nunca habilitan un guardado destructivo ni un reenvío automático. Se reejecutan las pruebas de componente, navegador real y revalidación independiente de este comportamiento.

## 14. UX y consistencia

Se conserva el diseño del administrador y la separación de tareas. B pulido cubre formularios, avisos persistentes, confirmaciones, acciones destructivas y estados de carga/error/éxito. No se reestructura menú ni se rediseña tienda. La observación de alineación PQR móvil se revisa mediante capturas F6 y su flujo de error/reintento/estado; se mantiene como mejora visual menor, sin evidencia de pérdida funcional. Los estados de alerta se verifican en la regresión; no se modifica el sistema de alertas por una observación estética aislada.

## 15. Accesibilidad

Se usa WCAG 2.2 AA como referencia. B pulido guarda axe, contraste y árbol AX; comprueba campos asociados, nombres de botones, estados alert/status, foco visible, modal con Escape y retorno, menú móvil y teclado. F6-I01 conserva controles visibles e interactuables, no sólo ausencia de overflow del documento. Los botones repetidos Editar/Eliminar de taxonomía conservan nombre accesible genérico: mejora contextual pendiente de baja prioridad.

La automatización no certifica WCAG. Sigue pendiente una evaluación humana con lector de pantalla, combinaciones reales de navegador/tecnología asistiva y contraste sobre todos los contenidos editoriales posibles. Reduced motion y reflow/zoom se evalúan dentro del alcance de las pruebas existentes; no equivalen a probar toda configuración del sistema operativo.

## 16. Responsive

B pulido reproduce **1440,1024,820,390,360 px**, con tablas pobladas y controles de administración: 33 pantallas ×5 anchos =165 mediciones. T33 añade cinco taxonomías ×22 anchos =110 mediciones: 360,390,699/700/701,820,899/900/901,1024,1099/1100/1101,1199/1200/1201,1279/1280/1281 y1439/1440/1441.

La visibilidad se contrasta con ancestros que recortan, texto, hitpoints y controles, sin desplazamiento horizontal que oculte el fallo. El mutante reproduce el recorte aunque el documento no tenga overflow. UI7 añade finanzas después de compras reales en cinco anchos y un pedido sintético adicional de$999.999.999.999 para probar cifras extremas. Ese fixture nuevo se identifica por separado y no representa una compra real ni modifica pedidos previos. Se inspeccionaron visualmente la captura de finanzas360, PQR360 y taxonomía1024: las cifras se leen y los controles permanecen accesibles; PQR conserva la diferencia menor de alineación de Estado. Las capturas complementan las aserciones geométricas; revisar contenido nuevo sigue siendo necesario.

## 17. Rendimiento local y consultas

Q16 genera **1201 pedidos y121 productos**, de los cuales120 tienen12 variantes cada uno, en MongoDB efímero. `rendimiento-local.json` contiene tiempos por ruta, índices existentes y explain. Se confirma **COLLSCAN** en la consulta de pedidos, con1201 documentos examinados para15 resultados. También se captura con Mongoose debug la agregación real del catálogo durante la llamada HTTP y se ejecuta su explain en la misma base ficticia; el plan queda en `catalogExplain`. El dashboard consulta varias áreas. No se alteran planes ni índices para mejorar la muestra.

Son muestras locales concurrentes con otras pruebas, sin calentamiento estadístico ni SLO. No predicen producción. La evaluación de índices, cardinalidad, paginación y límites de agregación es un pendiente de rendimiento/infraestructura; no se crean índices para maquillar la medición. Las latencias exactas de la última ejecución se consultan en el JSON, sin fijarlas como promesa operativa.

## 18. Defectos corregidos en Fase 7

**F7-01, prioridad P2: desplazamiento de fechas financieras y dependencia de zona del host.** Reproducción previa Q15: solicitar20/11 devolvía inicio `2026-11-19T05:00:00.000Z`. Causa: interpretar fecha civil como UTC y después usar `setHours` local. Había lógica duplicada en reporte, gráfica y tendencia.

Archivos de aplicación modificados: `backend/src/utils/financePeriod.js`, `backend/src/controllers/financeAdminController.js`, `backend/src/services/financeService.js`. Solución: cálculo compartido de límites colombianos, agrupación por día/semana/mes/año e ISO week independiente del host, validación de rangos y preservación de timestamps explícitos. Riesgo: consultas que dependían del desplazamiento anterior cambian de resultados; ese cambio corrige el día solicitado, sin alterar datos. No se añaden migraciones ni dependencias.

El primer intento produjo una regresión de compatibilidad al rechazar timestamps. Las cuatro pruebas originales que lo detectaron se conservaron sin cambios; se admitieron de nuevo offsets explícitos y se ejecutó la regresión completa. Se guardan fuente previa y logs antes/intermedios/finales. Los ajustes de selectores, consentimiento y popup ficticio pertenecen al harness nuevo; no son defectos del producto ni cambios de tienda.

## 19. Pendientes funcionales, históricos y decisiones

| Pendiente | Clasificación/impacto | Acción |
|---|---|---|
| Índice real de idempotencia y duplicados de esquema SpecialRequest | I, riesgo relevante al migrar; no prueba de sobreventa local | Inventario/backup/plan de migración autorizado |
| SKU sin índice global; posibles duplicados históricos ajenos al servicio | I, escritura local concurrente protegida | Revisar datos y política de índice; no crearlo aquí |
| Stock antiguo inválido y pedidos sin evidencia de recaudo/entrega | I/D, revisión operativa; no declarar saldo conocido | Conciliación histórica con trazabilidad |
| Consumo de cupón después de cancelación | D, posible impacto comercial | Acordar política antes de liberar/reusar cupos |
| Checkout fallido o resultado incierto no recuperable automáticamente | D/operación, requiere revisión | Mantener guardas y evidencia; definir recuperación autorizada |
| Incidencias financieras sin resolución automática | D/E, no preparar ni reconocer como venta | Responsable administrativo y evidencia del proveedor |
| Reembolsos no automáticos | D/E, comportamiento deliberado | No prometer devolución desde cancelación |
| Expiración real de Wompi y recepción de correo | E | Validación externa controlada posterior |
| COLLSCAN, agregación catálogo y consultas de dashboard | Rendimiento/I | Medir volumen real autorizado y diseñar índices fuera de este QA |
| Lint, nombres accesibles genéricos y PQR móvil | M/deuda técnica | Trabajo acotado futuro; sin refactorización general |

Los pendientes anteriores no se convierten en defectos funcionales P0 por ausencia de producción. Tampoco se ocultan como si estuvieran resueltos. El resultado de cualquier flujo nuevo que no complete sus aserciones debe reflejarse en sección26.

## 20. Sintaxis y lint

### Sintaxis

`verificar-estatico.cjs` ejecuta `node --check` sobre los tres archivos backend modificados y todos los scripts nuevos; ESLint focalizado de CommonJS con reglas de variables no usadas, código inalcanzable y claves duplicadas. Compara además, con ESLint real de Next desde su cwd correcto, las mismas23 rutas del alcance F6 con el baseline anterior: **7 errores y3 advertencias preexistentes**, sin supresiones ni refactorización ajena al defecto.

### Lint

Errores previos: set-state-in-effect en alertas, finanzas, AuditLogList, FinanceDashboard, HomeImagesTab y ReviewsTab. Advertencias: dependencias de efecto en AuditLogList e imágenes en HomeImagesTab/OrderDetail. No se declara limpio el lint de todo el repositorio. Los resultados nuevos y su comparación están en `estatico.json` y `lint-node.json`; `git diff --check` se ejecuta también. Los logs de runtime ignorados por Git se separan de los archivos protegidos de aplicación/evidencia.

El alcance backend modificado contiene además **1 diagnóstico previo** `no-unused-vars` (`productId` en `financeService.js`). Se comparó con el contenido anterior guardado: no lo introduce F7. Los archivos nuevos no agregan errores; no se elimina esa variable ni se suprime la regla para presentar un lint global limpio.

## 21. Build y aislamiento

Next16.2.6 compila con `next build --webpack` en carpeta temporal propia, sin `.env*`, `.next` previo ni credenciales heredadas. Dependencias se enlazan al node_modules ya instalado y no se instalan paquetes. El preload bloquea fetch/TCP externos en build y sólo permite loopback durante runtime. Chrome usa perfil temporal y bloquea solicitudes externas; el documento simulado de Wompi no es una conexión al proveedor.

`build-fase7.txt/json` registra el resultado del build. Cada harness original también compila o empaqueta de forma aislada según su diseño. Se detienen sus procesos propios y se valida el destino temporal antes de borrar; no se toca producción ni se despliega ningún artefacto.

## 22. Compatibilidad y preservación

Se preservan contratos de pagos, statusHistory, DTO públicos, navegación, roles, alias y las pruebas anteriores. Fechas civiles y timestamps con zona tienen semántica explícita. No se reescriben datos históricos para conseguir resultados. Q14/Q18 comprueban igualdad de documentos antes/después de lecturas/exportaciones; Q19 comprueba ausencia de escritura de pedido/producto/movimientos en recuperación de aviso administrativo.

`baseline-sha256.json` y la verificación estática comparan los archivos preexistentes. Sólo se permiten los tres cambios de aplicación descritos; los logs de runtime se registran aparte. No hay commits, pushes, migraciones, cambios de índices ni activaciones. Los tres documentos de entrega y los scripts/evidencias F7 son nuevos.

## 23. Pendientes externos separados

Desarrollo local verificable: reglas de servidor, idempotencia, concurrencia transaccional en réplica temporal, permisos, rutas UI, estados, exportación, outbox y fechas financieras.

Pendiente externo: infraestructura destino y backup/restore; índices reales y migración; credenciales y webhooks públicos de Wompi; dominio/remitente/recepción/rebotes de Resend; operación de workers y observabilidad en entorno autorizado. Las restricciones del usuario impiden ejecutar esas tareas dentro de Fase7. No son una excusa para omitir pruebas locales y no se presentan como realizadas.

## 24. Manual operativo

Entregado `MANUAL_ADMINISTRADOR_DIZOR.md`, con16 apartados basados en controles existentes: acceso, nuevos pedidos, preparación, despacho/corrección, entrega, recaudo, Wompi, incidencias, comunicaciones, productos, ajustes, historial, tienda/marketing, solicitudes/PQR, vendedor/finanzas y errores/resultados desconocidos. No incluye aprobación manual de Wompi, reembolso automático ni activaciones inexistentes.

## 25. Checklist de despliegue pendiente

Entregado `CHECKLIST_DESPLIEGUE_PENDIENTE.md`. Todas las casillas siguen pendientes. Incluye autorización, auditoría independiente, respaldo/restauración, replica set/mongos, índices/históricos, Wompi, Resend, variables, build destino, smoke, monitorización y rollback. El documento es preparación revisable y no una orden para desplegar.

## 26. Veredicto final y recomendaciones

**READY WITH ISSUES.** Las funciones principales y los recorridos integrados locales quedaron verificados. No quedan defectos P0/P1 reproducidos y sin resolver en los escenarios ejecutados. Existen observaciones menores y verificaciones humanas/de rendimiento pendientes, clasificadas en secciones15,17,19 y20; por ello no se presenta un cierre sin observaciones.

| Verificación final | Resultado | Evidencia |
|---|---|---|
| Node original |295/295,0 fallos, código0 |`regresion-node.txt/json` |
| Navegador original |195/195, ocho suites con código0 |`regresion-navegador.json` |
| F6-I01 |33/33, suite con código0;110 medidas |`regresion-taxonomia.txt` y evidencia anidada |
| Node nuevo |19/19,0 fallos, código0 |`nuevas-node-final.txt` |
| Compra UI real y roles |Completo, código0; COD, Wompi aprobado/rechazado, última unidad en dos contextos, pérdida de respuesta, vendedor y finanzas |`integracion-compras.json`, `next-navegador.json`, log y capturas |
| Notificaciones del recorrido |13 aceptaciones en inbox ficticio por clave, sin acreditar buzón real |`simulatedInbox` en resultado UI |
| Build aislado |Next webpack, código0 |`build-fase7.json/txt` |
| Sintaxis/diff |Sin errores nuevos; `git diff --check` código0 |`estatico.json` |
| Lint |0 diagnósticos nuevos;7 errores/3 advertencias frontend previos y1 error backend previo |`estatico.json`, `lint-node.json` |
| Preservación |5821 archivos comparados; sólo tres archivos financieros de fuente cambiados; logs de runtime separados |`baseline-sha256.json`, `estatico.json` |

**Desarrollo local:** listo para revisión independiente con incidencias menores documentadas. **Auditoría independiente final:** pendiente de Cursor; este informe no la sustituye ni declara Fase7 definitivamente cerrada. **Despliegue:** no autorizado ni ejecutado, checklist íntegramente pendiente. **Validaciones externas:** MongoDB destino/índices, Wompi y Resend/buzones pendientes de entorno y autorización propios.

Se recomienda que Cursor repita los comandos de `fase7-evidencias/README.md`, revise especialmente la corrección F7-01 y sus límites civiles/timestamps, confirme F5A01/F6-I01 y clasifique las observaciones menores. La fuente de aplicación modificada queda limitada a los tres archivos financieros. No hubo cambios de tienda pública, dependencias nuevas, `.env`, datos reales, índices reales, migraciones, pagos/correos reales, commits, pushes ni despliegues.
