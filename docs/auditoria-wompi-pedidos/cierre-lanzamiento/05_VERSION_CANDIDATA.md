# Versión candidata · preparada para congelar

Base: main, HEAD `23ce3a6c8d9d36253f8c0e7b1499ce63ce8f95e6`. Referencias Git locales: 1 commit por delante de origin/main y 53 sobre origin/develop. No se afirma que una referencia local sea una inspección del servidor publicado.

Huella de **482 fuentes/recursos/manifiestos de ejecución**:

```text
a0369c508c1ad8d686aad201c3504fa97b2c45ecc2014cc864188873174e1093
```

`evidencias/version-candidata.json` enumera cada archivo y SHA. `fuentes-pendientes-release.json` identifica los **37 archivos de aplicación/pruebas** nuevos o modificados que deben revisarse junto con documentación/arneses. `archivos-para-revisar-antes-del-commit.txt` lista el árbol pendiente completo excluyendo .env, dependencias, builds, logs y directorios de credenciales.

Esta huella permite comprobar qué se probó; **no sustituye un commit de Git**. El candidato incluye el checkout y municipios que ya estaban en el árbol, la remediación/RC-01 y este delta de arranque/operación. No se revierte ni descarta trabajo ajeno.

**El propietario autorizó en este chat crear el commit local**, sin push ni despliegue. El SHA definitivo se obtiene de git rev-parse HEAD; la validación posterior se ejecuta con `node docs/auditoria-wompi-pedidos/cierre-lanzamiento/evidencias/validar-commit.cjs`. Guarda resultados en el directorio temporal `dizor-validacion-<SHA>-...`, fuera del árbol congelado, y verifica fuente y árbol versionado sin cambios. No activar Wompi público por el mero hecho de tener un commit. Publicación en origin y auditoría del release siguen siendo pasos separados.

## Índices y artefactos

`indices-requeridos.json` contiene 27 definiciones únicas derivadas de los modelos, **no una migración ejecutada**. Comparar con inventario real y duplicados en copia restaurada, diseñar compatibilidad y aprobación. La inspección puede ejecutarse por un operador con MONGO_URI autorizado en su entorno seguro:

```text
node backend/src/scripts/inspectDatabaseReadiness.js --read-only
```

No carga .env, no crea colecciones/índices, no arregla duplicados y no imprime URI ni datos de clientes. No se ejecutó contra producción ni Atlas.

El código nuevo se valida con los logs de esta carpeta. Los resultados locales y Sandbox se mantienen separados. El Link público de Sandbox ya presente en la historia (FF-07) no se borra de informes anteriores ni se considera secreto productivo; su publicación/limpieza debe revisarse antes de un push, sin reescribir la historia a ciegas.
