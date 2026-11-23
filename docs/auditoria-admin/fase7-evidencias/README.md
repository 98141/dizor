# Evidencias reproducibles Fase 7

Ejecutar desde la raíz del repositorio `dizor`. No cargar `.env`, iniciar `server.js`, conectar bases reales ni sustituir estos fixtures por infraestructura externa. Las dependencias ya estaban instaladas; no se agregaron paquetes. El sistema usado fue Windows, Node24.15, MongoDB8.3.2, Next16.2.6 y Chrome headless.

## Preparación del entorno temporal

```powershell
$env:MMS_DIR='C:\Users\Asus ExpertBook\AppData\Local\Temp\claude\05d7f1a4ff6d7b65\82d41488-1994-4eae-b07c-5cfc50d82869\scratchpad\testenv'
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION='8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD='false'
```

`MMS_DIR` contiene mongodb-memory-server; puede ajustarse a otra instalación local. `DIZOR_BROWSER_TOOLS` puede apuntar a puppeteer-core local y `DIZOR_CHROME` a Chrome. El harness usa puertos aleatorios, réplica temporal, usuarios `example.test`, JWT ficticio y red de proveedores bloqueada. No hereda secretos al Next hijo. Se permite ejecutar procesos y loopback; no hacen falta credenciales externas.

`preparar.cjs` se ejecutó una vez **antes de cambiar fuente**: creó baseline y runners desde los anteriores sin modificarlos. No reejecutarlo sobre la corrección final para reemplazar la evidencia del punto de partida. `crear-harness.cjs` conserva el origen del harness inicial; no es el comando de revalidación del flujo final y no debe sobrescribir los ajustes posteriores del test.

## Regresión Node original

```powershell
node docs/auditoria-admin/fase7-evidencias/regresion-node.cjs
```

Esperado:295 pruebas,0 fallos. La lista original está en el runner y en `regresion-node.json`. Log final `regresion-node.txt`; inicial y revisión fallida de timestamps se conservaron con sufijos. No modificar sus aserciones.

## Regresión navegador original

```powershell
node docs/auditoria-admin/fase7-evidencias/regresion-navegador.cjs
```

Esperado:8 suites originales =195 comprobaciones y la novena de taxonomías =33. `regresion-navegador.json` registra código de salida y duración por suite; `regresion-*.txt` son los logs. Las salidas que las pruebas antiguas producirían dentro de auditorías previas se redirigen a `regresion/`, conservando subrutas.

## Taxonomías F6-I01

La novena suite anterior ejecuta `frontend/test/taxonomy-responsive-next-browser.cjs` sin cambiarlo. Esperado33 comprobaciones y110 medidas (cinco taxonomías por22 anchos), más prueba mutante de detección. Evidencia anidada bajo `regresion/cierre-fase6/correccion-f6-i01-evidencias/`. No confundir110 mediciones con110 pruebas adicionales.

## Integración backend nueva

```powershell
node --require ./docs/auditoria-admin/fase7-evidencias/preservar-salidas.cjs --test backend/test/phase7.test.js > docs/auditoria-admin/fase7-evidencias/nuevas-node-final.txt 2>&1
```

Esperado19 pruebas. Q01–14 inventario, concurrencia, finanzas y roles; Q15/Q17/Q18 fechas y exportación; Q19 recuperación de worker interrumpido; Q16 volumen/explain. `rendimiento-local.json` contiene la muestra y los planes reales observados, no una garantía de capacidad productiva.

## Compra integrada por UI

```powershell
node --require ./docs/auditoria-admin/fase7-evidencias/preservar-salidas.cjs frontend/test/phase7-next-browser.cjs > docs/auditoria-admin/fase7-evidencias/integracion-compras.txt 2>&1
```

Next de producción aislado + Express + MongoDB efímero, sin router ni controladores sustituidos. Datos de marketing del fixture desactivan el popup para no interferir con la compra. Se rechazan cookies opcionales y se aceptan autorizaciones de compra por teclado. Los cuatro logins de preparación consumen el límite de loopback: el test reinicia exclusivamente ese contador en memoria antes de cambiar de rol, conservando formulario, cookies, JWT y política de la aplicación. El429 observado queda en `integracion-intento6-limite-login.txt`; no es una corrección del producto.

La pérdida de respuesta se simula enviando una vez el cuerpo real del navegador al mismo Express con el mismo actor y abortando la respuesta; el siguiente clic vuelve al endpoint real con la misma clave. Se comprueba un pedido/un descuento. La página Wompi se responde dentro del interceptor local; no abre una conexión externa. El transporte de correo mantiene inbox ficticio por clave y no acredita recepción real.

`next-navegador.json` se escribe incluso cuando falla; sólo `passed:true` junto con código0 acredita recorrido completo. `integracion-compras.json` corresponde al recorrido que termina sus aserciones. Los archivos `integracion-intento*` documentan preparación de selectores/consentimientos/fixture y no se cuentan como casos aprobados. Las capturas muestran datos ficticios.

## Sintaxis

```powershell
node docs/auditoria-admin/fase7-evidencias/verificar-estatico.cjs
```

Incluye `node --check` en archivos modificados y scripts nuevos. Resultado en `estatico.json`.

## Lint

El mismo verificador ejecuta ESLint focalizado de los archivos CommonJS modificados/nuevos y compara las mismas23 rutas de F6 con su baseline:7 errores/3 advertencias previos. `lint-node.json` contiene diagnósticos nuevos. No se usa suppress ni se declara lint global limpio.

En el archivo backend `financeService.js` hay1 error previo por `productId` no usado, comprobado también con la fuente anterior. El verificador exige cero diagnósticos nuevos; conserva y comunica ese diagnóstico existente por separado.

## Build

El harness de compra ejecuta `next build --webpack` antes de probar. `build-fase7.json/txt`: salida, aislamiento, red y resultado. No iniciar un build en la carpeta de trabajo con `.env`; la copia temporal excluye esos archivos y usa guardas de red.

## Preservación y diff

El verificador compara5821 archivos preexistentes con `baseline-sha256.json`, separa logs de runtime y exige que los únicos cambios protegidos de fuente sean los tres financieros. Ejecuta `git diff --check`. No hay commits ni pushes. La fuente previa del cálculo financiero se guarda como `*-antes.js.txt`.

## Evaluación independiente

El informe final contiene la matriz39 y clasificación de riesgos. Revisar que cada conteo esté respaldado por su salida final, repetir las pruebas pertinentes y evaluar las observaciones menores/externas de forma independiente. No conectar servicios reales para repetir este QA. El cierre definitivo corresponde a Cursor.
