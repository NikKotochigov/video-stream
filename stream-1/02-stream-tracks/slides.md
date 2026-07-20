# Этап 3 — MediaStream & tracks (4 слайда)

> Длительность блока: ~10 мин  
> Demo: **Шаг 2** в `localhost:5173`

---

## Слайд 1 — MediaStream = набор треков

**Заголовок:**  
`MediaStream` — контейнер, не файл

**Схема:**

```
MediaStream { id, active }
  ├── MediaStreamTrack  kind: "video"
  └── MediaStreamTrack  kind: "audio"
```

**Буллеты:**
- Один поток — **несколько треков** (видео + аудио)
- `stream.getVideoTracks()` / `getAudioTracks()` / `getTracks()`
- `stream.active` — `false`, когда все треки `ended`
- Один `MediaStream` → **несколько** `<video>`: одна и та же картинка

**Заметка:**  
Акцент: поток — «коробка», треки — «ручейки данных».

---

## Слайд 2 — Video track vs Audio track

**Заголовок:**  
Два типа треков — разное поведение

| | Video track | Audio track |
|---|-------------|-------------|
| Что несёт | Кадры | Звук |
| Выключить в UI | Чёрный экран | Тишина |
| `track.muted` | Редко меняется | Системный mute (hardware) |
| `track.enabled` | Пауза картинки | Пауза звука |

**Буллеты:**
- `muted` на track — **read-only**, выставляет браузер/ОС (особенно audio)
- `enabled` — **мы управляем**: `true` / `false`
- На Step 1 был только video — на Step 2 добавим audio

**Заметка:**  
Не путать `video.muted` (атрибут тега) и `track.muted` (состояние трека).

---

## Слайд 3 — `enabled` vs `stop()`

**Заголовок:**  
Пауза ≠ освобождение камеры

| Действие | `track.enabled = false` | `track.stop()` |
|----------|-------------------------|----------------|
| Камера занята? | **Да** | **Нет** |
| Можно включить обратно? | **Да**, `enabled = true` | **Нет**, нужен новый getUserMedia |
| `readyState` | остаётся `"live"` | становится `"ended"` |
| Когда использовать | Mute камеры в звонке | Уйти со страницы, сменить устройство |

**Код на слайде:**

```js
// пауза
videoTrack.enabled = false;

// освободить устройство
videoTrack.stop();
```

**Заметка:**  
Live demo: enabled — оба preview гаснут; stop — индикатор камеры в OS погаснет.

---

## Слайд 4 — `srcObject` vs `src`

**Заголовок:**  
Почему не Blob URL для камеры

**Сравнение:**

| | `srcObject = MediaStream` | `src = blob:...` |
|---|---------------------------|------------------|
| Данные | Живой поток | Статичный файл/Blob |
| Камера | Напрямую | Нужно сначала записать |
| Задержка | Минимальная | Выше |
| WebRTC | Передаём треки | Не подходит для live |

**Буллеты:**
- Для камеры и WebRTC — всегда **MediaStream** + `srcObject`
- `URL.createObjectURL(blob)` — для **записанного** видео, не для live
- В WebRTC передаём **треки**, не «файл целиком»

**Заметка:**  
Мост к WebRTC на Шаге 5: `pc.addTrack(track, stream)`.

---

## Переход к demo

→ Шаг 2: два preview, toggle enabled, stop track  
**Фраза:** «Поток понятен — хотим менять картинку» → Canvas, Шаг 3
