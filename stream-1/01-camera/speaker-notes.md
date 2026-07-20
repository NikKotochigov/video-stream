# Этап 2 — Speaker notes: getUserMedia

**Общее время:** ~10–15 мин (можно дольше — здесь главная база)  
**Demo:** Шаг 1 — `localhost:5173`  
**Переход:** «Поток получен — разберём, что внутри `MediaStream`» → Шаг 2

**Формат каждого блока:**
- **На стриме** — что говорить
- **Под капотом** — что реально происходит
- **В нашем коде** — где это в demo
- **Зритель должен унести** — одна мысль на выходе

---

## Слайд 1 — `navigator.mediaDevices.getUserMedia()`

### На стриме

> Открываю **Шаг 1** в demo. Сейчас разберём первый API — через него почти всегда начинается работа с камерой в браузере.
>
> Вызов выглядит так: `navigator.mediaDevices.getUserMedia(constraints)`. Получаем Promise, внутри — `MediaStream`. Его кладём в `<video>` через `srcObject`.

### Под капотом — объект `navigator`

`navigator` — глобальный объект браузера про **окружение** страницы: язык, on-line/off-line, user agent, и — с недавних пор — медиа-устройства.

Раньше камеру брали так: `navigator.getUserMedia` (устарело). Сейчас правильный путь:

```
navigator
  └── mediaDevices          ← только в secure context
        ├── getUserMedia()  ← камера / микрофон
        ├── getDisplayMedia() ← шaring экрана (другой API)
        └── enumerateDevices() ← список устройств (после разрешения)
```

**`mediaDevices` существует только в secure context.** Если открыть страницу по `http://192.168.1.5:5173` (не localhost) — объекта может не быть или вызов упадёт с `SecurityError`.  
`https://` и `http://localhost` — OK.

### Под капотом — что такое `getUserMedia`

Сигнатура: `getUserMedia(constraints?) → Promise<MediaStream>`.

1. **Не блокирует UI.** Метод сразу возвращает Promise. Пока пользователь думает над диалогом «Разрешить?», страница жива — React рисуется, кнопки работают (кроме нашей disabled-логики).
2. **Может показать системный UI.** Браузер обязан спросить разрешение (если ещё не запомнил). Это не React-modal — его нельзя стилизовать.
3. **При успехе** — Promise resolve с `MediaStream`.  
   **При отказе / ошибке** — Promise reject с `DOMException` (`NotAllowedError`, …).

### Под капотом — `srcObject` vs `src`

| | `src="url"` | `srcObject = stream` |
|---|-------------|----------------------|
| Что передаём | URL файла (mp4, webm) | Объект: MediaStream, MediaSource, Blob… |
| Тип данных | Законченный файл, можно seek | Живой поток, seek нет |
| Типичный кейс | Плеер ролика | Камера, WebRTC, canvas.captureStream |

**`src` и `srcObject` взаимоисключающие** — при установке одного второе сбрасывается.

### В нашем коде

**Запрос камеры** — `Step1CameraAccess.tsx`, функция `requestCamera`:

```ts
const mediaStream = await navigator.mediaDevices.getUserMedia(
  activePreset.constraints,
);
setStream(mediaStream);
```

**Привязка к `<video>`** — `VideoPreview.tsx`:

```ts
video.srcObject = stream;
```

### Зритель должен унести

> Камера в браузере начинается не с `<video>`, а с `navigator.mediaDevices.getUserMedia`. Результат — `MediaStream`, показываем через `srcObject`.

---

## Слайд 2 — Цепочка: страница → браузер → ОС → камера

### На стриме

> JavaScript **не обращается к камере напрямую**. Между вашим кодом и железом — несколько слоёв. Из-за этого ошибки часто «не в React», а в разрешениях или в ОС.

### Под капотом — пошагово после клика «Запросить камеру»

**Шаг A. Ваш код**  
React вызывает `getUserMedia(constraints)`. Constraints уже собраны из пресета 720p/1080p.

**Шаг B. Браузер — политики**  
- Secure context?  
- Feature policy / Permissions Policy: разрешена ли камера для этого iframe/страницы?  
- Есть ли уже сохранённое решение пользователя (allow / deny / prompt)?

**Шаг C. Браузер — UI разрешений**  
Если нужно — всплывает **нативный** диалог. Пользователь может:
- Allow — идём дальше  
- Block — `NotAllowedError`, Promise reject  
- Закрыть — обычно тоже reject  

Браузер **может запомнить** выбор для этого origin (`localhost:5173` — отдельно от `example.com`).

