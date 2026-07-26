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
const item = (await getLibraryApi(api).getItem({ itemId, userId })).data;
```

En esta versión del SDK los listados de items viven en `getLibraryApi`, no en
un `getItemsApi`. Los consumidores que necesitan el id del usuario lo piden a
`ServerConnections.getCurrentUserId(serverId)` en vez de sacarlo del cliente
legacy; en la fase 4 esa función deja de mirar al `ApiClient`.

## Subtareas

### Fase 1 — Consumidores pequeños (1-3 llamadas c/u)

- [x] **Utilidades de imagen**: `backdropImage.ts` (3), `image.ts` (5), `getNowPlayingImageUrl.ts` (6)
- [x] **Utilidades de items**: `getItems.ts` (3), `itemsByName.js` (2), `deleteHelper.js` (3)
- [x] **Elementos emby-***: `emby-ratingbutton.js` (2), `emby-playstatebutton.js` (2), `emby-itemscontainer.js` (8), `emby-itemrefreshindicator.js` (1)
- [x] **Scripts sueltos**: `taskbutton.js` (1), `libraryMenu.js` (1), `dashboard.js` (2)
- [x] **Componentes varios**: `filterdialog.js` (2), `filtermenu.js` (2), `groupedcards.js` (2), `channelMapper.js` (1), `directorybrowser.js` (2), `mediaLibraryCreator.js` (1), `refreshdialog.js` (1), `userdatabuttons.js` (2), `playlistViewer.js` (3)
- [x] **Card builder**: `cardBuilder.js` (3), `cardImage.ts` (1), `chaptercardbuilder.js` (1), `listview.js` (2)
- [x] **Backdrop**: `backdrop.js` (2), `autoBackdrops.js` (2)
- [x] **Dashboard con `window.ApiClient`**: `Access.tsx` (6), `UserCardBox.tsx` (1), `UserPasswordForm.tsx` (2), `ParentalControl.tsx` (1)

### Fase 2 — Consumidores medianos (4-19 llamadas c/u)

- [x] `imageeditor.js` (9)
- [x] `multiSelect.js` (8)
- [x] `guide.js` (6)
- [x] `shortcuts.js` (5)
- [x] `session.ts` (6)
- [x] `itemContextMenu.js` (13)
- [x] `notifications.js` (19)
- [x] `serverNotifications.js` (9)
- [x] `audioStreamUrl.ts` (4) — ya extraído en D1, pendiente de migrar
- [x] `mediaResolution.ts` (7) — ya extraído en D1, pendiente de migrar

### Fase 3 — Consumidor grande

- [x] `playbackmanager.js` (29 llamadas) — migrar `getEndpointInfo`, `getCurrentUser`, `getItem`, `getEpisodes`, `getUrl`, `deviceId`, `accessToken`, `getLocalTrailers`, `getInstantMixFromItem`, `stopActiveEncodings`

### Fase 4 — Infraestructura (al final, cuando ya nadie use legacy)

**Consumidores fuera de la capa de conexión** — hecho:

- [x] Los que no estaban en las listas de las fases 1-3 pero seguían con
      `ApiClient`: `playbackReporting.ts`, `playlisteditor.ts`,
      `imageUploader.js`, `imageDownloader.js`, `appRouter.js`,
      `mediaSegmentManager.ts`, `getNowPlayingName.ts`, `autocast.js`,
      `userSettings.js`, `libraryMenu.js`, `http.ts`, `useApi.tsx`,
      `taskbutton.js`, `LibraryCard.tsx`, `Provider.tsx`
- [x] `ServerConnections` expone lo que el SDK `Api` no sabe responder, para
      que los consumidores no tengan que bajar al cliente legacy:
      `getCurrentUserId`, `getCurrentServerId`, `getServerInfo`, `getServerIds`,
      `getApis`, `getUserInfo`
- [x] `useApi` deja de exponer `__legacyApiClient__` (nadie lo consumía)

**Capa de conexión** — pendiente:

- [ ] Reescribir `connectionManager.js` para crear SDK `Api` directamente sin pasar por `ApiClient` legacy
- [ ] Simplificar `ServerConnections.js` como wrapper fino del SDK
- [ ] Migrar lo que cuelga de esa capa: `ConnectionRequired.tsx`, `auth.ts`,
      `ServerContentPage.tsx`, `Dashboard.serverAddress()`, `serviceworker.js`
- [ ] Eliminar `compat.ts` (el puente ya no hace falta)
- [ ] Eliminar `createApiClient.ts`
- [ ] Eliminar dependencia `jellyfin-apiclient` de `package.json`
- [ ] Eliminar `src/lib/jellyfin-apiclient/` y `src/utils/jellyfin-apiclient/`
- [ ] Limpiar `global.d.ts` y `apiclient.d.ts` (quitar `window.ApiClient`, `window.Events`)

> Por qué queda pendiente: `connectionManager.js` son 846 líneas que guardan
> las credenciales, descubren y fusionan servidores, prueban direcciones y
> llevan `connect()` / `logout()` / `validateAuthentication()` / wake-on-LAN.
> No hay ni un test que lo cubra, y equivocarse ahí deja al usuario fuera de
> su servidor o le borra los servidores guardados. Es un trabajo aparte, con
> su propia red de pruebas, no un paso más de esta migración. Todo lo demás
> ya está en SDK: el cliente legacy solo sigue vivo dentro de esa capa.
