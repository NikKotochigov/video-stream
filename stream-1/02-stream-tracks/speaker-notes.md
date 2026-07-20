# Этап 3 — Speaker notes: MediaStream & tracks

**Общее время:** ~10–12 мин  
**Demo:** Шаг 2 — `localhost:5173` (нужен поток с Шага 1)  
**Переход:** «Хотим изменить картинку — фильтр, blur» → Шаг 3 Canvas

**Формат:** На стриме → Под капотом → В нашем коде → Зритель должен унести

---

## Слайд 1 — MediaStream = набор треков

### На стриме

> На Шаге 1 мы получили `MediaStream`. Сейчас разберём, **что внутри** — и почему один поток можно показать в двух `<video>` одновременно.

### Под капотом — MediaStream это не «видеофайл»

После `getUserMedia` в переменной лежит **контейнер**:

```
MediaStream
  id: "a1b2c3..."      // строка, идентификатор потока
  active: true          // false, когда все треки ended

  getVideoTracks() → [ MediaStreamTrack { kind: "video", ... } ]
  getAudioTracks() → [ MediaStreamTrack { kind: "audio", ... } ]  // если audio: true
```

**Аналогия:** MediaStream — **коробка**. MediaStreamTrack — **труба** внутри: одна для картинки, одна для звука.

Данные **не лежат в файле** на диске. Кадры и сэмплы звука **текут** через треки, пока они `live`.

### Под капотом — один stream → несколько `<video>`

Когда делаем:

```js
videoA.srcObject = stream;
videoB.srcObject = stream;
```

Оба элемента **подписаны на один и тот же** MediaStream. Браузер **не копирует** поток — оба декодера читают **одни и те же** video frames.

**Следствие:**  
- `track.enabled = false` → **оба** preview гаснут.  
- `track.stop()` → **оба** перестают получать кадры.

Это важно для UI: маленький preview и большой preview в звонке — часто **один stream**, два тега.

### Под капотом — `stream.active`

`stream.active === false`, когда **каждый** track в `readyState: "ended"`.  
Поток формально ещё в памяти, но данных нет — как «пустая коробка».

### В нашем коде

`Step2StreamInspector.tsx` — два `VideoPreview` с **одним** `stream` из `StreamContext`:

```tsx
<VideoPreview stream={stream} label="Preview A" />
<VideoPreview stream={stream} label="Preview B" />
```

`VideoPreview` внутри: `video.srcObject = stream` (тот же ref-паттерн, что на Шаге 1).

### Live demo

1. С Шага 1 уже есть stream → Шаг 2.  
2. Показать A и B — **одна и та же** картинка, синхронно.

### Зритель должен унести

> MediaStream — **контейнер треков**. Несколько `<video>` могут смотреть на **один** stream.

---

## Слайд 2 — Video track vs Audio track

### На стриме

> В потоке один или два типа треков. У них **общий API**, но разный смысл: кадры vs звук.

### Под капотом — `kind`

| `track.kind` | Данные | В `<video>` | В WebRTC |
|--------------|--------|-------------|----------|
| `"video"` | Кадры (YUV/RGB) | Видно | `addTrack` video |
| `"audio"` | PCM сэмплы | Не видно* | `addTrack` audio |

\* Звук идёт через audio track, `<video>` может воспроизводить аудио **если** в stream есть audio track и `muted={false}`.

### Под капотом — `enabled` vs `muted`

Два разных флага — **частая путаница**:

**`track.enabled`** (read/write, **мы** меняем):
- `false` — трек **выключен программно**: чёрные кадры / тишина.
- `true` — снова идут данные.
- Устройство при этом **может оставаться занятым**.

**`track.muted`** (read-only, **браузер/ОС**):
- Системный mute: hardware mute, privacy, временная заглушка.
- На **audio** track меняется чаще (например, микрофон без сигнала).
- Событие `track.onmute` / `onunmute` — можно слушать.

**Не путать с `<video muted>`:**  
Атрибут на теге — для **autoplay policy** и громкости **плеера**.  
`track.muted` — состояние **источника**.

### Под капотом — почему на Шаге 1 не было audio

Step 1: `audio: false` в constraints → в stream **только video track** → проще фокус на камере и разрешениях.

Step 2: кнопка **«Перезапросить с микрофоном»** → новый `getUserMedia({ video: ..., audio: true })` → в потоке **два** трека.  
Старый stream останавливается в `setStream` (как на Шаге 1 при перезапросе).

### В нашем коде

- `TrackList.tsx` — карточка на каждый `stream.getTracks()`.
- Показываем: `kind`, `label`, `readyState`, `enabled`, `muted`.
- Кнопка перезапроса — `lib/stream.ts` → `requestStreamWithAudio()`.

### Live demo

1. Если только video — нажать «Перезапросить с микрофоном» (браузер спросит и камеру, и микрофон).  
2. В списке треков — **две** карточки: Video и Audio.  
3. Audio в preview **не слышен** — у `VideoPreview` стоит `muted` (autoplay). Для звука нужен отдельный `<audio>` или `muted={false}` — на стриме можно проговорить, не обязательно показывать.

### Зритель должен унести

> Video и audio — **отдельные треки** в одной коробке. `enabled` — мы. `muted` — система.

---

## Слайд 3 — `enabled = false` vs `stop()`

### На стриме

> Два способа «выключить» камеру — **разные последствия**. Одна из самых важных тем перед WebRTC.

### Под капотом — `track.enabled = false` (пауза)

```js
videoTrack.enabled = false;
```

