# Этап 4 — Canvas & captureStream (5 слайдов)

> Длительность блока: ~12 мин  
> Demo: **Шаг 3** в `localhost:5173`

---

## Слайд 1 — Обработка кадра

**Заголовок:**  
Изменить картинку = прочитать кадр → обработать → отдать дальше

**Схема:**

```
MediaStream (камера)
       │
       ▼
  <video> (скрытый) ──► drawImage ──► <canvas> ──► captureStream() ──► новый MediaStream
```

**Буллеты:**
- Камера отдаёт **живой** поток — мы **не редактируем файл**
- На каждом кадре: взять картинку с `<video>`, нарисовать на `<canvas>`
- `canvas.captureStream()` — **новый** MediaStream, оригинальная камера **жива отдельно**
- Этот output потом можно показать, записать или отправить в WebRTC

**Заметка:**  
Мост от «получили поток» к «поменяли картинку».

---

## Слайд 2 — Pipeline в коде

**Заголовок:**  
`video` → `canvas` → `captureStream`

**Код на слайде:**

```js
const video = document.querySelector('video');
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

function frame() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  requestAnimationFrame(frame);
}
frame();

const outputStream = canvas.captureStream(30);
outputVideo.srcObject = outputStream;
```

**Буллеты:**
- `drawImage(video, …)` — копирует **текущий кадр** video на canvas
- CSS `ctx.filter` — быстрые эффекты: grayscale, sepia, invert
- `captureStream(fps)` — частота **выходного** потока (не обязательно = камере)
- Два `<video>`: input (камера) и output (canvas) — зритель видит разницу

**Заметка:**  
Live demo: grayscale на output, input без изменений.

---

## Слайд 3 — Как крутить loop

**Заголовок:**  
`requestAnimationFrame` vs `setInterval`

| | `requestAnimationFrame` | `setInterval` |
|---|-------------------------|---------------|
| Синхронизация | С refresh монитора (~60 Hz) | Фиксированный интервал |
| Пауза в фоне | Браузер throttle'ит | Может копить очередь |
| Типичное use | Отрисовка каждого кадра | Редкий опрос / демо |

**Буллеты:**
- **Draw loop** — обычно `rAF`: берём кадр с камеры как можно чаще
- **captureStream(fps)** — отдельно задаёт, сколько кадров **отдаёт** canvas наружу
- Draw 60 fps + capture 15 fps — нормально: рисуем часто, наружу — реже

**Заметка:**  
В demo: draw fps в панели vs slider captureStream.

---

## Слайд 4 — Ограничения Canvas

**Заголовок:**  
CPU, задержка, dropped frames

**Буллеты:**
- `drawImage` на 1080p **каждый кадр** — нагрузка на **CPU** (read + draw)
- Два потока: камера + canvas output — **двойная** работа для preview
- Низкий `captureStream` fps → рывки на output (намеренно в demo)
- Сложные эффекты (blur на каждом пикселе) — Canvas **не тянет** на prod

**Таблица:**

| Параметр | Влияние |
|----------|---------|
| Разрешение | 720p vs 1080p — заметная разница в CPU |
| FPS capture | Ниже — меньше нагрузка, больше «слайд-шоу» |
| Фильтр CSS | Дешевле pixel-манипуляций в JS |
| Несколько canvas | Линейный рост нагрузки |

**Заметка:**  
Связь с Q&A про тормоза: decode + draw + scale.

---

## Слайд 5 — Canvas vs Insertable Streams

**Заголовок:**  
Когда Canvas достаточно — и когда нет

| Задача | Canvas | Insertable Streams |
|--------|--------|-------------------|
| Grayscale, sepia, watermark | ✅ | ✅ |
| Зеркало, простой crop | ✅ | ✅ |
| Blur / virtual background | ⚠️ тяжело | ✅ лучше |
| Меньше копий в памяти | ❌ drawImage копирует | ✅ VideoFrame API |

**Буллеты:**
- Canvas — **классический** путь, работает везде
- Insertable Streams — `VideoFrame`, меньше лишних копий (Шаг 4)
- В DION/VK-style pipelines — чаще поточная обработка, не drawImage в цикле

**Заметка:**  
Переход: «Canvas тянет кадр в CPU. Есть API поточнее» → Шаг 4.

---

## Переход к demo

→ Шаг 3: input / output, фильтры, FPS slider  
**Фраза:** «Камера жива — на выходе уже **другой** MediaStream»
