# D2 — Migrar API legacy (`jellyfin-apiclient` → `@jellyfin/sdk`)

## ¿Qué es?

El código tiene **dos APIs paralelas**: la vieja (`jellyfin-apiclient`, sin tipos, sin mantenimiento) y la nueva (`@jellyfin/sdk`, tipada, oficial). Conviven, pero ~278 llamadas a la vieja siguen esparcidas por ~50 archivos. D2 es migrarlas todas y eliminar la dependencia legacy.

## ¿Qué mejora en la práctica?

- **Tipado real.** SDK devuelve tipos de verdad. Si una API cambia, el compilador avisa. Con `jellyfin-apiclient` todo es `any`: un campo mal escrito da `undefined` en producción sin que nadie se entere.
- **Menos código.** Las ~278 llamadas legacy se reemplazan por ~200 llamadas SDK más concisas. El wrapper `compat.ts` (que convierte un cliente legacy a SDK para poder usar ambos) desaparece. Los módulos `lib/jellyfin-apiclient/` y `utils/jellyfin-apiclient/` se eliminan enteros.
- **Una sola forma de hacer las cosas.** Hoy hay patrones distintos para lo mismo: `apiClient.getItem()`, `getItemsApi(api).getItems()`, `fetch()` con cabeceras a mano. Después de D2 solo hay SDK.
- **Menos imports raros.** `ServerConnections`, `window.ApiClient`, `jellyfin-apiclient` dejan de importarse. Todo pasa por `@jellyfin/sdk`.
- **Menos riesgo al actualizar.** `jellyfin-apiclient` no sigue los cambios del servidor. El SDK sí. Si jellyfin 11 cambia un endpoint, el SDK lo refleja; el legacy no.

## Estrategia

De fuera hacia dentro: **consumidores primero, infraestructura al final**. Cada consumidor se migra solo porque el puente `compat.ts` permite obtener un SDK `Api` desde un cliente legacy; no hace falta esperar a que `connectionManager.js` se haya tocado.

Cada migración sigue el mismo patrón:
```typescript
// ANTES (legacy)
const apiClient = ServerConnections.getApiClient(serverId);
const item = await apiClient.getItem(userId, itemId);

// DESPUÉS (SDK)
const api = ServerConnections.getApi(serverId);
const item = (await getItemsApi(api).getItems({ userId, ids: [itemId] })).data;
```

## Subtareas

### Fase 1 — Consumidores pequeños (1-3 llamadas c/u)

- [ ] **Utilidades de imagen**: `backdropImage.ts` (3), `image.ts` (5), `getNowPlayingImageUrl.ts` (6)
- [ ] **Utilidades de items**: `getItems.ts` (3), `itemsByName.js` (2), `deleteHelper.js` (3)
- [ ] **Elementos emby-***: `emby-ratingbutton.js` (2), `emby-playstatebutton.js` (2), `emby-itemscontainer.js` (8), `emby-itemrefreshindicator.js` (1)
- [ ] **Scripts sueltos**: `taskbutton.js` (1), `libraryMenu.js` (1), `dashboard.js` (2)
- [ ] **Componentes varios**: `filterdialog.js` (2), `filtermenu.js` (2), `groupedcards.js` (2), `channelMapper.js` (1), `directorybrowser.js` (2), `mediaLibraryCreator.js` (1), `refreshdialog.js` (1), `userdatabuttons.js` (2), `playlistViewer.js` (3)
- [ ] **Card builder**: `cardBuilder.js` (3), `cardImage.ts` (1), `chaptercardbuilder.js` (1), `listview.js` (2)
- [ ] **Backdrop**: `backdrop.js` (2), `autoBackdrops.js` (2)
- [ ] **Dashboard con `window.ApiClient`**: `Access.tsx` (6), `UserCardBox.tsx` (1), `UserPasswordForm.tsx` (2), `ParentalControl.tsx` (1)

### Fase 2 — Consumidores medianos (4-19 llamadas c/u)

- [ ] `imageeditor.js` (9)
- [ ] `multiSelect.js` (8)
- [ ] `guide.js` (6)
- [ ] `shortcuts.js` (5)
- [ ] `session.ts` (6)
- [ ] `itemContextMenu.js` (13)
- [ ] `notifications.js` (19)
- [ ] `serverNotifications.js` (9)
- [ ] `audioStreamUrl.ts` (4) — ya extraído en D1, pendiente de migrar
- [ ] `mediaResolution.ts` (7) — ya extraído en D1, pendiente de migrar

### Fase 3 — Consumidor grande

- [ ] `playbackmanager.js` (29 llamadas) — migrar `getEndpointInfo`, `getCurrentUser`, `getItem`, `getEpisodes`, `getUrl`, `deviceId`, `accessToken`, `getLocalTrailers`, `getInstantMixFromItem`, `stopActiveEncodings`

### Fase 4 — Infraestructura (al final, cuando ya nadie use legacy)

- [ ] Reescribir `connectionManager.js` para crear SDK `Api` directamente sin pasar por `ApiClient` legacy
- [ ] Simplificar `ServerConnections.js` como wrapper fino del SDK
- [ ] Eliminar `compat.ts` (el puente ya no hace falta)
- [ ] Eliminar `createApiClient.ts`
- [ ] Eliminar dependencia `jellyfin-apiclient` de `package.json`
- [ ] Eliminar `src/lib/jellyfin-apiclient/` y `src/utils/jellyfin-apiclient/`
- [ ] Limpiar `global.d.ts` (quitar `window.ApiClient`, `window.Events`)