**Шаг D. Браузер → ОС**  
Chrome/Firefox/Safari просят ОС открыть устройство захвата. ОС:
- выбирает камеру (если их несколько — по умолчанию или по `deviceId` в constraints);
- проверяет, не занята ли она другим процессом;
- запускает поток кадров через драйвер.

**Шаг E. ОС → браузер → ваш код**  
Браузер создаёт:
- `MediaStream` — контейнер;
- один или несколько `MediaStreamTrack` — реальные «ручейки» данных (video, audio).

Кадры начинают поступать **до** того, как вы успели присвоить `srcObject` — но `<video>` их покажет только после привязки.

### Под капотом — почему это важно для отладки

| Симптом | Слой | Что проверить |
|---------|------|----------------|
| Нет диалога, сразу ошибка | Браузер / политики | Запрет в настройках сайта, прошлый Block |
| Долго «Запрос…» | Пользователь / ОС | Ждёт клика; камера просыпается |
| NotReadableError | ОС | Zoom, Telegram, другая вкладка держит камеру |
| NotFoundError | ОС / железо | Нет камеры, VM без проброса USB |
| Всё OK, но чёрный экран | Ваш код | Забыли `srcObject`, autoplay policy |

### В нашем коде

Пока идёт цепочка B–D, в UI:
```ts
setLoading(true);  // кнопка «Запрос…»
```
После resolve/reject:
```ts
finally { setLoading(false); }
```

Ошибки не глотаем — `getUserMediaErrorMessage(err)` → красный блок.

### Зритель должен унести

> `getUserMedia` — это просьба к **браузеру**, браузер — к **ОС**. Страница не «включает камеру» одной строкой HTML.

---

## Слайд 3 — Constraints: пожелания, не приказ

### На стриме

> Второй аргумент — **constraints**. Мы не приказываем «дай 1080p», мы **просим**. Браузер подбирает ближайший режим, который реально поддерживает камера и драйвер.

### Под капотом — структура constraints

```js
{
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  audio: false,
}
```

**`video`** — может быть:
- `true` — «любое видео, как получится»;
- `false` — видео не нужно;
- объект — детальные пожелания по разрешению, fps, facingMode (`user`/`environment`), `deviceId`.

**`audio`** — аналогично. У нас **`false`** на Step 1: не просим микрофон → в потоке **нет audio track** → меньше отвлекающих permission-диалогов.

### Под капотом — `ideal`, `min`, `max`, `exact`

| Ключ | Смысл | Риск |
|------|--------|------|
| `ideal` | «Хочу, но согласен на другое» | Низкий — наш выбор |
| `min` / `max` | Диапазон | Средний |
| `exact` | «Только так, иначе ошибка» | Высокий → `OverconstrainedError` |

Пример: встроенная камера Mac часто **не отдаёт** 1080p30 в браузере, даже если в Zoom «кажется HD». Браузер честно даст меньше — смотрите `getSettings()`.

### Под капотом — `getSettings()` vs `getConstraints()`

После успешного вызова у **video track**:

- **`getSettings()`** — **факт**: `{ width: 1280, height: 720, frameRate: 30, deviceId: "..." }`.  
  Это то, что **сейчас** идёт с камеры.

- **`getConstraints()`** — что браузер **считает применёнными** ограничениями на этот track (может отличаться от того, что вы передали в getUserMedia — браузер нормализует).

**Частая путаница:** просили 1920×1080, `getSettings()` показывает 1280×720 — **это не баг**. Constraints были wish list.

### Под капотом — перезапрос при смене пресета

Когда жмёте «Перезапросить» с другим пресетом:
1. Новый `getUserMedia` с новыми constraints.
2. `setStream(newStream)` в контексте **останавливает старые tracks** (`track.stop()`), освобождая камеру.
3. Без stop старая камера могла бы висеть в фоне — индикатор OS горел бы.

### В нашем коде

Пресеты — `lib/camera.ts`:
```ts
{ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
```

Панель справа — `TrackInfoPanel.tsx`:
- **requested** — что передали в getUserMedia;
- **applied (track)** — `videoTrack.getConstraints()`;
- **width/height/frameRate (actual)** — `videoTrack.getSettings()`.

### Live demo — что проговорить

1. 720p → Запросить → прочитать **actual** width/height.
2. 1080p → Перезапросить → сравнить. Если цифры те же: «камера не дала больше — constraints не гарантия».
3. Показать **requested** vs **actual** в панели.

### Зритель должен унести

> Constraints — **пожелания**. Истина — в `track.getSettings()`.

---

## Слайд 4 — `MediaStream`, track и `<video>`

### На стриме

