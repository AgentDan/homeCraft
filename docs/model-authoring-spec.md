# HomeCraft — Model Authoring Spec (glTF)

Контракт авторства 3D-моделей кухонных модулей.  
Цель: ручные `.glb` подставляются в текущий `ModuleBox` **без смены** pose-логики (`materializePlan` / позиция `position/1000 + size/2`).

Связано: [Roadmap.md](Roadmap.md) (фаза 1), [PROJECT_PASSPORT.md](PROJECT_PASSPORT.md).

---

## Необсуждаемые параметры

| Параметр | Значение |
|---|---|
| Формат | `.glb` (binary glTF 2.0), **один файл**; текстуры встроены |
| Имя файла | точный `sku` каталога → `apps/server/gltf/{sku}.glb` |
| URL | `/gltf/{sku}.glb` (static route уже смонтирован) |
| Бюджет геометрии | ≤ **15 000** треугольников |
| Бюджет файла | ≤ **2 МБ** |
| Единицы | **метры** |
| Ось вверх | **Y-up** |
| Система координат | правая |
| Origin | **геометрический центр** bounding box по X/Y/Z |
| Фасад при `rotationY = 0` | смотрит в **+Z** |
| Bounding box | равен `dimensions` каталога (`widthMm` / `heightMm` / `depthMm` → м) |
| Materials / slots | имена: `facade`, `carcass` |
| PBR | metallic-roughness; `metalness ≈ 0`; `roughness ≈ 0.6–0.8` |
| Запрещено в файле | light, camera |

---

## Почему origin = центр (не угол)

Клиент уже позиционирует модуль как центр бокса:

```text
position = (x/1000 + w/2, y/1000 + h/2, z/1000 + d/2)
```

Pose-math и `ModuleBox` **не пересматриваются** под corner-origin. Модель обязана совпадать с этой конвенцией: origin в центре bbox, размеры = каталог.

---

## Путь и контракты

- Наличие модели = наличие файла по `/gltf/{sku}.glb`.
- Поле `modelUri` / аналог в Zod (`ModuleSchema`, `SceneResultSchema`) **не добавляем**.
- Миниатюры (фаза 5): `/gltf/{sku}.png` рядом с `.glb`, та же иммутабельность.
- Пока один snapshot `kitchen-demo-v1`: путь без версии допустим **только если файл не подменяют**. Смена геометрии/материалов/превью = новый snapshot **и** новая path-policy (вне фаз 1–3).

---

## Авторство

- Модели делает **человек вручную** (Blender / аналог).
- Codegen и внешние asset-pack **не входят** в репозиторий.
- Homecraft-authored assets: отдельный трекинг лицензий не требуется.

### Метаданные (на будущее)

При приёме файла (фаза 2+) фиксировать вне схемы модели, например комментарий/CHANGELOG:

```text
SKU {sku}: glTF added — author: …; date: YYYY-MM-DD
```

Не URL-поле и не обязательное поле Zod.

---

## Валидация (фаза 2)

Перед merge нового `.glb`:

```bash
npm run validate:gltf
# или один SKU:
npm run validate:gltf -- BASE-600
```

Скрипт: `apps/server/scripts/validate-gltf.mjs`  
Проверяет: размер файла, tris, slots `facade`/`carcass`, отсутствие camera/light, bbox ≈ catalog (±10 mm), origin = центр bbox, фасад в +Z half-space.

Иммутабельность: не перезаписывать уже отданный `{sku}.glb` / `{sku}.png` под тем же snapshot. Журнал приёма: `apps/server/gltf/CHANGELOG.md`.

### Миниатюры (фаза 5)

```bash
npm run render:gltf-thumbs
# или один SKU:
npm run render:gltf-thumbs -- BASE-600
```

Скрипт: `apps/server/scripts/render-gltf-thumbnails.mjs` — three.js load + offscreen PNG; существующие файлы не перезаписывает.

---

## Вне скоупа этого документа

- Живой codegen моделей в приложении
- Изменения `ModuleSchema` / `SceneResultSchema` ради URI модели
