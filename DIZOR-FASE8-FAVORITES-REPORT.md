# FASE 8 — FAVORITES REPORT

## 1. Estado anterior

- **Sin wishlist real** en backend ni frontend.
- Navbar: corazón **disabled** (“Favoritos — próximamente”), solo slot visual (`HiOutlineHeart`).
- User model: sin campo `favorites`.
- Sin rutas `/favorites`, sin context, sin página `/favoritos`.
- ProductCard / PDP: sin control de favoritos.
- Analytics: sin `add_to_wishlist` / `remove_from_wishlist`.

## 2. Arquitectura elegida

**Opción A — simple:** `User.favorites: [ObjectId → Product]`.

- Persistencia solo para **usuario autenticado**.
- Sin guest wishlist en localStorage (esta fase).
- Guest → redirect a `/login?next=…`.
- Estado compartido: `FavoritesProvider` + carga única de IDs.

## 3. Modelo backend

En `User`:

```js
favorites: [{ type: ObjectId, ref: "Product" }]  // default []
```

Solo referencias. Nombre/precio/imagen se resuelven al listar con `formatProductPublic`.

## 4. Endpoints

Montados en `/api/favorites` (todos con `protect`):

| Método | Ruta | Rol |
|--------|------|-----|
| GET | `/api/favorites` | Lista productos activos + `favoriteIds` |
| GET | `/api/favorites/ids` | Solo IDs (hidratación ligera) |
| POST | `/api/favorites/:productId` | Add idempotente (`$addToSet`) |
| DELETE | `/api/favorites/:productId` | Remove (`$pull`) |

Validación: ObjectId, producto existente y `isActive`.

## 5. Seguridad/Auth

- Middleware `protect` existente.
- Solo `req.user.id` — imposible leer/modificar wishlist ajena.
- `formatUser` / `/auth/me` **no** expone `favorites`.
- Página `/favoritos`: `robots: noindex`.
- Analytics: `/favoritos` excluido de page_view.

## 6. Estado frontend

`FavoritesProvider` (dentro de `AuthProvider` + `CartProvider`):

- Carga `GET /favorites/ids` al autenticarse.
- Limpia al logout.
- Optimistic toggle + revert si falla API.
- Pending por `productId` (no bloquea toda la lista).

## 7. FavoritesContext/hook

API:

- `favoriteIds` (Set)
- `favoriteCount`
- `isFavorite(id)`
- `isPending(id)`
- `addFavorite` / `removeFavorite` / `toggleFavorite`
- `loading` / `hydrated` / `refresh` / `requireAuth`

## 8. Navbar

- Corazón → Link `/favoritos` (desktop + mobile).
- Icono filled si hay favoritos o ruta activa.
- Badge discreto solo si `count > 0` (estilo más contenido que carrito).

## 9. ProductCard

- `FavoriteButton` esquina superior derecha de la imagen.
- `stopPropagation` / `preventDefault` — no navega al PDP.
- Editorial: botón un poco más discreto.
- Badges siguen a la izquierda — no se tapan.

## 10. PDP

- Botón favorito junto al título (`product-detail__title-row`).
- Misma API / estado compartido.
- Sin rediseño del PDP.

## 11. Página Favoritos

- Ruta: `/favoritos`
- Reutiliza `ProductCard` + grid catálogo.
- Estados: loading, guest, vacío, error+reintentar, con productos.
- Al quitar favorito, la card desaparece vía filtro sobre `favoriteIds`.

## 12. Guest behavior

- Toggle → `/login?next=<ruta actual>`.
- `/favoritos` muestra CTA login + explorar catálogo.
- Login respeta `?next=` / `?redirect=` (rutas relativas seguras).

## 13. Optimistic UI

Sí: UI actualiza al instante; API falla → revert.

## 14. Error handling

- Toggle: revert visual.
- Página: mensaje + Reintentar.
- Sin librería toast nueva.

## 15. Analytics

- `trackAddToWishlist` / `trackRemoveFromWishlist` (GA4 `add_to_wishlist` / `remove_from_wishlist`).
- Misma tubería `trackEvent` + consent.

## 16. Performance

Confirmado:

- **Una** carga de IDs por sesión/login (`/favorites/ids`).
- **No** hay request por ProductCard.
- Home Fase 3 / catálogo Fase 7 / Hero / CSS splitting **intactos**.
- Sin librerías nuevas (`react-icons/hi2` ya existía).

## 17. Responsive

- Navbar mobile mantiene `☰ | logo | 🔍 | ♡ | 🛒`.
- Corazón en card no cubre badges.
- Grid favoritos = mismo `products-grid`.

## 18. Accessibility

- `<button>` con `aria-pressed`, `aria-label` dinámico (“Agregar/Quitar {nombre}…”).
- Focus visible.
- Navbar: `aria-label` con conteo cuando hay badge.

## 19. Casos probados

| Caso | Estado |
|------|--------|
| Build frontend | PASS |
| Lint archivos Fase 8 | PASS |
| Backend modules load | PASS |
| Lógica add/remove/idempotente | Cubierta en código |
| Guest → login next | Cubierta |
| Logout limpia estado | Cubierta |
| Validación visual E2E con sesión real | Pendiente revisión usuario |

## 20. Build

```
frontend npm run build → PASS (incluye /favoritos)
```

## 21. Lint

```
eslint (archivos Fase 8) → PASS (--max-warnings 0)
```

## 22. Backend validation

- ObjectId inválido → 400
- Producto inexistente/inactivo → 404
- Auth requerida → 401
- `$addToSet` / `$pull` evitan duplicados
- Listado limpia refs huérfanas/inactivas

## 23. Riesgos

1. Sin sync multi-tab (documentado; no realtime).
2. Guest no puede “guardar intención” de producto más allá del redirect `next`.
3. Productos inactivos se ocultan y se podan del array; agotados **sí** se muestran.
4. Flash breve vacío hasta hidratar IDs tras login (mitigado con `hydrated`).

## 24. Pendientes

- Guest wishlist temporal (localStorage merge al login) — fuera de scope.
- Admin view de wishlists — no.
- Sync BroadcastChannel entre tabs — no.
- Fase 9 tipografía / Fase 10 motion / Fase 11 QA — **no iniciadas**.

### Política productos

| Estado | Comportamiento |
|--------|----------------|
| Eliminado / inactivo | No listar; podar de `favorites` |
| Agotado | Sigue en favoritos (badge Agotado vía ProductCard) |

### Multi-tab

Sin sincronización entre pestañas. Refresh o re-login carga backend.

---

## ADDENDUM — Guest wishlist (cierre Fase 8)

### Comportamiento invitado
- Favoritos sin login, igual que el carrito.
- Persistencia: `localStorage` clave `dizor_favorites_v1` (solo IDs).
- Navbar badge también para invitados.
- Página `/favoritos` lista productos vía `GET /products?ids=…`.

### Merge al login / registro
- `PUT /api/favorites/sync` con IDs locales → unión con wishlist del usuario.
- Luego se limpia el storage local.
- Solo productos activos se conservan.

### Tras compra
- En checkout, al crear el pedido con éxito: `removePurchasedFromFavorites(productIds)`.
- Invitado: se actualiza localStorage.
- Autenticado: `POST /api/favorites/remove-many`.

### Endpoints nuevos
| Método | Ruta | Uso |
|--------|------|-----|
| PUT | `/api/favorites/sync` | Merge guest → user |
| POST | `/api/favorites/remove-many` | Quitar varios (compra) |

### Cookies policy
Documentado `dizor_favorites_v1` en política de cookies.
