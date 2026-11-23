# Catálogo de destinos de Colombia

Fuente: **Departamento Administrativo Nacional de Estadística (DANE)**, [DIVIPOLA — Códigos municipios, gdxc-w37w](https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w), publicado por el DANE en el Portal Nacional de Datos Abiertos.

- Corte declarado por el conjunto: **30 de diciembre de 2024**.
- Actualización de filas: **24 de enero de 2025**, 20:44:32 UTC.
- Actualización de metadatos: **24 de septiembre de 2026**, 23:53:50 UTC.
- Descarga y verificación: **23 de noviembre de 2026**.
- Cobertura descargada y contrastada con el API oficial: **1.122 códigos de cinco dígitos**, en **32 departamentos más Bogotá, D.C.**: 1.103 municipios, 18 áreas no municipalizadas y 1 isla. No se filtran destinos por tipo, tamaño o popularidad. No incluye los centros poblados de ocho dígitos, que son otro nivel de DIVIPOLA.
- [Licencia CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), identificador oficial `CC_40_BY_SA`. Los datos y sus adaptaciones de formato conservan esta atribución y licencia.

`divipola-source.json` conserva los bytes de la respuesta oficial completa, ordenada por código. `divipola-source-metadata.json` conserva la respuesta de metadatos. `colombia-municipalities-metadata.json` identifica URLs, fechas, cobertura, licencia y SHA-256 del archivo de datos. El endpoint de conteo, conservado también como evidencia, devolvió `1122`; la descarga pidió hasta `5000`, sin truncar filas.

`../services/municipalityCatalog.js` adapta únicamente el formato de nombres a escritura legible. Conserva todos los códigos, nombres, tipos y asociaciones; Bogotá usa `11001`, departamento `11`, nombre `Bogotá, D.C.`. Las variantes de puntuación de Bogotá se reconocen sin asociarla a Cundinamarca. Las direcciones con otros nombres históricos que no coinciden requieren selección explícita; por ejemplo, la fuente denomina a Cali **Santiago de Cali**.

El checkout recibe el catálogo desde su propio backend en `/api/checkout/config`. Las pulsaciones solo filtran en memoria; no consultan al DANE ni a otros proveedores. La solicitud y el modelo siguen usando `shippingAddress.city` y `shippingAddress.department`; el código DIVIPOLA identifica las opciones sin introducir campos nuevos en pedidos.

Para actualizar la copia, descargar las URLs registradas en los metadatos, contrastar el conteo y las identidades, actualizar fechas/hash/cobertura y ejecutar las pruebas del catálogo y checkout. No usar únicamente `$limit` predeterminado de Socrata (puede truncar la descarga).

Se evaluó también el servicio DIVIPOLA MGN 2025 del Geoportal del DANE. Sus metadatos respondieron, pero la consulta completa GET fue bloqueada y POST devolvió 500. Por eso la implementación usa este conjunto nacional oficial descargable, con su corte explícito; no presenta el catálogo como una actualización de filas de 2026.
