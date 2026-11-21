# Reproducción y evidencias — Fase 5

Ejecutar desde la raíz del repositorio `dizor`. No iniciar el servidor de desarrollo, cargar archivos `.env` ni proporcionar un URI de una base existente. Se reutilizan Node, MongoDB, Chrome y dependencias ya presentes. No hay instalaciones nuevas.

## Regresión Node

PowerShell, ajustando las rutas de herramientas del host:

```powershell
$env:MMS_DIR='C:\ruta\herramientas-mongo' # contiene node_modules/mongodb-memory-server
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION='8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD='false'
node --require ./docs/auditoria-admin/fase5-evidencias/preservar-evidencias.cjs --test --test-concurrency=1 backend/test/phase1.test.js backend/test/phase2.test.js backend/test/phase2-compatibility.test.js backend/test/phase3.test.js backend/test/phase4.test.js docs/auditoria-admin/cierre-fase2/independiente.test.js docs/auditoria-admin/cierre-fase3/independiente.test.js docs/auditoria-admin/cierre-fase4/independiente.test.js frontend/test/stock-adjustment.test.cjs
node --test backend/test/phase5.test.js
```

Resultados en `regresion-completa.txt` (216 anteriores) y `pruebas-fase5.txt` (31 nuevas). Los fixtures crean sus propios replica sets efímeros, usuarios `.test` y autenticación real por cookies. No conectan una base existente ni envían correo/pagos. La suite nueva combina navegación pura con una matriz HTTP real de permisos; no reimplementa reglas comerciales.

El preload solo redirige archivos generados. Conserva las aserciones anteriores, los cierres independientes y las evidencias de Fases 2–4. Los nuevos resultados van a esta carpeta y a `regresion-fase2`, `regresion-fase3`, `regresion-fase4`. Soporta escrituras síncronas y capturas de Puppeteer. Los textos históricos de los fixtures no son defectos actuales.

## Navegadores anteriores

```powershell
node --require ./docs/auditoria-admin/fase5-evidencias/preservar-evidencias.cjs frontend/test/communications-browser.cjs
node --require ./docs/auditoria-admin/fase5-evidencias/preservar-evidencias.cjs frontend/test/orders-workspace-browser.cjs
node --require ./docs/auditoria-admin/fase5-evidencias/preservar-evidencias.cjs frontend/test/catalog-workspace-browser.cjs
```

8 + 20 + 20 comprobaciones sobre componentes reales con API ficticia. Cada subcarpeta conserva `navegador.json`, capturas y archivos generados. Las aserciones de esos tres scripts no se modificaron.

## Next.js autenticado con backend efímero

Con las variables MongoDB anteriores:

```powershell
# Opcionales si las herramientas están en otra ubicación:
$env:DIZOR_BROWSER_TOOLS='C:\ruta\node_modules\puppeteer-core'
$env:DIZOR_CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
node frontend/test/navigation-next-browser.cjs
```

Usa Next.js real en modo producción local, Express real, `AuthProvider`/`RoleRoute` reales, cookies de usuarios ficticios y MongoDB efímero. El fixture obtiene las cookies por el endpoint real de login; el navegador recibe esas cookies y `/auth/me` las comprueba. No sustituye router, componentes, servicios de frontend ni API por un adaptador.

Copia frontend a una carpeta temporal excluyendo `.env*`, `node_modules`, `.next` y pruebas. Enlaza únicamente las dependencias locales existentes. El build recibe un entorno permitido explícitamente, sin credenciales heredadas y con fetch/TCP bloqueados. El runtime permite loopback; Chrome intercepta y rechaza destinos externos. Resend, Wompi y correo permanecen simulados/deshabilitados. No se pulsan reenvíos, pagos ni enlaces WhatsApp.

Usa puertos propios en `127.0.0.1`; no inicia ni detiene servicios del usuario. Conserva `build-fase5.json/txt`, `next-servidor.txt`, `next-ejecucion.txt`, `next-navegador.json` y capturas. Salida 0 y `passed:true` son necesarios para aprobar. Ante un fallo, el JSON incluye estado/URL y `ultimo-fallo.png`; una corrida aprobada retira esa captura de diagnóstico.

Next, Chrome y la base efímera se cierran al terminar. La eliminación comprueba que la carpeta resuelta sea hija del temporal con el prefijo propio y retira primero la junction; no borra dependencias compartidas. El build tiene un límite de cuatro minutos.

## Sintaxis, ESLint y compilación

```powershell
node docs/auditoria-admin/fase5-evidencias/verificar-estatico.cjs
node docs/auditoria-admin/fase5-evidencias/build-fase5.cjs
git diff --check
```

El comparador toma los archivos intervenidos/nuevos y compara con HEAD. Para `ContentWorkspace.jsx`, movido desde `app/admin/contenido/page.js`, usa ese archivo original como base. Así conserva la clasificación de sus diagnósticos previos. No modifica las reglas del proyecto. Los scripts Node usan `no-unreachable`, `no-dupe-keys` y `no-unused-vars`; `.mjs` pasa `node --check` y el lint de frontend con la configuración Next existente.

No se declara ESLint global limpio: permanecen errores y advertencias anteriores. `newMessages: []` significa ausencia de diagnósticos nuevos. Los JSON guardan los mensajes completos antes/después.

El build independiente es una alternativa sin iniciar Next. El recorrido autenticado también compila aisladamente; su salida es la evidencia final cuando se ejecuta después.

## Alcance y referencias

Las operaciones de pedido y respuesta de Solicitudes afectan solo al fixture. Los CSV contienen datos ficticios y usan los endpoints con permisos existentes. Chrome dirige sus descargas a la carpeta temporal propia, que se elimina al terminar. No hay acciones sobre producción, `.env`, índices reales, notificaciones externas, pagos, commits, pushes ni despliegues.

El informe principal contiene el mapa de rutas, cobertura, limitaciones y capturas. `resultados-finales.json` y `manifest-sha256.json` consolidan resultados y huellas; el manifiesto excluye su propia huella.

Resultado final: **216 + 31 = 247 pruebas Node aprobadas; 48 recorridos originales y 35 comprobaciones Next autenticadas aprobadas**. Ocho tareas completadas. Sin errores de página/hidratación ni solicitudes externas. Doce capturas nuevas de Next, además de las capturas de regresión.
