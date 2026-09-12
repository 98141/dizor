# Dizor — Pausas visuales Home (editorial breaks)

## Qué son

Bloques **solo fotografía** (sin título, párrafo ni CTA) que rompen secuencias largas de contenido comercial/textual en Home.

## Ubicaciones

| Slot CMS (`seccion`) | Posición en Home |
|----------------------|------------------|
| `editorial1` | Entre **Descubre hoy** y **Personalización** |
| `editorial2` | Entre **Reseñas** e **Inspiración** |

Si una sección no tiene imágenes activas, el componente **no renderiza** (no deja hueco).

## Composiciones

- **1 imagen:** panorámica full-bleed (desktop ~21:9 / 2.6:1; móvil ~4:5).
- **2 imágenes:** desktop asimétrico; móvil scroll-snap horizontal (máx. 2). Máximo CMS: **2** por slot.

## Performance

- Below-the-fold, **sin** `priority`.
- `next/image` + `sizes` + `aspect-ratio` reservado.
- Suspense con `fallback={null}` para no reservar altura cuando el CMS está vacío.

## Admin

Pestañas en **Home → Imágenes**:

- Pausa editorial 1
- Pausa editorial 2

Subir fotos temporales está bien para validar crop/ritmo; luego sustituir por fotografía profesional **sin cambiar layout**.

## Extensiones futuras (Fase 5+, opcional)

- Crop desktop/móvil diferenciado en CMS.
- `object-position` administrable.
- Tercera pausa solo si el ritmo lo exige (hoy máximo 2).
