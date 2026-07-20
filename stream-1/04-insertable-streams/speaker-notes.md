# Этап 5 — Speaker notes: Insertable Streams

**Общее время:** ~10 мин  
**Demo:** Шаг 4 — `localhost:5173` (live video track с Шага 1)  
**Переход:** «Поток готов — отправим его по сети. WebRTC» → Шаг 5

**Формат:** На стриме → Под капотом → В нашем коде → Зритель должен унести

---

**Общее время:** ~10 мин 
**Demo:** Шаг 4 — `localhost:5173` (live video track с Шага 1) 
**Переход:** «Поток готов — отправим его по сети. WebRTC» → Шаг 5
## База — суть Insertable Streams

> Блок **до **. Одна мысль: **вставить свою обработку в живой track** — кадр за кадром, без обязательного video → canvas → captureStream.

### На стриме

> **Insertable Streams** — API, которое позволяет **вклиниться в живой `MediaStreamTrack`** и обрабатывать кадры **по одному**, как поток данных.

> Идея: взять кадры с трека → прогнать через свой код → отдать **новый** трек дальше (preview, WebRTC, запись). Камеру не «переписываем» — строим **второй** поток.

### Под капотом — зачем это появилось

До Insertable типичный путь (Шаг 3):

```
камера → <video> → drawImage на canvas → captureStream() → новый поток
```

**Проблемы классики:**

1. Лишние копии и этапы (decode в video → bitmap → снова «как поток»).
2. Loop на `requestAnimationFrame` — вы сами крутите таймер.
3. Сложнее встраивать в prod media pipeline (WebRTC, Worker, GPU).

Insertable: **track уже поток кадров**. Не обязательно рисовать «экранный» canvas ради обработки — работайте с `VideoFrame` через Streams API.

### Под капотом — почему «Insertable»

Буквально **вставляемые** потоки: вы **вставляете** свой transform **между** источником и потребителем:

```
источник (камера) → [ваш Transform] → потребитель (video / WebRTC)
```

Без API потребитель видит только «готовый» track. С API вы стоите посередине.

**Не путать** с WebRTC Encoded Transform (правка **сжатых** RTP-кадров). Insertable для MediaStreamTrack — про **декодированные** `VideoFrame`.

### Под капотом — два главных объекта

| Класс | Роль | Аналогия |
|-------|------|----------|
| `MediaStreamTrackProcessor` | Вход: `track` → `ReadableStream<VideoFrame>` | Шланг, из которого капают кадры |
| `MediaStreamTrackGenerator` | Выход: `WritableStream<VideoFrame>` → новый track | Шланг на выходе; в Chrome generator **сам** `MediaStreamTrack` |
| `TransformStream` | Ваш код между ними | Фильтр на каждом кадре |
| `VideoFrame` | Один кадр: пиксели, `timestamp`, `close()` | Единица работы pipeline |

Схема:

```
[камера track]
 │
 ▼
 Processor.readable ──► Transform ──► Generator.writable
 │
 ваш фильтр
 │
 ▼
 new MediaStream([generator])
```

### Под капотом — что такое `VideoFrame`

Не «картинка в `<img>`», а **кадр медиа-пайплайна**:

- пиксели (или ссылка на GPU-буфер);
- `timestamp` / `duration` — для синхронизации;
- `displayWidth` / `displayHeight`;
- обязательный **`close()`** — кадр занимает ресурсы, пока не закрыт.

```js
const output = process(frame);
frame.close(); // входной освободили
controller.enqueue(output); // выходной ушёл дальше
```

Забыли `close()` → **memory leak**. Это ключевая «цена» API.

При `filter === 'none'` кадр **пробрасываем** без `close()` — владение переходит Generator'у.

### Под капотом — Canvas vs Insertable

| | Canvas + captureStream | Insertable Streams |
|---|------------------------|-------------------|
| Единица работы | Bitmap canvas | `VideoFrame` |
| Как крутится | Вы: `rAF` + `drawImage` | Браузер: Streams `pipeThrough` |
| Вход | Через `<video>` | Напрямую с track |
| Выход | `canvas.captureStream()` | `MediaStreamTrackGenerator` |
| Поддержка | Везде | Chrome/Edge (и постепенно другие) |
| Смысл | Универсальный «нарисовал и снял» | Вставка в **media track pipeline** |