> `getUserMedia` вернул объект **`MediaStream`**. Это не файл и не URL. Внутри — **треки**. Покажем их в панели и разберём, как `<video>` вообще начинает что-то рисовать.

### Под капотом — `MediaStream`

Контейнер «коробка с трубками»:
```
MediaStream { id: "...", active: true }
  ├── MediaStreamTrack { kind: "video", readyState: "live", ... }
  └── MediaStreamTrack { kind: "audio", ... }  // если audio: true
```

Полезные методы:
- `stream.getVideoTracks()` — массив video-треков (обычно один);
- `stream.getAudioTracks()` — audio;
- `stream.getTracks()` — всё;
- `stream.active` — false, если все треки ended.

**Один MediaStream** можно одновременно привязать к **нескольким** `<video>` — все покажут одну картинку (разберём на Шаге 2).

### Под капотом — поля video track (панель справа)

| Поле | Что значит |
|------|------------|
| `id` | Строка-ID трека в этой сессии. Меняется при новом getUserMedia. |
| `label` | Имя устройства. До разрешения часто пустое — privacy. |
| `readyState` | `"live"` — идёт захват; `"ended"` — после `stop()`. |
| `muted` | **Системный** mute (не путать с `enabled`). На video track редко меняется. |
| `enabled` | `false` — чёрный кадр / тишина, но устройство занято. Разберём на Шаге 2. |

### Под капотом — `<video>`: как поток становится картинкой

**1. `srcObject = stream`**  
Браузер подписывает `<video>` на MediaStream: декодер (для video track) получает кадры и рисует в элемент.

**2. `autoPlay`**  
Поток «как live» — нужно автоматически начать **playback**. Без `autoPlay` может быть чёрный кадр до ручного `video.play()`.

**3. `playsInline`**  
На iOS Safari без этого атрибута video при воспроизведении может **развернуться на весь экран** — плохо для preview в UI.

**4. `muted`**  
Политика **autoplay** в Chrome/Safari/Firefox:  
- muted video — autoplay **разрешён**;  
- со звуком — часто **заблокирован** до жеста пользователя.  

Даже если audio track нет, **`muted` на `<video>` — страховка** для autoplay. Для локального preview камеры звук всё равно не нужен.

**5. Чего мы НЕ ставим (и почему)**  
- `controls` — не нужен плеер с pause/seek; это не файл.  
- `loop` — не применимо к live.  
- `src` — не используем для камеры.

### Под капотом — React: `useEffect` в `VideoPreview`

```ts
useEffect(() => {
  video.srcObject = stream;
  return () => { video.srcObject = null; };
}, [stream]);
```

**Зачем effect:** при смене `stream` (перезапрос, stop) нужно **перепривязать** DOM-элемент.  
**Cleanup:** при unmount или смене stream сбрасываем `srcObject`, чтобы не держать ссылку на старый поток.

**Почему не `srcObject={stream}` в JSX:** у `<video>` нет React-prop для srcObject — только императивно через ref.

### Под капотом — что видит пользователь в preview

Пока `stream === null`:
- `<video>` пустой;
- overlay «Камера не запущена».

После `setStream`:
- React ре-рендер → effect → `srcObject` → через 1–2 кадра картинка.

Если чёрный экран при live track — проверить: autoplay, muted, не ended ли track.

### В нашем коде

| Файл | Роль |
|------|------|
| `StreamContext` | Хранит `stream` между шагами 1–5 |
| `Step1CameraAccess` | Запрашивает, кладёт в контекст |
| `VideoPreview` | `srcObject` + autoPlay + playsInline + muted |
| `TrackInfoPanel` | id, label, readyState, settings |

### Live demo

1. Запросить камеру — preview ожил.
2. Панель: `readyState: live`, width/height/fps.
3. Открыть DevTools → Elements → `<video>` — можно показать, что `srcObject` в Properties, не в attribute `src`.

### Зритель должен унести

> `MediaStream` — коробка с треками. `<video>` — монитор: `srcObject` + autoPlay + playsInline + muted для live preview.

---

## Слайд 5 — Ошибки

### На стриме

> Если что-то пошло не так, `getUserMedia` **кидает исключение**. Имя ошибки — главная подсказка, что чинить.

### Под капотом — типы ошибок

Все — **`DOMException`** с полем **`name`**:

**`NotAllowedError`**  
- Пользователь Block, или сайт в blacklist.  
- **Fix:** иконка замка → Site settings → Camera → Allow → reload.  
- В коде: `catch` → показать текст, не retry в бесконечном цикле.