**Что происходит:**
- Браузер **перестаёт отдавать** кадры в поток (чёрный экран / frozen last frame — зависит от браузера).
- **Камера физически занята** — индикатор в macOS/Windows может **гореть**.
- `readyState` остаётся **`"live"`** — трек не уничтожен.
- Можно вернуть: `videoTrack.enabled = true` — **без нового** getUserMedia.

**Когда в prod:** mute камеры в звонке, временно скрыть видео, не рвать WebRTC-соединение.

### Под капотом — `track.stop()` (освобождение)

```js
videoTrack.stop();
```

**Что происходит:**
- Браузер **закрывает** захват с устройства.
- `readyState` → **`"ended"`** — необратимо для этого track.
- Камера **освобождается** — индикатор OS **гаснет**.
- Включить обратно **нельзя** — только новый `getUserMedia` → новый track с новым `id`.

**Когда в prod:** пользователь вышел, сменил камеру, `clearStream()` при unmount.

### Под капотом — сравнение одной таблицей

| | `enabled = false` | `stop()` |
|---|-------------------|----------|
| Камера занята | Да | Нет |
| readyState | `live` | `ended` |
| Обратимо | Да | Нет |
| WebRTC | Соединение живёт, black frame | Трек мёртв, нужен replaceTrack |

### Под капотом — React и `enabled`

Изменение `track.enabled` **не меняет** объект `stream` — React **не знает**, что надо перерисовать.  
В demo после toggle вызываем `onUpdate()` → `setTick` → re-render → UI показывает новый `enabled`.

### В нашем коде

`TrackList.tsx`:

```tsx
track.enabled = !track.enabled;
onUpdate();

track.stop();
onUpdate();
```

Кнопки: `enabled = false/true` и `stop()`.

### Live demo — сценарий на стриме

1. **enabled = false** на video → Preview A и B **оба** гаснут. readyState в карточке — всё ещё `live`.  
2. **enabled = true** → картинка вернулась.  
3. **stop()** на video → preview пустой, readyState `ended`, кнопки disabled. Индикатор камеры в OS — погас.  
4. Вернуться на Шаг 1 → «Запросить камеру» снова.

### Зритель должен унести

> **enabled** — пауза, камера занята. **stop** — конец, нужен новый getUserMedia.

---

## Слайд 4 — `srcObject` vs `src`

### На стриме

> Почему для камеры не делают `URL.createObjectURL` и не подставляют в `src` — и как это связано с WebRTC.

### Под капотом — `src` — адрес ресурса

```html
<video src="https://example.com/video.mp4">
```

Браузер:
1. Качает файл по HTTP.
2. Декодирует **законченный** или **частично буферизованный** медиаресурс.
3. Можно seek, pause, duration.

### Под капотом — `srcObject` — живая ссылка на объект

```js
video.srcObject = mediaStream;
```

Браузер подключается к **MediaStream** в памяти — кадры приходят **по мере захвата**, без URL.

**Нельзя** сделать `src="mediaStream"` — это не строка-адрес.

### Под капотом — а что если Blob URL?

Теоретически: писать кадры в `MediaRecorder` → Blob → `URL.createObjectURL(blob)` → `src`.

Проблемы для live:
- **Задержка** — пока запишешь, уже не live.
- **Нет** нормального pipeline в WebRTC — туда передают **треки**, не blob URL.
- Лишние копии в памяти.

Для **записи** звонка — да, Blob/File. Для **preview и звонка** — MediaStream.

### Под капотом — мост к WebRTC (Шаг 5)

```js
pc.addTrack(videoTrack, stream);
```

В сеть уходит **track** — не файл, не URL. Получатель собирает **новый** MediaStream на своей стороне → `remoteVideo.srcObject = remoteStream`.

Если поняли «один stream — два video», поймёте и «один track — отправили в peer connection».

### В нашем коде

Везде preview через `VideoPreview` → только `srcObject`, никогда `src`.

### Зритель должен унести

> Камера и WebRTC — **MediaStream + srcObject**. `src` — для файлов по URL.

---

## Блок demo — полный сценарий (~3 мин)

### Порядок действий

1. Шаг 1 → запросить камеру.  
2. Шаг 2 → два preview, один stream.  
3. (Опционально) перезапрос с микрофоном → два трека в списке.  
4. Video track → `enabled = false` → оба preview off → `enabled = true`.  
5. Video track → `stop()` → ended, OS camera off.  
6. Шаг 1 → запросить снова.

### Под капотом — поток данных на Шаге 2

```
StreamContext.stream
       │
       ├─► VideoPreview A → video.srcObject
       ├─► VideoPreview B → video.srcObject
       └─► TrackList → track.enabled / track.stop()
```

Один источник правды — **контекст**. Шаги 3–5 будут использовать тот же stream.

### Переход

> Мы умеем **получать** поток и **управлять** треками. Дальше — **изменить** картинку: фильтр, зеркало. Классический путь — Canvas. **Шаг 3**.

---

## Шпаргалка

| Вопрос | Ответ |
|--------|--------|
| Два video — два stream? | Нет, один stream, два srcObject |
| enabled false — камера свободна? | Нет, только stop() |
| stop() — можно enabled true? | Нет, только новый getUserMedia |
| Почему tick / onUpdate? | track.enabled не триггерит React |
| Где audio на Шаге 1? | audio: false — намеренно |
| track.muted vs video muted | track — источник, video — плеер |

---

## Тайминг

| Время | Блок |
|-------|------|
| 0:00 | Слайд 1 + два preview |
| 2:30 | Слайд 2 + микрофон (опционально) |
| 5:00 | Слайд 3 + enabled / stop live |
| 8:00 | Слайд 4 |
| 9:30 | Переход → Шаг 3 |

Если отстаёшь: слайд 4 короче, **live enabled vs stop** не резать.
