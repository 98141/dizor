# Buscador de ciudad o municipio — DIZOR

Implementado y verificado en local el **23 de noviembre de 2026**. El árbol estaba limpio al comenzar, en el commit `23ce3a6`. Se conservó el checkout en una página y la integración de pagos existente.

## Fuente y cobertura comprobada

No había catálogo nacional reutilizable en el repositorio; el checkout tenía ciudad libre, una lista manual de departamentos y Nariño como valor inicial.

Se incorporó el conjunto oficial del **DANE**, [DIVIPOLA — Códigos municipios, gdxc-w37w](https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w), descargado directamente de datos.gov.co y servido desde el proyecto:

- Corte declarado: **30-12-2024**. Filas actualizadas: **24-01-2025**. Metadatos actualizados: **24-09-2026**. Descargado: **23-11-2026**.
- **1.122 destinos**, sin excluir ninguno: **1.103 municipios, 18 áreas no municipalizadas y 1 isla**, en **32 departamentos más Bogotá, D.C.**
- Se contrastó el total descargado con el [conteo del API oficial](https://www.datos.gov.co/resource/gdxc-w37w.json?%24select=count%28%2A%29), que devolvió `1122`. Evidencia: `checkout-municipios-evidencias/conteo-oficial.json`.
- Las pruebas resuelven los **1.122 registros** por ciudad/departamento y comprueban que **cada destino es alcanzable por búsqueda**. Se verifican códigos únicos de cinco dígitos, ceros iniciales, los 33 códigos de primer nivel y todos los tipos.
- Bogotá conserva código **11001**, departamento **11**, `Bogotá, D.C.` en ambos campos. No se acepta Bogotá/Cundinamarca. Los cuatro municipios llamados La Unión conservan opciones e identificadores distintos.

Los archivos originales, SHA-256, fechas, URLs, licencia **CC BY-SA 4.0** y atribución están en `backend/src/data/`. `.gitattributes` conserva los bytes oficiales para que el hash sea estable entre checkouts de Windows/Linux. Véase también `backend/src/data/README.md`.

Se evaluó DIVIPOLA MGN 2025 del Geoportal del DANE, pero no entregó la consulta completa. Se usó el conjunto nacional descargable publicado por el propio DANE, con su corte explícito; no se afirma que las filas sean de 2026.

## Comportamiento e integración

- Un único campo, etiqueta **Ciudad o municipio**, placeholder **Busca tu ciudad o municipio**. `sandona` muestra **Sandoná — Nariño**.
- Filtra el catálogo en memoria, sin peticiones por pulsación. Prioridad: nombre/etiqueta exactos, nombres que empiezan por la consulta y luego coincidencias contenidas; sin tildes ni distinción de mayúsculas. Hasta 50 sugerencias visibles; anuncia el total y pide acotar si hay más. Todos los destinos siguen siendo buscables.
- Combobox con `aria-expanded`, `aria-controls`, `aria-activedescendant`, listbox y opciones identificadas por DIVIPOLA. Flechas recorren; Enter elige sin enviar el formulario; Escape cierra. Clic y toque verificados. La ausencia de resultados se muestra y anuncia mediante `role=status`.
- Editar una selección vacía ciudad y departamento internos. Confirmar texto libre conserva el formulario, enfoca el buscador y muestra **Selecciona una ciudad o municipio de la lista** junto al campo.
- Sin departamento inicial. Direcciones guardadas con pareja inequívoca se precargan. Las antiguas ambiguas o sin coincidencia conservan calle, teléfono, código postal y notas; requieren elegir únicamente el municipio. No se infieren departamentos ni nombres por substring. Por ejemplo, el nombre oficial del catálogo es **Santiago de Cali**; una dirección antigua que dice Cali requiere selección explícita.
- `/api/checkout/config` sirve una sola copia del catálogo local. El POST conserva `shippingAddress.city` y `shippingAddress.department`; no necesita un campo nuevo en pedidos. El servidor valida la pareja antes de crear el pedido o iniciar pagos y guarda nombres canónicos. El modelo y administración conservan su contrato.
- Transportadora sigue a cargo de DIZOR: no se envía desde el navegador y se guarda vacía al crear. No se modificó la pasarela ni el código de administración.

## Compra local y evidencia

Prueba con datos sintéticos, Chrome, backend real y replica set temporal de MongoDB en loopback. La compra contraentrega recibió **HTTP 201**:

```json
{
  "opcion": "Sandoná — Nariño",
  "DIVIPOLA": "52683",
  "pedido": "DIZ-20261123-17A1DD55DEA4AF3EE680",
  "shippingAddress.city": "Sandoná",
  "shippingAddress.department": "Nariño",
  "carrier": ""
}
```

- `checkout-municipios-evidencias/seleccion-compra-local.png`: opción elegida en el formulario.
- `checkout-municipios-evidencias/sugerencias-sandona-1440.png` y `sugerencias-sandona-360.png`: búsqueda sin tilde y lista debajo del campo.
- **`checkout-municipios-evidencias/compra-local.json`**: cuerpo completo del POST realmente interceptado, respuesta 201 y lectura directa de `orders` mediante `collection.findOne`, incluidos `_id`, pedido, dirección y transportadora. También conserva la dirección devuelta por administración.

La lectura de MongoDB y sus aserciones se realizaron antes de destruir la réplica de prueba. La evidencia es una captura de esa base local temporal; no se escribió en la base real. No se enviaron pagos reales ni se desplegó.

## Pruebas

- **Backend: 63/63 aprobadas**: checkout, catálogo, phase1-v2 y las 47 regresiones específicas Wompi existentes. Registro `checkout-municipios-backend.txt`.
- **Frontend: 10/10 aprobadas**: búsqueda/precarga y regresiones existentes de campos/doble envío. Registro `checkout-municipios-frontend.txt`.
- **Navegador de componentes + backend real: 7 comprobaciones aprobadas**, sin errores JavaScript ni solicitudes externas. Validación/foco, ARIA, Enter/Escape/flechas, clic/toque, conservación de datos, seis anchos (1440/1024/820/800/390/360), compra y confirmación, invitado/autenticado, direcciones guardadas y Wompi simulado. Resultado `checkout-municipios-evidencias/resultado.json`.
- **Next real: 20 comprobaciones aprobadas**, sin errores JavaScript ni de hidratación: producto → carrito → checkout → confirmación, pagos simulados, administración/despacho, doble clic, respuesta perdida/reintento y dos invitados compitiendo por la última unidad. Resultado `checkout-municipios-evidencias/next/next-navegador.json`; registro `checkout-municipios-next.txt`.
- **ESLint dirigido: aprobado** sobre checkout, combobox y utilidades modificadas. `git diff --check`: aprobado.

## Build

`npm run build`: **aprobado**, 50 páginas, API fijada a localhost sin servidor real. Registro `checkout-municipios-build.txt`. El arnés Next también construyó correctamente una copia con `--webpack`, sin `.env`, credenciales heredadas ni red externa (`checkout-municipios-evidencias/next/build-fase7.json`).

## Archivos principales

Aplicación: `MunicipalityCombobox.jsx`, `municipalities.js`, `checkout/page.js`, `checkoutValidation.js`, `checkout.css`, `municipalityCatalog.js`, `checkoutController.js` y los datos/atributos descritos. Pruebas: `checkout.test.js`, `municipality-catalog.test.js`, `municipalities.test.cjs`, `checkout-browser.cjs` y los recorridos existentes `phase7BrowserFlow.cjs` / `phase7LastUnitFlow.cjs`, adaptados al único control.

Los arneses usan las mismas herramientas locales de las pruebas anteriores: `MMS_DIR` apuntando a una instalación de mongodb-memory-server, `MONGOMS_SYSTEM_BINARY` al mongod local y `MONGOMS_RUNTIME_DOWNLOAD=false`. La API externa solo se utilizó para obtener y verificar el catálogo oficial, nunca para buscar durante el checkout.
