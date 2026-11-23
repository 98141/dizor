# Pruebas ejecutadas y alcance

## Sandbox real

| Ensayo | ¿Ejecutado? | Resultado / evidencia |
|---|---|---|
| Pedido actual + creación de link | Sí, en Mongo efímero | Checkout HTTP 502; resultado externo de creación no determinado; no retry con segundo pedido. sandbox-real.json |
| Lectura Link test preexistente | Sí | HTTP 200; ambiente test; active=true; expiresAt=null. sandbox-preflight.json |
| Tarjeta de prueba aprobada en ese Link | **Sí** | APPROVED, COP 150.000, sin dinero real. sandbox-aprobado.png |
| Consulta privada del ID observado | **Sí** | HTTP 200; payment_link_id presente y coincide con el Link. sandbox-transaccion-real.json |
| Retorno del comprador | **Sí** | id y env=test añadidos al retorno. browser-sandbox-observaciones.json |
| Expiración solicitada 24h | **Sí**, ensayo de Link independiente, sin pago | HTTP 201; fecha UTC devuelta igual a la solicitada. sandbox-expiracion-real.json |
| Firma/webhook auténtico, persistencia, stock del pago real, outbox/entrega, preparación | **No** | BLOCKED: receptor HTTPS Sandbox no disponible/configurado; el Link pagado era un piloto previo sin pedido actual en nuestro arnés |
| Tarjeta rechazada, PSE, Nequi dentro de Wompi, PENDING | **No** | Pendiente en entorno completo autorizado; no sustituido por mocks |
| Reintento/reutilización/orden de eventos real | **No** | single_use=true y active=true después de APPROVED no prueban reutilización |
| Vencimiento efectivo, PENDING y pago tardío real | **No** | Fecha programada 24/11/2026 16:44 Bogotá; falta ensayo completo |

Datos ficticios y tarjeta oficial Sandbox; se autorizó el consentimiento específico de esa prueba. No hubo cobro, reembolso, pedido ni cambio de configuración productivos.

## Regresión local ejecutada en esta fase

| Conjunto | Referencia independiente anterior | Ejecución de esta fase |
|---|---|---|
| F original, intacto | 27/28 | 27/28; F32 todavía no llama la conclusión nueva |
| F con conclusión explícita en F32 | No existía | **28/28**; mismo archivo/aserciones, variante aparte |
| C original | 35/35 | **35/35** |
| D original | 26/28 | **26/28**, D04b/D19b por diseño explícito |
| D con archivo explícito previo | 28/28 | **28/28** |
| Residuales Z | 12/12 | **12/12** |
| R / limitadores / N / v2 | 27/27 · 2/2 · 18/18 · 2/2 | **27/27 · 2/2 · 18/18 · 2/2** |
| Histórica, nueve archivos | 273/275 | **273/275**, mismos P06/P23 FAIL |
| Matriz original | 44 PASS / 5 FAIL / 1 N/A | **44/5/1**, P13/P20/P22b/P28/**X07** FAIL |
| RC-01 específicas, núcleo inicial | No existían | Antes **0/9**, después **9/9** |
| RC-01 ampliadas | Dos pruebas añadidas después | **11/11**, incluye carrera VOIDED y superadmin |
| Frontend actual | No es aprobación de despliegue | **Build aislado aprobado; ESLint de las dos fuentes modificadas: 0 errores antes/después** |
| Checkout/catálogo backend actuales | Revalidación de esta fase | **14/14** |
| Municipios/campos frontend actuales | Revalidación de esta fase | **6/6** |

Los valores de referencia son de la auditoría anterior, no ejecuciones “antes” inventadas en esta fase. Sí se reprodujeron F32 y las nueve pruebas RC antes de modificar fuentes. Los logs `antes-F.txt`, `antes-RC.txt`, `final-*.txt`, `final-ampliada-RC.txt` y `frontend-*.json/txt` contienen las mediciones de esta sesión. No sumar suites solapadas.

### Variantes y aserciones preservadas

F32 original supone bajar el contador con solo archivar; la solución elegida exige la segunda decisión motivada. **Original sigue FAIL**, igual que D04b/D19b no llaman archivo. `f-con-conclusion.test.cjs` añade exclusivamente esa decisión en F32 y una aserción de éxito; no cambia ninguna aserción original ni el archivo F. Su origen e inserción están en `f-variante-origen.json`. F31/F25 originales pasan: el riesgo abierto sigue contado y archivar no cambia dinero ni pedido.

### Interfaz y checkout

Se revisaron las auditorías de checkout, catálogo, rediseño y corrección posterior de WhatsApp; el reporte posterior documenta 404 no reproducido y su causa histórica pendiente. Se preserva ese matiz. El HEAD 23ce3a6 no contiene todo el árbol que se pretende evaluar: hay cambios previos sin commit de checkout/municipios y de pagos.

El build de esta fase contiene el frontend actual completo, sin .env ni red. Se ejecutaron por separado pruebas de checkout/catálogo backend y campos/municipios frontend (`checkout-backend.txt`, `checkout-frontend.txt`). Los hashes preservan el trabajo paralelo. Esto no sustituye la comprobación de la instancia exacta que produjo el 404.

**No se ejecutó en navegador el control nuevo de conclusión del panel.** Se verificó por API real, permisos, auditoría, concurrencia, rollback, lint y compilación. El navegador de esta fase se usó para Wompi Sandbox y retorno; no se presenta como E2E del panel nuevo.

## Reproducción local

Desde raíz real, sin servidor del proyecto:

```powershell
node docs/auditoria-wompi-pedidos/preproduccion/evidencias/ejecutar.cjs repeticion RC F FA C D DA Z R L N V H M
node docs/auditoria-wompi-pedidos/preproduccion/evidencias/frontend-check.cjs
```

El ejecutor fija MongoMemoryServer existente y binario Mongo local; los fixtures bloquean red externa y generan llaves ficticias. `preload.cjs` desvía escrituras de resultados hacia esta carpeta, sin transformar fuentes de aplicación ni aserciones. Las variantes de flujo viven aparte.

Las herramientas reales `sandbox-preflight.cjs` y `sandbox-transaction.cjs <ID observado>` solo hacen GET Sandbox. `sandbox-expiry.cjs --authorized-sandbox` **crea un nuevo Link**: no ejecutarlo como verificación de solo lectura ni como retry del pedido anterior. Los scripts no usan MONGO_URI del proyecto. `sandbox-session.cjs` inicia un ensayo con réplica efímera y crea un pedido/link; requiere una nueva intervención controlada para investigar el intento fallido, no repetirlo ciegamente.
