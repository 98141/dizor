# Evidencias reproducibles — Fase 2

Ejecutar desde la raíz `dizor`. Se requieren las dependencias locales existentes de backend/frontend, `mongodb-memory-server` en una carpeta auxiliar y un binario MongoDB local. No ejecutar `backend/src/server.js`, semillas ni scripts de migración. Ninguna de estas comprobaciones requiere credenciales reales ni archivos `.env`.

## Regresión

En PowerShell, ajustar exclusivamente las dos rutas de herramientas al equipo:

```powershell
$env:MMS_DIR='C:\ruta\herramientas-mongo' # contiene node_modules/mongodb-memory-server
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION='8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD='false'
node --test backend/test/phase1.test.js backend/test/phase2.test.js backend/test/phase2-compatibility.test.js frontend/test/stock-adjustment.test.cjs
```

Resultado registrado: **119 aprobadas, 0 fallidas, 0 omitidas**, en `regresion-completa.txt`. El runner de compatibilidad redirige únicamente el archivo de resultados generado por las cinco pruebas anteriores hacia `cierre-independiente-resultados.json`. No modifica pruebas ni evidencias del cierre de Fase 1. Los textos `detail.note` heredados describen el defecto histórico; usar los veredictos y valores numéricos de la ejecución actual.

El fixture evita cargar `.env`, reemplaza credenciales por valores ficticios, simula Wompi/Resend y bloquea salida externa. Cada archivo de pruebas usa su propia base efímera local. Los índices se crean exclusivamente en estas bases nuevas. El proceso no conserva datos de clientes reales.

## Navegador

```powershell
# Opcionales si difieren de las rutas locales predeterminadas del script:
$env:DIZOR_BROWSER_TOOLS='C:\ruta\node_modules\puppeteer-core'
$env:DIZOR_CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
node frontend/test/communications-browser.cjs
```

Herramientas utilizadas: `puppeteer-core` ya disponible en la carpeta temporal `dizor-verify-puppeteer`, Chrome instalado y React/SWC/webpack del frontend. No se instalaron servicios ni se abrió el administrador real. El script crea perfil, bundle y API ficticia locales; borra su carpeta temporal al terminar. Genera `navegador.json`, `navegador.txt`, dos capturas de la interfaz y dos previsualizaciones de correo con sus HTML/textos. Ocho comprobaciones aprobadas, sin errores de página ni solicitudes externas observadas por el harness.

Las pruebas de interfaz verifican el componente real con API simulada; las pruebas backend verifican por separado las rutas reales con MongoDB efímero. Los correos se renderizan en Chrome, no dentro de Gmail/Outlook.

## Sintaxis, lint y build

```powershell
node docs/auditoria-admin/fase2-evidencias/verificar-estatico.cjs
node docs/auditoria-admin/fase2-evidencias/build-fase2.cjs
git diff --check
```

El primer script comprueba 25 archivos con `node --check`, aplica la configuración ESLint existente a seis archivos frontend y reglas básicas explícitas a los archivos Node intervenidos. Compara los archivos existentes con su contenido en `HEAD` mediante `git show`; no cambia el árbol ni usa `--fix`. Resultado: sin errores de sintaxis ni diagnósticos nuevos. Persisten cuatro errores/dos advertencias frontend y una advertencia Node. Su salida 0 significa ausencia de regresión estática, **no** que el lint global esté limpio. Los mensajes completos antes/después se conservan en los JSON.

El segundo script hace el build de producción local `next build --webpack` en una copia temporal: excluye `.env*`, `.next`, pruebas y dependencias, enlaza las dependencias existentes, filtra variables heredadas y bloquea fetch/TCP. Resultado `exitCode:0`, Next.js 16.2.6. Solo elimina su carpeta temporal tras comprobar que la ruta pertenece a ella y retirar el enlace a dependencias. No ejecuta despliegue ni inicia el servidor.

En este host las pruebas con sockets locales y los enlaces temporales requirieron ejecución fuera del sandbox restringido. Esa excepción se utilizó para los procesos aislados descritos, sin conexión a bases o proveedores reales.

## Alcance de la evidencia

No hay correo real aceptado/entregado, pagos reales ni pruebas de infraestructura productiva. El transporte real requiere activación explícita de `TRANSACTIONAL_NOTIFICATIONS_ENABLED=true`; no se activó. No se modificaron secretos ni se crearon commits/pushes.

El informe técnico principal está en `../informe-fase2-notificaciones-2026-11-20.md`. Los archivos `pruebas-fase2.txt` y `regresion-fase1.txt` conservan ejecuciones previas; la referencia final consolidada es `regresion-completa.txt` junto con los JSON finales de navegador, estática y build.
