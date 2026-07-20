# Этап 5 — Insertable Streams (4 слайда)

> Длительность блока: ~10 мин  
> Demo: **Шаг 4** в `localhost:5173`

---

## Слайд 1 — Заголовок и поддержка браузеров

**Заголовок:**  
Insertable Streams — обработка на уровне `VideoFrame`

**Буллеты:**
- API для **поточной** обработки `MediaStreamTrack` без `drawImage` на видимом canvas
- Ключевые классы: `MediaStreamTrackProcessor`, `MediaStreamTrackGenerator`
- Единица работы — **`VideoFrame`**, не bitmap canvas целиком
- **Chrome / Edge** — поддерживают; **Firefox / Safari** — проверять, в demo есть **fallback**

**Таблица:**

| Браузер | Insertable Streams |
|---------|-------------------|
| Chrome, Edge | ✅ |
| Firefox | ⚠️ проверить версию |
| Safari | ⚠️ ограниченно |

**Заметка:**  
Если API нет — не ломаем demo, Canvas fallback с Шага 3.

---

## Слайд 2 — Схема pipeline

**Заголовок:**  
Track → Processor → Transform → Generator → new Track

**Схема:**

```
input track (камера)
       │
       ▼
MediaStreamTrackProcessor.readable  (ReadableStream<VideoFrame>)
       │
       ▼
TransformStream  (grayscale / mirror / …)
       │
       ▼
MediaStreamTrackGenerator.writable  (WritableStream<VideoFrame>)
       │
       ▼
generator  →  new MediaStream  →  <video srcObject>
```

**Код на слайде:**

```js
const processor = new MediaStreamTrackProcessor({ track: inputTrack });
const generator = new MediaStreamTrackGenerator({ kind: 'video' });

processor.readable
  .pipeThrough(transformer)
  .pipeTo(generator.writable);

const output = new MediaStream([generator]);
```

**Буллеты:**
- **Processor** — читает кадры с входного track
- **Transform** — наш код на каждом `VideoFrame`
- **Generator** — отдаёт **новый** video track
- Входной track камеры **не заменяем** — он живёт в `StreamContext`

**Заметка:**  
Сравнить с Canvas: нет `<video>` + `captureStream`, работаем в stream pipeline.

---

## Слайд 3 — `VideoFrame` lifecycle

**Заголовок:**  
`frame.close()` обязателен

**Буллеты:**
- `VideoFrame` — обёртка над кадром в памяти (timestamp, duration, размер)
- После обработки **входной** frame нужно **`close()`** — иначе **memory leak**
- Выходной frame забирает потребитель (Generator); не копим в массиве
- В DevTools → Memory можно увидеть рост, если забыли `close()`

**Код на слайде:**

```js
transform(frame, controller) {
  const output = processOnOffscreenCanvas(frame);
  frame.close();              // входной — закрыли
  controller.enqueue(output); // выходной — ушёл в pipeline
}
```

**Заметка:**  
На стриме: «Забыли close — через минуту вкладка раздувается».

---

## Слайд 4 — Fallback

**Заголовок:**  
Graceful degradation

| Ситуация | Поведение demo |
|----------|----------------|
| API есть | Insertable pipeline |
| API нет | Banner + Canvas fallback (как Шаг 3) |
| Зритель на Safari | Показать fallback, не падать |

**Буллеты:**
- Prod: feature detect → Insertable или Canvas/WebGL/Worker
- Mirror в demo — через `OffscreenCanvas` + `scale(-1, 1)` в Transform
- Один путь в UI: без ручного переключения режимов

**Заметка:**  
Переход: «Поток готов — отправим по сети. WebRTC, Шаг 5».

---

## Переход к demo

→ Шаг 4: Insertable (или auto-fallback), grayscale, mirror  
**Фраза:** «Тот же смысл, что Canvas, но ближе к prod pipeline»
