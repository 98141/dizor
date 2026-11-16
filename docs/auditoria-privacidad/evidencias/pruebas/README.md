# Pruebas de las correcciones de privacidad (evidencia reproducible)

Estas pruebas **no forman parte de la aplicación** ni añaden dependencias al
proyecto. Usan solo datos sintéticos (dominio reservado `example.test`).

| Archivo | Qué prueba | Tipo |
|---|---|---|
| `privacy.test.js` | Backend real (Express + Mongoose) contra MongoDB **en memoria** (127.0.0.1, efímera). 24 casos. | Integración aislada |
| `consent.sim.test.mjs` + `hooks.mjs` + `register-hooks.mjs` | Módulos de consentimiento/analítica del frontend con `window`, `localStorage`, `document.cookie` y `gtag` **simulados**. 6 casos. | Unitaria con adaptadores simulados (NO equivale a navegador) |

## Garantías de aislamiento de `privacy.test.js`

- No carga ningún `.env`: importa `src/app.js` (no `server.js`) y fija todas
  las variables antes; `dotenv` no sobrescribe variables ya definidas.
- `MONGO_URI` vacío; la conexión se hace a `mongodb-memory-server` y la
  prueba **falla** si el host no es `127.0.0.1`.
- Claves de Resend, Wompi, Nequi y Cloudinary vacías. El transporte del
  acuse y de la constancia PQR se sustituye por un espía en memoria.
- `fetch` global bloquea cualquier host distinto de `127.0.0.1`/`localhost`;
  la prueba falla al final si hubo algún intento de red saliente.
- No se ejecutan `server.js`, scripts de `seed`, ni el script de
  recordatorios por línea de comandos.

Efecto lateral conocido: el logger del backend escribe las peticiones de la
prueba (datos sintéticos) en `backend/logs/` (carpeta ignorada por Git).

## Cómo ejecutarlas

En una carpeta fuera del repositorio:

```bash
npm init -y && npm install mongodb-memory-server@10
# copiar aquí los archivos de esta carpeta
DIZOR_BACKEND_DIR="<ruta>/dizor/backend" node --test privacy.test.js
DIZOR_FRONTEND_SRC="<ruta>/dizor/frontend/src" node --import ./register-hooks.mjs --test consent.sim.test.mjs
```

`mongodb-memory-server` descarga un binario de MongoDB la primera vez.