**`NotFoundError`**  
- Нет video input device.  
- **Fix:** подключить камеру, проверить System Settings, VM — проброс USB.

**`NotReadableError`**  
- Устройство есть, но **exclusive lock** у другого app/tab.  
- **Fix:** закрыть Zoom, FaceTime, другую вкладку с getUserMedia.

**`OverconstrainedError`**  
- Браузер не смог подобрать режим (часто `exact`).  
- **Fix:** `{ video: true }` или только `ideal`.  
- В demo: маловероятно — мы на `ideal`.

**`SecurityError`**  
- Не secure context.  
- **Fix:** HTTPS или localhost.

**`AbortError`**  
- Вызов прерван (нап example, track.stop() во время запроса). Реже на Step 1.

### Под капотом — наш `catch`

```ts
catch (err) {
  setError(getUserMediaErrorMessage(err));
}
```

- Promise **reject** → попадаем в catch.  
- **`setStream` не вызывается** — старый поток (если был) остаётся.  
- **`finally`** всё равно снимает loading.

`getUserMediaErrorMessage` — маппинг `name` → человекочитаемый текст на русском.

### В нашем коде

Красный `.alert--error` над preview — зритель **видит** ошибку, не пустую консоль.

### Если на стриме всё с первого раза

> В production чаще всего `NotAllowedError` — люди жмут Block или забыли сбросить permission.

### Зритель должен унести

> Ошибка getUserMedia — это **имя** (`NotAllowedError`, …). По нему понятно: permissions, железо, занятость или HTTPS.

---

## Блок без слайдов — разбор `requestCamera` целиком

### На стриме (можно раскрыть «Код этого шага» или IDE)

> Покажу всю функцию от клика до картинки — это связка всего, что мы сказали.

### Под капотом — построчно

```ts
const requestCamera = useCallback(async () => {
```
`async` — потому что внутри `await getUserMedia`. Кнопка не «зависает» — React уже отрисовал loading.

```ts
  setLoading(true);
  setError(null);
```
UI: disabled кнопки, «Запрос…», старая ошибка стёрта.

```ts
  const mediaStream = await navigator.mediaDevices.getUserMedia(
    activePreset.constraints,
  );
```
**Здесь** происходит вся цепочка: permissions → ОС → камера → MediaStream. JS **ждёт** на этой строке.

```ts
  setLastConstraints(activePreset.constraints);
```
Локальный state для панели «что просили».

```ts
  setStream(mediaStream);
```
Контекст: новый stream, **старый stop** если был. Все подписчики (`VideoPreview`) получат stream через React.

```ts
} catch (err) {
  setError(getUserMediaErrorMessage(err));
} finally {
  setLoading(false);
}
```
Успех или провал — loading снят.

### Цепочка данных после успеха

```
Клик
  → getUserMedia
    → MediaStream
      → setStream (context)
        → VideoPreview re-render
          → useEffect: video.srcObject = stream
            → кадры на экран
        → TrackInfoPanel re-render
          → getSettings() в UI
```

### Зритель должен унести

> Один клик — это async цепочка через браузер и ОС, результат — stream в state, preview — через srcObject.

---

## Финал блока + переход

### Действия

1. Запросить → preview + панель.  
2. 720p → 1080p → сравнить settings.  
3. **Остановить** → `clearStream()` → preview «Камера не запущена».  
   Под капотом: `setStream(null)` → stop всех tracks → камера освобождена (индикатор OS погаснет).
4. Переход: «Поток мы получили. **Что с ним можно делать**, не останавливая камеру?» → **Шаг 2**.

---

## Шпаргалка

| Вопрос | Ответ |
|--------|--------|
| Где `navigator.mediaDevices`? | Только secure context |
| Почему `audio: false`? | Фокус на video; меньше permissions |
| Почему `muted` на video без audio? | Autoplay policy |
| Почему не `src`? | src — для URL файла |
| 1080p не дали? | Смотреть getSettings(), не constraints |
| Где stream между шагами? | StreamContext |
| Почему effect в VideoPreview? | srcObject только императивно |

---

## Тайминг

| Время | Блок |
|-------|------|
| 0:00 | Слайд 1 + navigator + открыть demo |
| 2:00 | Слайд 2 — цепочка до камеры |
| 4:30 | Слайд 3 + live пресеты |
| 7:00 | Слайд 4 — MediaStream + `<video>` attrs |
| 9:00 | Слайд 5 — ошибки |
| 10:00 | Разбор requestCamera + Stop → Шаг 2 |

Если отстаёшь: слайды 2 и 5 короче, **live demo + слайд 4 (`<video>`)** не резать.
