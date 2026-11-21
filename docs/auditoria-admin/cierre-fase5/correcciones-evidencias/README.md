# Reproducir las correcciones de Fase 5

Desde la raíz del repositorio `dizor`. Usar herramientas/dependencias ya existentes; no cargar `.env`, no iniciar `backend/src/server.js` ni usar un URI real.

## Herramientas locales

```powershell
$env:MMS_DIR='C:\ruta\herramientas-mongo' # contiene node_modules/mongodb-memory-server
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION='8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD='false'
# Opcionales si Chrome y puppeteer-core están en otras ubicaciones:
$env:DIZOR_BROWSER_TOOLS='C:\ruta\node_modules\puppeteer-core'
$env:DIZOR_CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
```

## Pruebas Node

```powershell
node --require ./docs/auditoria-admin/cierre-fase5/correcciones-evidencias/preservar-evidencias.cjs --test --test-concurrency=1 backend/test/phase1.test.js backend/test/phase2.test.js backend/test/phase2-compatibility.test.js backend/test/phase3.test.js backend/test/phase4.test.js backend/test/phase5.test.js docs/auditoria-admin/cierre-fase2/independiente.test.js docs/auditoria-admin/cierre-fase3/independiente.test.js docs/auditoria-admin/cierre-fase4/independiente.test.js docs/auditoria-admin/cierre-fase5/independiente.test.js frontend/test/stock-adjustment.test.cjs
node --test backend/test/phase5-corrections.test.js
```

La primera ejecución tiene 252 casos (247 anteriores + 5 independientes). La segunda, 31 nuevos. Ambas usan bases efímeras y proveedores simulados. El preload redirige solo archivos generados; no modifica aserciones, informes o evidencias anteriores. Resultados: `regresion-252.txt`, `pruebas-nuevas.txt`.

## Navegadores anteriores y de Cursor

```powershell
node --require ./docs/auditoria-admin/cierre-fase5/correcciones-evidencias/preservar-evidencias.cjs frontend/test/communications-browser.cjs
node --require ./docs/auditoria-admin/cierre-fase5/correcciones-evidencias/preservar-evidencias.cjs frontend/test/orders-workspace-browser.cjs
node --require ./docs/auditoria-admin/cierre-fase5/correcciones-evidencias/preservar-evidencias.cjs frontend/test/catalog-workspace-browser.cjs
node --require ./docs/auditoria-admin/cierre-fase5/correcciones-evidencias/preservar-evidencias.cjs frontend/test/navigation-next-browser.cjs
node --require ./docs/auditoria-admin/cierre-fase5/correcciones-evidencias/preservar-evidencias.cjs docs/auditoria-admin/cierre-fase5/navegador-independiente.cjs
```

Resultados: `regresion-fase2/navegador.json` (8), `regresion-fase3/navegador.json` (20), `regresion-fase4/navegador.json` (20), `regresion-fase5/next-navegador.json` (35) e `independiente/navegador-independiente.json` (10). Las tres primeras usan componentes reales con API ficticia; las dos últimas, Next y Express reales con auth/MongoDB efímeros. Las aserciones originales permanecen intactas.

## Corrección con Next autenticado

```powershell
node frontend/test/content-settings-next-browser.cjs
```

25 comprobaciones con el componente real, servicios reales y endpoints de Express. Se interceptan únicamente las fallas controladas y se conservan CORS/credenciales de los puertos propios. Hay configuración no vacía preparada por API, intento de submit bloqueado, consultas posteriores, reintento, doble clic, PATCH aplicado con respuesta perdida, resultado no confirmado, lectura de verificación, datos vacíos válidos, listas, Apariencia y escritorio/móviles.

`F5-A01-antes.json/png` y `reproduccion-previa.txt` conservan el fallo esperado de la aserción antes de la corrección. `base/` contiene las seis fuentes iniciales; no se vuelve a modificar la aplicación para demostrar la prueba roja. El mismo bloqueo es R01 en el recorrido final. Un `passed:true` en el JSON final es necesario para aprobar, además de la salida 0.

La carpeta temporal excluye `.env*`, `.next`, dependencias y pruebas; enlaza las dependencias existentes. El proceso de compilación recibe variables permitidas explícitamente y bloquea fetch/TCP. Runtime limitado a loopback, Chrome con destinos externos interceptados y proveedores del fixture simulados/desactivados. Usa puertos nuevos en 127.0.0.1. No inicia ni detiene servicios del usuario. Las descargas de prueba van al temporal propio.

Al terminar se cierran Chrome, Next y la base efímera. Se comprueba el directorio resuelto y su prefijo antes de eliminarlo; primero se retira la junction de dependencias. No se borra la instalación compartida. El build se guarda en `build-fase5.json/txt` dentro de esta carpeta, separado de la evidencia original de Fase 5. La ejecución está en `navegador-correcciones.txt` y `next-navegador.json`.

## Estática y preservación

```powershell
node docs/auditoria-admin/cierre-fase5/correcciones-evidencias/verificar-estatico.cjs
git diff --check
```

El comparador usa `base/`, porque la fase estaba sin commit al iniciar las correcciones. Son ocho archivos Node/.mjs y ocho frontend. `newMessages: []` significa ausencia de diagnósticos nuevos, no lint global limpio. Se conservan un error y dos advertencias previos en el cargador general del CMS. Node básico no tiene errores/advertencias. No se suprimen reglas.

`base-hashes.json` captura el árbol inicial sin `.env`. `archivos-modificados-desde-base.json` identifica los seis archivos existentes cambiados. `resultados-finales.json` consolida verificaciones; `manifest-sha256.json` identifica el código y artefactos finales y excluye su propia huella.

No hay producción, bases reales, correos/pagos reales, activación de entrega externa, migraciones reales, commits, pushes o despliegues. Los cambios de datos pertenecen solo a los fixtures efímeros.
