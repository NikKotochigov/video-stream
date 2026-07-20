# Этап 4 — Speaker notes: Canvas & captureStream

**Общее время:** ~12 мин  
**Demo:** Шаг 3 — `localhost:5173` (нужен live video track с Шага 1)  
**Переход:** «Canvas тянет кадр в CPU. Есть API поточнее — Insertable Streams» → Шаг 4

**Формат:** На стриме → Под капотом → В нашем коде → Зритель должен унести

---

**Общее время:** ~12 мин 
**Demo:** Шаг 3 — `localhost:5173` (нужен live video track с Шага 1) 
**Переход:** «Canvas тянет кадр в CPU. Есть API поточнее — Insertable Streams» → Шаг 4
## База — что такое Canvas

> Этот блок — **до **. Одна мысль: **Canvas — рисовальная доска в пикселях**, не видеоплеер.

### На стриме

> **Canvas** — HTML-элемент и API для **рисования в браузере**: линии, текст, картинки, кадры с video. Это **bitmap** фиксированного размера (`width` × `height` в пикселях). Мы сами решаем, **что** нарисовать на каждом кадре.

> Для видео с камеры Canvas **не заменяет** `<video>`. Схема: `<video>` показывает/держит поток → мы **копируем** кадр на canvas → с canvas снимаем **новый** поток через `captureStream()`.

### Под капотом — `<canvas>` в HTML

```html
<canvas width="1280" height="720"></canvas>
```

| Свойство | Смысл |
|----------|--------|
| `width` / `height` | Размер **bitmap в пикселях** (не CSS!) |
| CSS `width` / `height` | Только **масштаб отображения** на странице |
| По умолчанию | Пустой, прозрачный/чёрный — пока не нарисовали |

**Важно:** если менять `canvas.width` / `canvas.height` в JS — содержимое **сбрасывается**. В demo размер синхронизируем с `video.videoWidth` / `video.videoHeight` один раз при смене разрешения.

### Под капотом — 2D context: «кисть»

Рисовать через **контекст**, не через сам элемент:

```js
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(10, 10, 100, 50);
```

`CanvasRenderingContext2D` — набор команд: прямоугольники, пути, текст, **картинки**, трансформации, фильтры.

В demo: `getContext('2d', { alpha: false })` — без альфа-канала, чуть проще для сплошного video frame.

### Под капотом — Canvas vs `<video>`

| | `<video>` | `<canvas>` |
|---|-----------|------------|
| Роль | **Плеер** потока/файла | **Холст** для рисования |
| Данные | MediaStream / URL, браузер декодирует | Мы рисуем командами или `drawImage` |
| Live с камеры | `srcObject = stream` — нативно | Сам поток **не принимает**; кадры **копируем** |
| Показать результат | `srcObject` на output `<video>` | Содержимое canvas → `captureStream()` → `srcObject` |

**Не путать:** Input preview в demo — обычный `<video>`. Canvas в demo **скрыт** (`pipeline-canvas`) — зритель видит output через второй `<video>`, не сам canvas.

### Под капотом — `drawImage` для video

Главная операция для нашего pipeline:

```js
ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
```

- `sourceVideo` — `<video>` с `srcObject = cameraStream` (в demo — скрытый `pipeline-source-video`).
- Берёт **текущий декодированный кадр** из video element.
- Рисует его на bitmap canvas **целиком** (с масштабом под размер canvas).

Это **копирование** пикселей (CPU/GPU) — на каждом вызове в rAF loop.

Перед `drawImage` в demo:

```js
ctx.filter = 'grayscale(100%)'; // CSS-фильтр как в стилях
```

Фильтр применяется **при отрисовке** этого draw — не меняет исходный stream камеры.

### Под капотом — `canvas.captureStream(fps)`

Метод HTMLCanvasElement:

```js
const outputStream = canvas.captureStream(30);
// → MediaStream с video track, «смотрящим» на canvas
```