**Смысл тот же** (обработать → новый поток), **уровень другой**: ближе к медиа, дальше от DOM.

В demo внутри Transform всё равно может быть `OffscreenCanvas` (grayscale / mirror) — это нормально. Insertable не запрещает canvas; он меняет **как кадры входят и выходят**.

### Под капотом — плюсы и минусы

**Плюсы:** явная модель «кадр за кадром»; легче увести в Worker / OffscreenCanvas / WebGL / WASM; выход — обычный track → WebRTC; нет обязательного видимого video + captureStream loop.

**Минусы:** поддержка неполная → fallback; дисциплина `frame.close()`; тяжёлые эффекты всё равно жрут CPU/GPU.

### В нашем коде

`startInsertablePipeline()`:

```js
processor.readable
 .pipeThrough(transformer)
 .pipeTo(generator.writable);

new MediaStream([generator]); // не generator.track — в Chrome generator сам track
```

Камера в `StreamContext` **не заменяется** — на выходе **второй** track.

### Зритель должен унести

> Insertable Streams — способ **вставить свою обработку** в живой video track: Processor читает `VideoFrame`, Transform меняет, Generator отдаёт новый track. Не редактируем камеру — строим **новый** поток кадров.

### Место в докладе

```
Шаг 1–2 — получить и управлять потоком
Шаг 3 — изменить картинку «классикой» (Canvas)
Шаг 4 — тот же смысл, но через Insertable (prod-ближе)
Шаг 5 — отправить track по WebRTC
```

---

## Заголовок и поддержка браузеров

### На стриме

> На Шаге 3 обрабатывали кадры через **Canvas** и `drawImage`. Это работает везде, но на 1080p — лишние копии и нагрузка на CPU.

> **Insertable Streams** — API для обработки **на уровне трека**: читаем `VideoFrame` с камеры, трансформируем, отдаём **новый** track. Ближе к тому, как устроены prod-пайплайны (DION, VK).

### Под капотом — состав API (кратко)

Часть семейства **MediaStream Insertable Streams** (ранее Breakout Box): Processor, Generator, TransformStream, VideoFrame — см. блок **«База»** выше.

### Под капотом — поддержка браузеров

- **Chrome / Edge** — основной target для demo, API есть.
- **Firefox** — появляется по версиям; проверить перед стримом.
- **Safari** — может не быть; demo **не падает** — Canvas fallback.

В коде: `isInsertableStreamsSupported()` — feature detect при загрузке.

### В нашем коде

`lib/insertableStreams.ts` — detect + `startInsertablePipeline()`. 
Если API нет — banner на Шаге 4 и режим `canvas` автоматически.

### Зритель должен унести

> Insertable Streams — **поточная** обработка track через `VideoFrame`, не через видимый canvas loop.

---

## Схема pipeline

### На стриме

> Цепочка: входной track камеры → Processor → наш Transform → Generator → новый MediaStream на output `<video>`.

### Под капотом — по шагам

```
1. inputTrack = stream.getVideoTracks()[0] // из StreamContext, не stop()

2. processor = new MediaStreamTrackProcessor({ track: inputTrack })
 // processor.readable: ReadableStream<VideoFrame>

3. transformer = new TransformStream({
 transform(frame, controller) { ... }
 })

4. generator = new MediaStreamTrackGenerator({ kind: 'video' })
 // generator.writable: WritableStream<VideoFrame>
 // generator сам является MediaStreamTrack

5. processor.readable
 .pipeThrough(transformer)
 .pipeTo(generator.writable)

6. outputStream = new MediaStream([generator])
```

**Параллельно с Canvas (Шаг 3):**

| | Canvas | Insertable |
|---|--------|------------|
| Вход | `<video>` + decode | `VideoFrame` с track |
| Обработка | `drawImage` + `ctx.filter` | `OffscreenCanvas` или WebGL в Transform |
| Выход | `canvas.captureStream()` | `generator` (сам track) |
| Копии | Часто больше | Меньше лишних, если аккуратно с `close()` |

### Под капотом — `AbortController`

При остановке pipeline:

```js
abortController.abort();
generator.stop();
```

