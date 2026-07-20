# Стрим 1: «От камеры до WebRTC» — поэтапный план

> Формат работы: **один этап → согласование → делаем материалы → следующий этап.**  
> На каждый этап создаём три артефакта в папке `stream-1/NN-название/`:
> - `slides.md` — текст слайдов
> - `speaker-notes.md` — о чём говорить, тайминг, переходы слайд↔код
> - код в `demo-app/` (наращиваем по шагам)

**Целевая длительность стрима:** ~60 мин  
**Демо:** один браузер, loopback WebRTC (без signaling-сервера)  
**Стек демо:** Vite 4 + React + TypeScript (совместим с Node 16)

---

## Структура папок (создаём по мере прохождения)

```
Доклад/
├── PLAN.md                          ← этот файл
├── stream-1/
│   ├── 00-intro/
│   │   ├── slides.md
│   │   └── speaker-notes.md
│   ├── 01-camera/
│   ├── 02-stream-tracks/
│   ├── 03-canvas/
│   ├── 04-insertable-streams/
│   ├── 05-webrtc/
│   └── 06-outro/
└── demo-app/                        ← одно приложение, шаги 1–5
    ├── src/steps/StepN*.tsx
    └── README.md
```

---

## Этап 0. Каркас проекта (делаем первым)

**Зачем:** чтобы на стриме был один URL и навигация между шагами, а не пять отдельных HTML-файлов.

| Что | Содержание |
|-----|------------|
| **Описание** | Vite-приложение с боковой/верхней навигацией «Шаг 1…5», общий `StreamContext` для камеры, тёмная тема под OBS |
| **Презентация** | нет (технический этап) |
| **Код** | `demo-app`: scaffold, `StepNav`, `StreamContext`, заглушки шагов, README с `npm install && npm run dev` |
| **На стриме** | не показываем; просто открываем localhost:5173 в начале |

**Критерий готовности:** приложение запускается, переключение между пустыми шагами работает.

---

## Этап 1. Вступление (~5 мин)

**Тема:** зачем стрим, карта серии, что увидим сегодня.

| | |
|---|---|
| **Слайды (4 шт.)** | 1. Титул + имя + DION/Innotech · 2. «Видео в браузере — не `<video src>`» · 3. Roadmap серии (стрим 1–4: камера→WebRTC, blur/VB, prod VB, MF) · 4. План сегодняшнего эфира (5 блоков + демо) |
| **Код** | нет |
| **О чём говорить** | Контекст: работаю над видеоконференциями в DION. Сегодня — фундамент: от `getUserMedia` до первого WebRTC-соединения в одной вкладке. Не про ML-эффекты — это стрим 2–3. Анонс Q&A в конце. |
| **Переход** | «Открываю демо — пройдём путь по шагам» → localhost:5173 |

**Файлы:** `stream-1/00-intro/slides.md`, `speaker-notes.md`

---

## Этап 2. Камера: getUserMedia (~10 мин)

**Тема:** как браузер получает доступ к камере, constraints, разрешения.

| | |
|---|---|
| **Слайды (5 шт.)** | 1. Заголовок «getUserMedia» · 2. Схема: User → Permissions API → OS → Device · 3. `MediaStreamConstraints`: `{ video: true }` vs `{ video: { width, height, frameRate } }` · 4. Что возвращается: `MediaStream` с `MediaStreamTrack[]` · 5. Типичные ошибки: `NotAllowedError`, `NotFoundError`, HTTPS |
| **Код — Step 1** | Кнопка «Запросить камеру», пресеты 720p/1080p, `<video autoPlay playsInline muted>`, панель: track.id, label, readyState, settings (width/height/fps) |
| **О чём говорить** | HTTPS обязателен (кроме localhost). `playsInline` — для iOS. `muted` — иначе autoplay заблокируют. Constraints — *wish list*, браузер может отдать другое (показать в settings). Связь с реальностью: в DION при входе в конференцию тот же API. |
| **Live demo** | Запросить камеру → переключить пресет → показать settings в DevTools vs нашей панели |
| **Переход** | «У нас есть поток — что это за объект?» |

