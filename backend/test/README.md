# Regresión de integridad DIZOR — Fase 1

Ejecutar desde `backend` con Node y un binario MongoDB 7.0.x ya disponible.
La suite crea y destruye su propio replica set local; no lee `.env` ni acepta un URI de base externa. Resend, Wompi y demás credenciales se sustituyen antes de cargar la app; los datos son ficticios. Las respuestas Wompi se simulan, no se realizan solicitudes al proveedor.

Se reutiliza `mongodb-memory-server` de un entorno de herramientas ya instalado. No es una dependencia de producción ni se añadió al lockfile.

```powershell
$env:MMS_DIR = 'C:\ruta\al\entorno-de-herramientas'
# MMS_DIR contiene node_modules/mongodb-memory-server.
$env:MONGOMS_SYSTEM_BINARY = 'C:\ruta\a\mongod.exe'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
npm run test:phase1
```

No ejecutar el servidor habitual ni scripts seed para estas pruebas. La suite no necesita `MONGO_URI`, claves reales ni conexión a producción. En una sandbox que deniegue sockets de 127.0.0.1, hace falta autorizar la ejecución del proceso de pruebas local; no sustituir el URI por una base externa.

Los 22 escenarios originales quedan identificados A1–G3 y las 35 pruebas adicionales P01–P35. A0 verifica índices durante la preparación. El conflicto de índice de SpecialRequest preexistente se informa por separado; los índices de todos los modelos de esta fase se exigen correctos. No se deben convertir aserciones en simples capturas de resultados.