`pipeThrough` / `pipeTo` с `{ signal }` — корректно рвёт цепочку без утечек.

### В нашем коде

`startInsertablePipeline()` в `insertableStreams.ts` — processor, transform, generator, abort. 
`Step4InsertableStreams.tsx` — один путь: Insertable если API есть, иначе Canvas fallback.

### Live demo

1. Input / Output горят. 
2. **Grayscale** → output серый. 
3. **Mirror** → зеркало (в Chrome; в fallback кнопки Mirror нет).

### Зритель должен унести

> Processor + Transform + Generator = **тот же смысл**, что video → canvas → captureStream, но на уровне **треков и VideoFrame**.

---

## VideoFrame lifecycle

### На стриме

> Главная ошибка — забыть **`frame.close()`**. Кадры копятся в памяти, вкладка растёт. На стриме можно упомянуть DevTools Memory, не обязательно открывать.

### Под капотом — владение кадром

`VideoFrame` — ресурс с ограниченным lifetime:

- Создали из `processor` → **мы** ответственны закрыть, если не передали дальше.
- Передали в `controller.enqueue(frame)` при passthrough (`filter: none`) — владение переходит к stream.
- Создали **новый** `VideoFrame` из `OffscreenCanvas` → **входной** `close()` после копирования.

В demo при `filter !== 'none'`:

```js
const output = transformVideoFrame(frame, filter);
frame.close();
controller.enqueue(output);
```

При `filter === 'none'`:

```js
controller.enqueue(frame); // без close — frame ушёл в generator
```

### Под капотом — timestamp

При создании output frame копируем:

```js
new VideoFrame(canvas, {
 timestamp: frame.timestamp,
 duration: frame.duration ?? undefined,
});
```

Чтобы A/V sync и WebRTC не ломали timeline (для video-only demo менее критично, но правильно).

### В нашем коде

`transformVideoFrame()` — `OffscreenCanvas` + `grayscale` или mirror (`scale(-1,1)`).

### Зритель должен унести

> Каждый `VideoFrame` — как файл: открыл → **`close()`**, иначе leak.

---

## Fallback

### На стриме

> API нет в Safari — показываем banner и **Canvas fallback** с Шага 3. Demo не ломается. Переключателя режимов нет: feature detect выбирает путь сам.

### Под капотом — стратегия prod

```
if (Insertable Streams supported)
 → processor / generator pipeline
else
 → Canvas или WebGL fallback
```

Один UI, разный backend — паттерн для реальных продуктов.

### Под капотом — Mirror только в Insertable (demo)

Canvas fallback поддерживает **none** и **grayscale** (reuse `startCanvasPipeline`). 
**Mirror** — только Insertable; в fallback кнопка не показывается.

### В нашем коде

| Условие | Путь |
|---------|------|
| `isInsertableStreamsSupported()` | `insertableStreams.ts` |
| иначе | `effects.ts` + скрытые video/canvas |

### Live demo — сценарий

1. Grayscale. 
2. Mirror (Chrome). 
3. (Опционально) Safari — banner + fallback.

### Переход

> Обработанный `outputStream` готов к **`pc.addTrack()`**. Дальше — **WebRTC loopback**, Шаг 5.

---

## Demo — поток данных

```
StreamContext.stream
 │
 ├─► VideoPreview Input
 │
 ▼
 videoTrack
 │
 ├─► [Insertable] Processor → Transform → Generator → outputStream
 │
 └─► [Canvas] hidden video → drawImage → captureStream → outputStream
 │
 └─► VideoPreview Output
```

Камера **одна**. Output track — **второй** поток.

---

## Шпаргалка

| Вопрос | Ответ |
|--------|--------|
| Суть Insertable? | Вставить обработку между источником и потребителем трека |
| Что такое Insertable Streams? | API: Processor/Generator + VideoFrame между треками |
| Заменяем camera track? | Нет, новый track в новом MediaStream |
| Зачем `frame.close()`? | Иначе memory leak |
| Canvas vs Insertable? | Тот же смысл, другой уровень; Canvas — везде |
| Нет API в браузере? | Auto Canvas fallback + banner |
| Mirror в fallback? | Нет — только Insertable |
| `new MediaStream([generator])`? | В Chrome generator сам является track |

---

---