**Файлы:** `stream-1/01-camera/`, `demo-app/src/steps/Step1CameraAccess.tsx`

---

## Этап 3. MediaStream и треки (~10 мин)

**Тема:** поток ≠ файл; треки включаются/выключаются; один поток — несколько `<video>`.

| | |
|---|---|
| **Слайды (4 шт.)** | 1. «MediaStream = набор живых треков» · 2. Video track vs Audio track (mute ≠ stop) · 3. `track.enabled = false` vs `track.stop()` · 4. `srcObject` vs `src` — почему не blob URL для камеры |
| **Код — Step 2** | Два preview из одного stream; toggle video/audio enabled; кнопка stop track; список треков с состояниями |
| **О чём говорить** | `enabled` — пауза без пересоздания потока (удобно для mute камеры). `stop()` — освобождает устройство, нужен новый getUserMedia. Один MediaStream можно привязать к нескольким элементам — все показывают одно и то же. Это важно перед WebRTC: мы не «копируем файл», мы передаём треки. |
| **Live demo** | Выключить video track — оба preview гаснут; включить обратно; stop — камера освобождается (индикатор OS) |
| **Переход** | «Хотим изменить картинку — фильтр, blur. Как?» |

**Файлы:** `stream-1/02-stream-tracks/`, `Step2StreamInspector.tsx`

---

## Этап 4. Canvas и captureStream (~12 мин)

**Тема:** обработка кадров через Canvas; `canvas.captureStream()` → новый MediaStream.

| | |
|---|---|
| **Слайды (5 шт.)** | 1. «Обработка = прочитать кадр → нарисовать → отдать дальше» · 2. Pipeline: video → drawImage → filter → captureStream · 3. requestAnimationFrame vs setInterval · 4. Ограничения: CPU, разрешение, задержка · 5. Когда Canvas достаточно (фильтры, watermark) vs когда нет (blur на каждом кадре) |
| **Код — Step 3** | Video → canvas loop; фильтры: grayscale, sepia, invert; slider FPS; второй `<video>` с `captureStream()`; счётчик FPS |
| **О чём говорить** | Классический путь до Insertable Streams. `drawImage` каждый кадр — дорого на 1080p60. `captureStream(fps)` создаёт **новый** MediaStream — оригинальная камера живёт отдельно. На стриме 2 blur сделаем так же или через Insertable Streams. |
| **Live demo** | Включить grayscale → показать что output-video живой; покрутить FPS — лаг/плавность |
| **Переход** | «Canvas тянет весь кадр в CPU. Есть API поточнее — Insertable Streams» |

**Файлы:** `stream-1/03-canvas/`, `Step3CanvasProcessing.tsx`, `lib/effects.ts`

---

## Этап 5. Insertable Streams (~10 мин)

**Тема:** `MediaStreamTrackProcessor` / `Generator`; обработка на уровне `VideoFrame`.

| | |
|---|---|
| **Слайды (4 шт.)** | 1. Заголовок + поддержка браузеров (Chrome ✅, Firefox/Safari — проверить) · 2. Схема: Track → Processor → Transform → Generator → new Track · 3. VideoFrame lifecycle: `close()` обязателен · 4. Fallback: если API нет — banner + canvas из Step 3 |
| **Код — Step 4** | Pipeline с TransformStream (grayscale или mirror); новый track в preview; graceful fallback |
| **О чём говорить** | Не копируем через canvas — работаем с `VideoFrame`. Меньше лишних копий, лучше для prod (DION/VK-style pipelines). `frame.close()` — иначе memory leak. Если браузер зрителя не поддерживает — показываем fallback, не ломаем демо. |
| **Live demo** | Включить эффект → DevTools Memory (упомянуть) → переключить на fallback если нужно |
| **Переход** | «Поток готов — отправим его по сети. WebRTC» |

