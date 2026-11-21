# Reproducción aislada — Fase 3

Ejecutar desde la raíz del repositorio `dizor` con las dependencias ya disponibles. No cargar `.env`, no iniciar `backend/src/server.js`, no usar una base existente ni ejecutar semillas/migraciones. Los fixtures reemplazan credenciales, simulan proveedores y bloquean salida externa.

## Pruebas de backend y regresión

PowerShell; ajustar las rutas locales de herramientas:

```powershell
$env:MMS_DIR='C:\ruta\herramientas-mongo' # contiene node_modules/mongodb-memory-server
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION='8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD='false'
node --require ./docs/auditoria-admin/fase3-evidencias/preservar-evidencias.cjs --test --test-concurrency=1 backend/test/phase1.test.js backend/test/phase2.test.js backend/test/phase2-compatibility.test.js backend/test/phase3.test.js docs/auditoria-admin/cierre-fase2/independiente.test.js frontend/test/stock-adjustment.test.cjs
```

Resultado final en `regresion-completa.txt`: **162 aprobadas, cero fallidas/omitidas**, aproximadamente 91,1 s. Desglose: 57 + 53 + 5 + 34 + 9 + 4. Las 119 anteriores y las nueve independientes no se editaron. `preservar-evidencias.cjs` redirige únicamente sus archivos JSON generados a esta carpeta; conserva aserciones, servicios y datos de prueba. Salidas redirigidas: `cierre-fase1-resultados.json`, `cierre-fase2-resultados.json`.

Solo Fase 3: `node --test backend/test/phase3.test.js` o `npm run test:phase3` desde backend con las variables anteriores. `pruebas-fase3.txt` conserva una ejecución previa de 32 casos; los casos adicionales U33–U34 y la ejecución final de 34 están en la regresión consolidada.

MongoDB utiliza replica set efímero y datos ficticios de localhost. Las escrituras crudas que preparan fechas/históricos se limitan al fixture efímero y no constituyen una migración. No se descargó MongoDB ni se instalaron servicios/dependencias nuevos.

## Recorridos de navegador

```powershell
# Opcionales si las herramientas existentes están en otras rutas:
$env:DIZOR_BROWSER_TOOLS='C:\ruta\node_modules\puppeteer-core'
$env:DIZOR_CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
node frontend/test/orders-workspace-browser.cjs
```

Herramientas usadas: Chrome instalado, `puppeteer-core` ya existente en la carpeta temporal `dizor-verify-puppeteer`, React/SWC/webpack del frontend. El script compila los componentes reales, utiliza el shell existente, adapta navegación a History API y sustituye servicios por una API HTTP ficticia de localhost. No abre el administrador conectado ni utiliza su autenticación o DB reales.

Genera `navegador.json` y doce PNG: dashboard, lista y detalle en escritorio, tablet de 820 px, móvil de 390 px y móvil de 360 px. Resultado: **B01–B20 aprobadas**, sin errores de página ni solicitudes externas observadas. Verifica acciones, doble clic, estados, retorno con filtros, error de API, respuesta ambigua, permisos visibles, campo de fecha colombiano, caption móvil, teclado y ausencia de desbordamiento.

La API ficticia comprueba la integración de interfaz; la exactitud y autorización de las rutas reales se cubren por HTTP en las pruebas MongoDB. No equivale a una sesión integral de Next con autenticación real. No se abrió WhatsApp: se interceptó `window.open` para comprobar que no lo invoca ninguna operación.

El perfil de navegador, bundle y API son temporales; el script valida su ruta antes de eliminarlos. Las capturas finales fueron inspeccionadas visualmente además de las comprobaciones automáticas.

## Sintaxis, lint y build

```powershell
node docs/auditoria-admin/fase3-evidencias/verificar-estatico.cjs
node docs/auditoria-admin/fase3-evidencias/build-fase3.cjs
git diff --check
```

`verificar-estatico.cjs` comprueba 13 archivos Node y aplica la configuración ESLint del frontend a los seis archivos intervenidos. Conserva mensajes completos y la comparación de los archivos existentes con `git show HEAD:<ruta>`, sin modificar el árbol. Reglas Node explícitas: `no-unreachable`, `no-dupe-keys`, `no-unused-vars`; backend no tiene configuración propia.

Resultado en `estatico-resumen.json`: sin errores de sintaxis ni diagnósticos nuevos. Frontend pasa de dos errores/tres advertencias a cero errores/una advertencia ya presente de imagen. Node: cero errores/advertencias. El código 0 del script significa ausencia de regresión estática en este alcance, no lint global del repositorio.

`build-fase3.cjs` copia frontend a una carpeta temporal, excluye `.env*`, `.next`, pruebas y dependencias; enlaza las dependencias existentes, filtra variables heredadas y bloquea fetch/TCP. Ejecuta `next build --webpack`, sin iniciar la aplicación ni desplegar. Retira el enlace antes de borrar únicamente su carpeta temporal validada. Evidencias: `build-fase3.json` y `build-fase3.txt`.

En este host los sockets locales y la creación del enlace de dependencias requirieron ejecución fuera del sandbox restrictivo. La excepción se usó exclusivamente para estos procesos aislados.

## Alcance y conservación

Las evidencias originales de fases anteriores no se sobrescriben. La carpeta `cierre-fase2/` aportada por el auditor y el trabajo concurrente de `SiteFooter.jsx` permanecen fuera de los cambios de esta fase. No hubo cambios de `.env`, pagos/correos reales, producción, migraciones reales, índices históricos, despliegues, commits ni pushes. La entrega externa de comunicaciones sigue desactivada.

Informe principal: [informe-fase3-operacion-pedidos-2026-11-20.md](../informe-fase3-operacion-pedidos-2026-11-20.md).
