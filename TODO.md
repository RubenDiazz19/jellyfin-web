# TODO - Reorganización y Limpieza del Proyecto

## Visión general

Reorganizar y limpiar la estructura de archivos de todo el proyecto: frontend,
legacy y dashboard. Separar responsabilidades, eliminar duplicaciones y corregir
violaciones de arquitectura.

---

## Fase 1: Frontend - MVVM + Hooks + Controls

### 1.1 Consolidar `useAsyncAction` → `useAsyncToast`

`domain/hooks/useAsyncAction.ts` importa `useToast` de `presentation/`, violando
la arquitectura MVVM. Además, `useAsyncAction` y `useAsyncToast` hacen lo mismo.

- **Eliminar:** `domain/hooks/useAsyncAction.ts`
- **Eliminar:** `domain/hooks/__tests__/useAsyncAction.test.ts`
- **Migrar consumidor:** `presentation/components/controls/AddToDialog.tsx` → usar
  `useAsyncToast` en vez de `useAsyncAction`
- `useAsyncToast` ya es más completo (soporta `successMessage` como función,
  `onSuccess`, `onError`)

### 1.2 Mover hooks sueltos de `pages/` a `presentation/hooks/`

- `presentation/pages/useDetailEntity.ts` → `presentation/hooks/useDetailEntity.ts`
- `presentation/pages/useHomeScrollTransition.ts` →
  `presentation/hooks/useHomeScrollTransition.ts`
- Actualizar imports en:
  - `presentation/pages/MoviePage.tsx`
  - `presentation/pages/SeasonPage.tsx`
  - `presentation/pages/EpisodePage.tsx`
  - `presentation/pages/ShowPage.tsx`
  - `presentation/pages/HomePage.tsx`
  - `presentation/components/layout/DetailHero.tsx`
  - `presentation/pages/__tests__/useDetailEntity.test.tsx`
  - `presentation/pages/__tests__/useHomeScrollTransition.test.tsx`

### 1.3 Separar utilidades de ViewModels

`domain/viewModels/` mezcla 20 ViewModels con 7 módulos utilidad. Crear
subdirectorio `utils/`:

- Crear `domain/viewModels/utils/`
- Mover:
  - `guardedLoad.ts`
  - `loadGuard.ts`
  - `loadingState.ts`
  - `mutationSubscription.ts`
  - `knownTags.ts`
  - `searchTags.ts`
  - `searchViews.ts`
- Mover tests correspondientes a `domain/viewModels/utils/__tests__/`
- Actualizar imports en ViewModels y tests que las usen

### 1.4 Dividir `presentation/components/controls/` (41 entradas)

```
controls/
├── dialogs/
│   ├── ConfirmDialog.tsx
│   ├── Dialog.tsx
│   ├── AddToDialog.tsx
│   ├── TagsDialog.tsx
│   ├── BulkTagsDialog.tsx
│   ├── MoreDialogs.tsx
│   ├── ColorPickerDialog.tsx
│   ├── CreateCollectionDialog.tsx
│   └── __tests__/
├── buttons/
│   ├── FavButton.tsx
│   ├── IconButton.tsx
│   ├── MoreButton.tsx
│   ├── PlayBtn.tsx
│   ├── TextButton.tsx
│   ├── MyListButton.tsx
│   └── __tests__/
├── toggles/
│   ├── PillToggle.tsx
│   ├── SelectToggle.tsx
│   ├── WatchedToggle.tsx
│   ├── WatchedToggleIcon.tsx
│   ├── WatchedButton.tsx
│   ├── MovieWatchedButton.tsx
│   ├── SeasonWatchedButton.tsx
│   ├── ShowNavWatchedButton.tsx
│   └── __tests__/
├── menus/
│   ├── ItemMenuList.tsx
│   ├── ListCardMenu.tsx
│   ├── MenuEntry.tsx
│   ├── moreMenuBuilder.ts
│   └── __tests__/
├── EditableTitle.tsx
├── fields.tsx
├── LoadState.tsx
├── PopupPanel.tsx
├── Progress.tsx
├── SelectionBar.tsx
├── SortControl.tsx
├── TabBar.tsx
├── TagEditor.tsx
├── WatchedBadge.tsx
├── useItemActions.ts
├── useItemContextMenu.tsx
├── useSelectionMode.ts
└── useWatchedToggle.ts
```

---

## Fase 2: Legacy - Consolidación

### 2.1 Directorios de un solo archivo → mover a raíz de `components/`

| De                              | A                              | Consumidores |
|---------------------------------|--------------------------------|--------------|
| `confirm/confirm.ts`            | `components/confirm.ts`        | 8            |
| `refreshdialog/refreshdialog.js`| `components/refreshdialog.js`  | 1            |
| `playlisteditor/playlisteditor.ts` | `components/playlisteditor.ts` | 0          |
| `lazyLoader/lazyLoaderIntersectionObserver.js` | `components/lazyLoader.ts` | 1   |

Eliminar los directorios vacíos después de mover.

### 2.2 Renombrar directorios a camelCase consistente

| De                       | A                           |
|--------------------------|-----------------------------|
| `imageeditor/`           | `imageEditor/`              |
| `filterdialog/`          | `filterDialog/`             |
| `filtermenu/`            | `filterMenu/`               |
| `listview/`              | `listView/`                 |
| `libraryoptionseditor/`  | `libraryOptionsEditor/`     |

Actualizar todos los imports que referencien estos directorios.

### 2.3 Unificar SCSS: `style.scss` → `{feature}.scss`

| De                                       | A                                              |
|------------------------------------------|------------------------------------------------|
| `alphaPicker/style.scss`                 | `alphaPicker/alphaPicker.scss`                 |
| `filterdialog/style.scss`                | `filterDialog/filterDialog.scss`               |
| `images/style.scss`                      | `images/images.scss`                           |
| `libraryoptionseditor/style.scss`        | `libraryOptionsEditor/libraryOptionsEditor.scss`|
| `imageUploader/style.scss`               | `imageUploader/imageUploader.scss`             |
| `mediaLibraryCreator/style.scss`         | `mediaLibraryCreator/mediaLibraryCreator.scss` |
| `mediaLibraryEditor/style.scss`          | `mediaLibraryEditor/mediaLibraryEditor.scss`   |

Actualizar los imports de SCSS en los archivos que los referencien.

---

## Fase 3: Dashboard - Limpieza Menor

### 3.1 Corregir `networking/`

- `features/networking/utils.ts` → `features/networking/utils/uriUtils.ts`

### 3.2 Unificar nombres de constants

- `features/plugins/constants/categoryLabels.ts` →
  `features/plugins/constants/pluginCategoryLabels.ts`

---

## Fase 4: Verificación

```bash
bun run build:check   # typecheck
bun run lint          # ESLint
bun run test          # tests
```

Nada se da por terminado hasta que los tres pasen limpios.

---

## Estadísticas estimadas

| Concepto             | Cantidad |
|----------------------|----------|
| Archivos movidos     | ~80      |
| Imports actualizados | ~20      |
| Hooks consolidados   | 2 → 1    |
| Tests eliminados     | 1        |
| Directorios creados  | 10       |
| Directorios eliminados | 5      |