- Браузер **периодически** читает содержимое canvas и отдаёт как **живой** video track.
- `fps` — желаемая частота **выхода** (в demo — slider).
- **Новый** MediaStream — не тот же, что с камеры. Камера в `StreamContext` **не трогается**.

Цепочка в demo:

```
camera MediaStream
 → hidden <video> (decode)
 → rAF: drawImage + filter
 → canvas bitmap
 → captureStream(fps)
 → output MediaStream
 → VideoPreview Output
```

### Под капотом — зачем скрытые `<video>` и `<canvas>`

В `Step3CanvasProcessing.tsx`:

- **Скрытый video** — источник для `drawImage` (тот же stream, что и Input preview).
- **Скрытый canvas** — рабочая поверхность; в UI показываем **Output** через `VideoPreview`.
- **`aria-hidden`** — скринридер не объявляет второй плеер; на pipeline не влияет.

Два видимых preview (Input / Output) — для зрителя. Два скрытых элемента — для **механики** pipeline.

### Под капотом — immediate mode

Canvas 2D — **immediate mode**: нарисовал `fillRect` — пиксели изменились. Нет сцены с объектами, которые «живут» сами. Каждый кадр video мы **перерисовываем** canvas заново (`drawImage` поверх всего bitmap).

Для live video это нормально: каждый rAF — свежий кадр с камеры.

### В нашем коде

| Файл | Роль |
|------|------|
| `lib/effects.ts` | `startCanvasPipeline()` — context, rAF, `drawImage`, `captureStream` |
| `Step3CanvasProcessing.tsx` | UI, скрытые video/canvas, два `VideoPreview` |
| `index.css` | `.pipeline-canvas`, `.pipeline-source-video` — 0×0, невидимы |

### Зритель должен унести

> **Canvas** — bitmap-холст: рисуем кадры сами. **Video** — плеер потока. Для обработки камеры: video → `drawImage` → canvas → `captureStream()` → новый MediaStream.

---

## Обработка кадра

### На стриме

> На Шагах 1–2 мы **получили** поток и **управляли** треками. Теперь — **изменить картинку**: фильтр, watermark, зеркало. Классический путь в браузере — **Canvas**.

> Идея простая: на каждом кадре взять картинку с `<video>`, нарисовать на `<canvas>`, а с canvas снять **новый** `MediaStream` через `captureStream()`.

### Под капотом — зачем не «редактировать» camera track

`MediaStreamTrack` с камеры — **read-only поток** от устройства. Мы не можем «вшить» grayscale в сам трек камеры.

Паттерн:

```
camera stream (оригинал, не трогаем)
 │
 ▼
 обработка → НОВЫЙ stream (canvas.captureStream)
 │
 ▼
 preview / WebRTC / запись
```

Оригинальная камера **продолжает работать**. На выходе — **отдельный** поток. В WebRTC позже можно `replaceTrack` на обработанный.

### Под капотом — аналогия

| Этап | Аналогия |
|------|----------|
| `<video srcObject=camera>` | Монитор с live-камерой |
| `drawImage` | Сфотографировать кадр и положить на стол |
| Фильтр на canvas | Обработать фото |
| `captureStream()` | Снять «трансляцию стола» — новый поток |

### В нашем коде

Шаг 3: два preview — **Input** (камера из `StreamContext`) и **Output** (поток с canvas).

### Зритель должен унести

> Обработка = **новый** MediaStream. Камера и canvas output — **два разных** потока.

---

## Pipeline в коде

### На стриме

> Разберём минимальный pipeline. Скрытый `<video>` держит `srcObject` с камеры. В цикле — `drawImage`. Потом `captureStream(30)` — и второй `<video>` показывает результат.

### Под капотом — `drawImage`

```js
ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
```

- Берёт **текущий декодированный кадр** из video element.
- Рисует на canvas bitmap.
- Это **копирование** пикселей CPU/GPU — не бесплатно на 1080p60.

**Размер canvas** должен совпадать с кадром (или масштабировать осознанно). В demo синхронизируем `canvas.width/height` с `video.videoWidth/videoHeight`.

