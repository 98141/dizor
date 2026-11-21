# Registro de inspección visual

Revisión realizada por Codex sobre imágenes de la aplicación real en el entorno aislado. No es una certificación humana WCAG ni el cierre independiente de Cursor.

## Antes

Se abrieron los cuatro contactos `antes-todas-*.png`, que reúnen las 33 vistas móviles, y los contactos iniciales de escritorio. Se compararon especialmente PQR, solicitudes, usuarios, formularios editoriales, Popup y Finanzas.

Problemas visibles: controles pequeños, estilos de botón dispares, encabezados de tablas que exigían desplazamiento horizontal, recorte de pestañas y jerarquías diferentes entre módulos. Las mediciones confirmaron los desbordamientos anotados en `MATRIZ_INICIAL.md`.

## Después

Se abrieron los cuatro contactos finales de 360 px y los cuatro de 1440 px para revisar todas las vistas. También se inspeccionaron directamente las capturas de Finanzas a 1024 px, solicitudes a 360 px, confirmación con foco a 360 px, Popup completo, texto ampliado al 200%, ajuste de inventario abierto, formulario de personalización y editor de imágenes de Inspiración con registros ficticios.

La revisión comprobó la jerarquía de tareas, legibilidad de etiquetas, separación entre datos y acciones, botones principales, tablas móviles con etiquetas, bloques completos de formularios, campos deshabilitados y ausencia de superposición de contenido.

## Iteraciones comprobadas

- Se retiró el mínimo heredado de las tablas en móvil, después de que la primera adaptación todavía desbordara.
- Se corrigieron el contraste de la insignia de Alertas y el borde de los selectores de color.
- Se corrigió una etiqueta de subtítulo al recorrer las subsecciones editoriales adicionales.
- Se corrigió la prioridad CSS que ocultaba la diferencia entre botón principal y secundario. Se comprueba el color calculado en Chrome.
- Se corrigió la prioridad del borde de error del editor de costos, incluso con foco. La prueba espera el final de la transición y comprueba el color real; conserva también la aserción de `aria-invalid` y el mensaje.
- Las capturas completas vuelven al inicio de la página antes de fotografiarla. Esto evita que la cabecera fija y el enlace de salto aparezcan en posiciones intermedias del documento capturado.

Las imágenes originales de la aplicación no se retocan. Los contactos solo reducen y reúnen capturas para inspección. Los archivos individuales permanecen disponibles en `antes/` y `despues/`.
