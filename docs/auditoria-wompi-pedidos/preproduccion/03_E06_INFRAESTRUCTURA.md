# E06 · configuración e infraestructura

**Producción: BLOCKED. Sandbox: verificación parcial. Local: pruebas ejecutadas.** No se accedió a Atlas ni se cambió hosting.

| Comprobación | Estado / evidencia |
|---|---|
| Ambiente de las llamadas reales | VALIDADO EN SANDBOX: host sandbox.wompi.co, llaves test, checkout MODO DE PRUEBAS |
| Prefijos localmente disponibles | VALIDADO SOLO EN LOCAL: private/event test; llave pública inferida del Link y clasificada test, sin mostrarla |
| Secretos separados correctamente en hosting | BLOCKED: falta inventario autorizado del destino |
| `.env` de proyecto | Leído mediante parser solo para seleccionar llaves test; nunca se hizo Object.assign de todo el archivo ni se usó su MONGO_URI |
| URL webhook HTTPS de pruebas | BLOCKED: no encontrada/configurada |
| HTTPS del checkout/API Wompi | VALIDADO EN SANDBOX por conexiones HTTPS exitosas, sin omitir validación TLS |
| TLS/certificado de nuestra API de destino | BLOCKED: destino de pruebas no identificado |
| CORS / CLIENT_URL | DOCUMENTADO en código; `CLIENT_URL` no identificado en configuración local; frontend apunta localhost. No se valida CORS productivo |
| Proxy | DOCUMENTADO: app.js usa trust proxy=1 con NODE_ENV=production; topología/IP real destino no verificada |
| Mongo replica set | VALIDADO SOLO EN LOCAL: Mongo 8.3.2 efímero loopback, primary escribible |
| Índices únicos | VALIDADO SOLO EN LOCAL: Order.orderNumber, idempotencyKey parcial, PaymentEvent.key, Notification.eventKey |
| Índices reales/duplicados del destino | BLOCKED: no acceso a la base real autorizado en esta fase |
| Backups / restauración | BLOCKED: no se recibió ni ejecutó ensayo de restauración |
| Logs / alertas | VALIDADO SOLO EN LOCAL: auditoría, bandejas, outbox; entrega real/retención/alertado operativo no acreditados |
| Responsables/accesos | DOCUMENTADO por rol; personas, permisos, guardia y ventana por designar |

`evidencias/infra-local.json` registra hello e índices de una réplica recién creada y destruida. **No acredita los índices ni los backups de producción**. No se ejecutaron migraciones ni creación de índices contra una base existente.

## Arranque y aislamiento del entorno de pruebas

`server.js` y `wompiService.validateConfiguration` rechazan NODE_ENV=production con WOMPI_ENV=sandbox. Esta protección sigue intacta. El arnés usa app.js dentro de un proceso de pruebas, con Mongo local y claves test seleccionadas. No publica el servidor completo ni debilita el guardarraíl productivo.

Antes de disponer de HTTPS Sandbox debe acordarse un receptor aislado o un despliegue de staging con garantías equivalentes de TLS, autenticación y aislamiento. No recomendar poner el servidor productivo en modo development ni retirar la validación de ambiente para superar esta restricción. Ese cambio requiere revisión separada si el hosting no ofrece un entorno de pruebas apropiado.

## Evidencia necesaria del operador

Identificador exacto de release y host; nombres/presencia de variables sin valores; URL Sandbox y webhook; cadena TLS; configuración de proxy y prueba de IP; CORS con origen permitido y rechazado; topología de la base **de pruebas**; índices y duplicados inventariados sin modificarlos; backup con fecha/alcance/cifrado y restauración probada en destino no productivo; retención de logs; recepción real de avisos; responsable de incidentes y reversión.

Cualquier revisión posterior de producción se limita al alcance expresamente autorizado. La presente fase no ejecuta consultas administrativas sobre Atlas, ni pruebas POST sobre Nequi productivo.