### Под капотом — CSS-фильтры на canvas

```js
ctx.filter = 'grayscale(100%)';
ctx.drawImage(...);
```

Браузер применяет фильтр при отрисовке — **быстрее**, чем вручную менять каждый пиксель в JS.

Доступны: `grayscale`, `sepia`, `invert`, `blur`, `brightness`, … — как в CSS.

### Под капотом — `canvas.captureStream(fps)`

```js
const outputStream = canvas.captureStream(30);
```

- Возвращает **`MediaStream`** с одним video track.
- Track читает **содержимое canvas** с заданной частотой.
- `fps` — **желаемая** частота выхода; браузер может отдавать иначе.
- **Не останавливает** камеру. Останавливается при `outputStream.getTracks().forEach(t => t.stop())`.

### В нашем коде

- `lib/effects.ts` — `startCanvasPipeline()`: rAF loop + `captureStream`.
- `Step3CanvasProcessing.tsx` — кнопки фильтров, slider FPS, панель stats.
- Скрытые: `<video class="pipeline-source-video">` + `<canvas class="pipeline-canvas">`.

### Live demo

1. Открыть Шаг 3 (камера с Шага 1). 
2. Input — цветное, Output — пока то же (фильтр «Нет»). 
3. **Grayscale** → output серый, input цветной. 
4. **Invert** → негатив на output.

### Зритель должен унести

> `drawImage` + `captureStream` — минимальный рабочий pipeline обработки в браузере.

---

## Как крутить loop

### На стриме

> Как часто вызывать `drawImage`? Обычно — `requestAnimationFrame`. А `captureStream` задаёт отдельно, сколько кадров **уходит наружу**.

### Под капотом — два разных fps

| Понятие | Что означает |
|---------|--------------|
| **Draw fps** | Как часто крутим `drawImage` (rAF, ~60 на активной вкладке) |
| **Capture fps** | Аргумент `captureStream(n)` — частота **выходного** track |

Можно рисовать 60 раз/сек, а `captureStream(15)` — наружу 15 fps. Canvas обновляется часто, потребители получают реже.

### Под капотом — `requestAnimationFrame`

- Синхронизирован с compositor (~60 Hz).
- Во **фоновой вкладке** throttle → draw fps падает.
- Стандарт для анимации и video processing в UI.

**`setInterval`:** проще для демо, но может drift и не паузится корректно с вкладкой.

### Под капотом — смена capture fps

При изменении slider **пересоздаём** pipeline: `captureStream(fps)` фиксируется при создании. В demo — `useEffect` на `[captureFps]`.

Фильтр меняется **без** пересоздания — через `getFilterCss()` ref в draw loop.

### В нашем коде

Панель Pipeline:

- `draw loop: ~N fps (rAF)` — реальный счётчик из `getDrawFps()`.
- `captureStream: M fps (задано)` — значение slider.

### Live demo

1. Slider **30 → 5** — output дёргается, input плавный. 
2. Обратно **30** — output оживает. 
3. Проговорить: «Это цена fps и CPU, не баг камеры».

### Зритель должен унести

> Draw loop и capture fps — **разные рычаги**. rAF для отрисовки, `captureStream(n)` для выходного потока.

---

## Ограничения Canvas

### На стриме

> Canvas — универсальный, но не бесплатный. На 1080p каждый кадр — копия через CPU. Для blur на каждом пикселе на 30 fps — уже больно.

### Под капотом — где тратится время

```
Камера → decode (video element)
 → drawImage (read + write bitmap)
 → filter (GPU/CPU)
 → captureStream encode (внутри браузера)
 → output video decode + render
```

**Узкие места:**

| Фактор | Эффект |
|--------|--------|
| 1080p vs 720p | ~2.25× пикселей |
| 60 vs 30 capture fps | ~2× кадров наружу |
| CSS blur в filter | Дороже grayscale |
| Pixel loop в JS | Очень дорого — избегать на live |

### Под капотом — связь с dropped frames

