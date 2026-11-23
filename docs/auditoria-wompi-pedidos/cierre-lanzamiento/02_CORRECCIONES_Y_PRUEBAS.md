# Correcciones verificables

## FF-02 · diagnóstico y pedido real Sandbox

Se reconstruyó el formato que el servicio actual envía al proveedor: nombre 40 caracteres, descripción 51, sku 33, 15.000.000 centavos COP. Un ensayo independiente con redirect_host=127.0.0.1 obtuvo **HTTP 403** y no produjo respuesta JSON verificable. Otro ensayo independiente con localhost obtuvo **HTTP 201**. No eran reintentos del pedido antiguo, ni generaron transacciones de pago.

La configuración del arnés inicial usaba 127.0.0.1. El rechazo reproducido explica cómo ese entorno termina en el 502 genérico del checkout. El diagnóstico de aquel primer POST no se conservó: **no se afirma conocer retroactivamente su respuesta exacta o si creó un enlace**. La comparación prueba una causa concreta reproducible y una configuración de ensayo funcional.

Después se ejecutó un pedido ficticio nuevo mediante **POST /api/checkout/orders**, contra Express y MongoDB efímero, con Wompi real Sandbox y CLIENT_URL=localhost. Resultado:

- Checkout 201, Link externo 201, GET Link 200 y ambiente test.
- Replay del mismo cuerpo/idempotencia: 200, mismo pedido y mismo enlace.
- Un solo POST al proveedor; órdenes 0→1; stock permanece 5; pago pendiente, checkout ready, sin descuento prematuro.
- No se pagó ese Link ni se recibió webhook; la réplica temporal se cerró. No es una demostración de pago punta a punta.

Evidencia: diagnostico-loopback-ip.json, diagnostico-localhost.json, checkout-sandbox-real.json y log de ejecución. Ningún cuerpo de webhook o secreto guardado.

`wompiService.createPaymentLink` conserva el payload y añade diagnósticos tipados para timeout, transporte, respuesta no JSON y rechazo HTTP. Logs guardan código/status y nombres de campos permitidos; nunca headers, valores, cuerpo completo o error arbitrario del proveedor. No hay fallback de asociación, corrección automática de CLIENT_URL ni retry de creación. S05/S06 prueban redacción y un solo intento.

## FF-04 · arranque seguro e inspección sin migración

- `server.js` desactiva autoIndex/autoCreate **antes** de cargar app/modelos en producción.
- `config/db.js` conecta con esas opciones, carga todas las definiciones y valida antes de resolver.
- `databaseReadiness.js` lee hello y listIndexes. Exige replica set o mongos, colección existente e índices únicos compatibles en claves/orden, unique, sparse, filtro parcial y collation. No depende del nombre del índice.
- Falta/discordancia produce DATABASE_NOT_READY con metadatos seguros; server registra y sale con código 1. No abre HTTP ni inicia worker hasta superar la conexión/validación. /health es accesible solo tras ese arranque, y sigue siendo liveness, no un monitor continuo de cada índice.
- No se llama a syncIndexes, createIndexes ni dropIndex en producción. Se preparó `inspectDatabaseReadiness.js --read-only`, que **no carga .env**, para el operador autorizado.

Se verifica el conjunto de índices únicos de todos los modelos, incluidos modelos cargados de forma diferida. El manifiesto local contiene **27 definiciones únicas**. Las colecciones/índices nuevos deben provisionarse previamente mediante una migración revisada, con los builds terminados y ensayados en una copia restaurada; el arranque no los crea ni repara.

Antes: B01 demuestra que server escuchaba mientras connectDB seguía pendiente (FAIL). Después: B01 PASS. I01–I11 verifican Mongo real efímero: índices correctos, ausentes, no únicos, filtro parcial incompatible, sparse, duplicados con error real 11000, colección ausente y standalone; procesos reales de server rechazan base incompleta con exit=1 y sin crear colecciones, y arrancan con base preparada.

Fundamento primario: [Mongoose y autoIndex](https://mongoosejs.com/docs/production/indexes.html), [metadatos de índices MongoDB](https://www.mongodb.com/docs/manual/reference/command/listindexes/). El guardarraíl evita continuar sin garantías; no certifica la base productiva no inspeccionada.

## FF-05 · suspender nuevas compras sin perder recepción

`WOMPI_CHECKOUT_ENABLED` controla únicamente nuevas compras/creación de Links. En producción, ausente/false/valor inválido = desactivado; solo true habilita. Desarrollo/pruebas conservan compatibilidad salvo false explícito. Las credenciales permanecen disponibles para verificar webhooks, consultar y conciliar pagos existentes. Contraentrega sigue disponible.

`paymentMethods.js` retira Wompi de la oferta al suspender y rechaza nuevas solicitudes antes de crear pedido. `createPaymentLink` tiene una segunda guarda antes de llamar al proveedor. S01–S04 prueban flag, ausencia de pedidos nuevos, COD y procesamiento único de un webhook válido/conciliación durante la pausa.

**No desactiva enlaces antiguos en Wompi ni cancela/reembolsa dinero.** No sustituye la ventana restringida del hosting para una prueba controlada. No se habilitó en producción.

## Resultados de esta fase

Nuevas: **18/18** (B01, I01–I11, S01–S06). Adicionales: **30/30** (G 10 + checkout/catálogo 14 + frontend campos/municipios 6). C, D, variantes, F, Q/RC, Z, R, limitadores, N, v2, histórica y matriz se ejecutaron de nuevo; resúmenes exactos en evidencias/resultados.json.

Se conservan deliberadamente los FAIL de los originales que omiten archivo/conclusión explícitos, P06/P23 históricos y X07. No se editan aserciones previas. Las variantes siguen separadas. El frontend no cambia en esta intervención; su build aprobado de preproduccion no se vuelve a presentar como build de un commit nuevo inexistente.

Fuentes atribuibles: config/db.js, server.js, services/wompiService.js, services/paymentMethods.js; nuevos services/databaseReadiness.js y scripts/inspectDatabaseReadiness.js. Diff exacto contra las copias iniciales y SHA en evidencias/. Comparación de **4433 archivos**: solo cambian las cuatro fuentes previstas entre los existentes; nuevas fuentes y entregables declarados aparte. Checkout y evidencias anteriores intactos.
