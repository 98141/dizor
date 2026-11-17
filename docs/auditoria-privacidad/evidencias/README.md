# Evidencia reproducible de las pruebas

Nada de esta carpeta forma parte de la aplicación ni añade dependencias al proyecto. Todo usa datos sintéticos (dominio reservado `example.test`) y se ejecuta **fuera** del repositorio.

| Archivo | Qué prueba | Tipo |
|---|---|---|
| `pruebas/privacy.test.js` | Backend real (Express + Mongoose) contra MongoDB **en memoria**: 42 casos (fases 1–2 actualizados + F3: medios de pago, Nequi desactivado, Wompi, envío incluido, recordatorios desactivados, aviso PQR). Al final verifica que ningún token ni correo aparezca en los logs | Integración aislada |
| `pruebas/resultado-integracion-fase3.tap`, `pruebas/resultado-simuladas-fase3.tap` | Salidas de la ejecución final (42/42 y 6/6) | Evidencia |
| `pruebas/consent.sim.test.mjs` + `hooks.mjs` + `register-hooks.mjs` | Módulos de consentimiento del frontend con `window`, `localStorage`, `document.cookie` y `gtag` **simulados**: 6 casos | Unitaria con adaptadores simulados (no equivale a un navegador) |
| `e2e/backend-server.js` | Backend aislado para E2E: BD en memoria, correos capturados, red saliente bloqueada, textos legales **definitivos** (fase 3; en fases 1–2 se marcaban `[FIXTURE DE PRUEBA]`), Wompi con valores ficticios solo para ofrecerlo, Nequi y recordatorios desactivados, y un puerto de control solo en 127.0.0.1 | Arnés |
| `e2e/e2e.js` | 22 escenarios con **Chromium real** (Playwright 1.61.1 ya presente en la caché local de npx; no se descargó nada) | E2E en navegador |
| `e2e/e2e-results.json`, `e2e/capturas/fase3/` | Resultados y 30 capturas de la ejecución final de la fase 3 (solo datos sintéticos). Las capturas de la fase 2 se conservan en `e2e/capturas/` | Evidencia |
| `lint/compare.py`, `lint/mine.txt`, `lint/lint-compare.json` | Comparación de lint base `59a4717` frente al árbol actual | Evidencia |

## Garantías de aislamiento

- Ninguna prueba carga `.env` ni ejecuta `server.js`. Las variables se fijan en el propio arnés y `MONGO_URI` está vacío.
- MongoDB en memoria escucha en `127.0.0.1`, y la prueba aborta si no es así. Se usa el binario ya descargado en la fase 1 (`MONGOMS_SYSTEM_BINARY`).
- Claves de Resend, Nequi y Cloudinary vacías; Wompi solo con valores ficticios (la red saliente está bloqueada). Todos los envíos de correo se sustituyen por capturas en memoria.
- `fetch` del backend bloquea hosts no locales. El navegador aborta y registra cualquier petición fuera de `127.0.0.1`. Resultado de la última ejecución: **0 intentos** en ambos.
- El frontend se compiló en una **copia** fuera del proyecto, sin `.env`, apuntando a la API aislada. El `.next` del proyecto no se usó ni se modificó. En la fase 3 la copia se comparó con `diff -rq` contra `frontend/src` (idéntica) y se compiló desde cero.
- `MARKETING_TOKEN_SECRET` en pruebas: secreto aleatorio **exclusivo de pruebas**, generado en memoria en cada ejecución y nunca escrito en disco.

## Cómo ejecutarlas

```bash
# en una carpeta fuera del repositorio, con mongodb-memory-server@10 instalado
DIZOR_BACKEND_DIR="<ruta>/dizor/backend" node --test privacy.test.js
DIZOR_FRONTEND_SRC="<ruta>/dizor/frontend/src" node --import ./register-hooks.mjs --test consent.sim.test.mjs

# E2E: 1) backend aislado  2) copia del frontend compilada contra 127.0.0.1:5100  3) script
MONGOMS_SYSTEM_BINARY=<mongod> NODE_PATH=<carpeta>/node_modules DIZOR_BACKEND_DIR=<ruta>/dizor/backend node backend-server.js
NEXT_PUBLIC_API_URL=http://127.0.0.1:5100/api NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100 NEXT_PUBLIC_PQR_ENABLED=true next build && next start -p 3100 -H 127.0.0.1
PLAYWRIGHT_PATH=<ruta a playwright> node e2e.js
```

Efecto lateral conocido: el logger del backend escribe las peticiones de prueba (datos sintéticos) en `backend/logs/`, una carpeta ignorada por Git.