Если draw + capture не успевают:

- output video **дёргается**;
- растёт задержка между input и output;
- в prod — снижают разрешение или fps, уходят на Insertable Streams / GPU / Worker.

### Под капотом — когда Canvas всё же ок

- Watermark, timestamp overlay.
- Grayscale / sepia для превью.
- Простое зеркало (`scale(-1, 1)`).
- Прототипы и обучение (наш demo).

### В нашем коде

Один input preview + один output — **два** decode/render path. На слабом ноутбуке при 1080p может быть заметно. Для стрима достаточно 720p с Шага 1.

### Зритель должен унести

> Canvas — **копия каждого кадра**. Для лёгких эффектов — ок. Для blur/VB на prod — ищут поточные API.

---

## Canvas vs Insertable Streams

### На стриме

> Grayscale на Canvas — норм. Blur на весь кадр 30 fps — уже нагрузка. В Chrome есть **Insertable Streams**: `VideoFrame` без лишнего `drawImage`. Это Шаг 4.

### Под капотом — сравнение

| | Canvas | Insertable Streams |
|---|--------|-------------------|
| Поддержка | Везде | Chrome-first, проверять Firefox/Safari |
| Единица работы | Пиксели bitmap | `VideoFrame` |
| Типичный copy | `drawImage` (полная копия) | Меньше лишних копий при правильном pipeline |
| `frame.close()` | Не нужно | **Обязательно** — иначе memory leak |
| Fallback | — | Вернуться на Canvas (Шаг 3) |

### Под капотом — мост к WebRTC

На Шаге 5 в loopback пойдёт **обработанный** track:

```js
pc.addTrack(outputStream.getVideoTracks()[0], outputStream);
```

Сейчас важно: мы умеем получить **готовый к отправке** поток, не только сырой с камеры.

### Переход

> Pipeline с Canvas работает. Дальше — тот же смысл, но через `MediaStreamTrackProcessor` и `VideoFrame`. **Шаг 4**.

---

## Demo — полный сценарий

### Порядок действий

1. Шаг 1 → запросить камеру (720p достаточно). 
2. Шаг 3 → Input и Output горят. 
3. Grayscale → Sepia → Invert → Нет. 
4. FPS 30 → 10 → 5 → обратно 30. 
5. Панель: draw fps vs capture fps. 
6. → Шаг 4.

### Под капотом — поток данных на Шаге 3

```
StreamContext.stream
 │
 ├─► VideoPreview Input (srcObject)
 ├─► hidden video (drawImage source)
 │
 ▼
 canvas rAF loop + filter
 │
 ▼
 captureStream(fps) → outputStream
 │
 └─► VideoPreview Output (srcObject)
```

Камера **одна** в контексте. Output — **второй** MediaStream.

### Если что-то сломалось

| Симптом | Проверка |
|---------|----------|
| Output чёрный | Камера жива на Шаге 1? `readyState: live`? |
| Output = input без фильтра | Фильтр «Нет» — ожидаемо |
| Output рывками | Понизить capture fps / 720p |
| Input есть, output нет | DevTools console, перезайти на шаг |

---

## Шпаргалка

| Вопрос | Ответ |
|--------|--------|
| Что такое Canvas? | HTML-холст + 2D API для рисования в пикселях; не плеер |
| Canvas принимает MediaStream? | Нет напрямую; кадры копируем через `drawImage(video)` |
| Меняем camera track? | Нет, создаём **новый** stream с canvas |
| Зачем скрытый video? | Источник для `drawImage` (можно и видимый) |
| draw fps vs capture fps? | rAF рисует vs `captureStream(n)` отдаёт |
| Почему пересоздаём pipeline при смене fps? | `captureStream(fps)` фиксируется при создании |
| Фильтр без пересоздания? | `getFilterCss()` ref в draw loop |
| Остановка output | `outputStream.getTracks().forEach(t => t.stop())` |
| Canvas для blur? | Возможно, но тяжело → Insertable Streams |

---

---