**Файлы:** `stream-1/04-insertable-streams/`, `Step4InsertableStreams.tsx`, `lib/insertableStreams.ts`

---

## Этап 6. WebRTC loopback (~12 мин)

**Тема:** RTCPeerConnection, offer/answer, ICE, local/remote stream — всё в одной вкладке.

| | |
|---|---|
| **Слайды (6 шт.)** | 1. «WebRTC = P2P медиа + DataChannel» · 2. Сигналинг (на слайде — стрелка «out of scope», loopback без сервера) · 3. Offer/Answer (SDP) · 4. ICE candidates · 5. `addTrack` / `ontrack` · 6. Что дальше: TURN, SFU, simulcast (тизер DION) |
| **Код — Step 5** | Два `RTCPeerConnection`, `createOffer` → `setLocalDescription` → `setRemoteDescription` на втором → answer → ICE loopback; local + remote `<video>`; лог состояний (signaling, ice, connection) |
| **О чём говорить** | Loopback — учебный режим: signaling «в голове» через await. В prod — WebSocket/SIP. Показать что remote video = тот же поток, прошёл через encoder/decoder. ICE host candidate достаточно локально. Упомянуть: в DION медиа идёт через SFU, не чистый P2P. |
| **Live demo** | Start → local + remote горят → лог ICE connected → выключить камеру — remote тоже |
| **Переход** | Финал |

**Файлы:** `stream-1/05-webrtc/`, `Step5WebRTCLoopback.tsx`, `lib/webrtcLoopback.ts`

---

## Этап 7. Финал и Q&A (~5 мин)

| | |
|---|---|
| **Слайды (3 шт.)** | 1. Резюме: camera → stream → tracks → canvas/insertable → WebRTC · 2. Следующий стрим: blur & virtual background · 3. Q&A + ссылки (MDN, demo repo, Telegram?) |
| **Код** | нет |
| **О чём говорить** | Коротко повторить путь на одном слайде-схеме. Призыв: поэкспериментировать с demo-app. Анонс стрима 2. |

**Файлы:** `stream-1/06-outro/`

---

## Сводка: порядок реализации

| # | Этап | Слайды | Код | Время на стриме |
|---|------|--------|-----|-----------------|
| 0 | Каркас demo-app | — | scaffold | — |
| 1 | Вступление | 4 | — | ~5 мин |
| 2 | getUserMedia | 5 | Step 1 | ~10 мин |
| 3 | Stream & tracks | 4 | Step 2 | ~10 мин |
| 4 | Canvas | 5 | Step 3 | ~12 мин |
| 5 | Insertable Streams | 4 | Step 4 | ~10 мин |
| 6 | WebRTC | 6 | Step 5 | ~12 мин |
| 7 | Финал | 3 | — | ~5 мин |
| | **Итого** | **~31 слайд** | **5 шагов** | **~64 мин** |

*(тайминг чуть с запасом — на практике уложимся в 60)*

---

## Формат презентации

На каждом этапе `slides.md` содержит для каждого слайда:
- **Заголовок**
- **Текст / буллеты**
- **Заметка докладчику** (опционально, дублируется в speaker-notes)
- **Скриншот демо** (placeholder — добавим после реализации шага)

Презентацию собираем в **reveal.js HTML** (один файл на весь стрим) или копируем в Google Slides — как удобнее на стриме.

---

## Что делаем прямо сейчас

**Следующий шаг по плану — Этап 0 + Этап 1:**

1. Поднимаем `demo-app` (каркас + навигация)
2. Пишем `stream-1/00-intro/slides.md` + `speaker-notes.md`

После твоего «ок» — переходим к **Этапу 2** (камера: слайды + Step 1).

---

## Серия (контекст, не для стрима 1)

| # | Тема | Связь с DION |
|---|------|--------------|
| 2 | Blur & virtual background | эффекты камеры |
| 3 | Production VB (TFLite, Worker) | как в VK/DION talk |
| 4 | Module Federation | frontend-conference |
