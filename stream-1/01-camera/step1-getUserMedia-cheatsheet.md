# Шаг 1 — getUserMedia: конспект для демо

**Demo:** `localhost:5173` → Шаг 1  
**Код:** `Step1CameraAccess.tsx` · `lib/camera.ts` · `VideoPreview.tsx` · `TrackInfoPanel.tsx` · `StreamContext`

Цель шага: получить живой `MediaStream` с камеры и показать его в `<video>` через `srcObject`.

---

## Что делаем последовательно

| # | Нажимаем / делаем | Что видим на экране | Под капотом |
|---|-------------------|---------------------|-------------|
| 1 | Открываем Шаг 1 | Пресеты `720p` / `1080p`, кнопка «Запросить камеру», пустой preview | `stream === null` в `StreamContext` |
| 2 | (Опционально) выбираем пресет **720p** или **1080p** | Активная кнопка-тоггл | В state кладётся `presetId` → берём `CAMERA_PRESETS[…].constraints` |
| 3 | **Запросить камеру** | Кнопка → «Запрос…», кнопки disabled | `setLoading(true)` → `await navigator.mediaDevices.getUserMedia(constraints)` |
| 4 | Диалог браузера: **Allow** | — | Браузер → ОС → драйвер камеры; создаётся `MediaStream` + video `MediaStreamTrack` |
| 5 | (Если Block / ошибка) | Красный alert | Promise reject → `getUserMediaErrorMessage(err)` |
| 6 | Успех | Preview оживает, справа панель track | `setStream(mediaStream)` → React re-render → `video.srcObject = stream` |
| 7 | Смотрим панель справа | id, label, readyState, **actual** width/height/fps | `track.getSettings()` = факт; requested = то, что передали в getUserMedia |
| 8 | Меняем пресет → **Перезапросить камеру** | Новый запрос, preview может смениться | Новый `getUserMedia`; старый stream: `track.stop()` в `setStream` |
| 9 | **Остановить** | «Камера не запущена», индикатор OS гаснет | `clearStream()` → `setStream(null)` → `stop()` всех tracks |

---

## Цепочка одного клика «Запросить камеру»

```
Клик
  → setLoading(true)
  → getUserMedia(constraints)          // JS ждёт Promise
      → браузер: secure context? permissions?
      → нативный диалог Allow / Block (если нужно)
      → ОС открывает камеру
      → MediaStream { video track: live }
  → setStream(stream)                  // context; старый stop()
  → VideoPreview useEffect
      → video.srcObject = stream
      → autoPlay + playsInline + muted → кадры на экран
  → TrackInfoPanel
      → getSettings() / getConstraints()
  → setLoading(false)
```

Слои: **ваш код → браузер (политики + UI) → ОС → камера**. Страница к железу напрямую не ходит.

---

## Constraints (что передаём)

Пресеты из `lib/camera.ts`:

| Пресет | video | audio |
|--------|-------|-------|
| 720p | `width: { ideal: 1280 }`, `height: { ideal: 720 }`, `frameRate: { ideal: 30 }` | `false` |
| 1080p | `ideal: 1920×1080`, `frameRate: { ideal: 30 }` | `false` |

- **`ideal`** — пожелание, не приказ. Браузер может дать меньше → смотри **actual** в панели.
- **`audio: false`** — не просим микрофон, в потоке только video track.

| Метод | Смысл |
|-------|--------|
| `getSettings()` | Что **реально** идёт с камеры сейчас |
| `getConstraints()` | Что браузер считает применённым на track |
| requested (UI) | Что мы передали в `getUserMedia` |

---

## Preview: почему так настроен `<video>`

| Атрибут / свойство | Зачем |
|--------------------|--------|
| `srcObject = stream` | Живой поток (не файл). Не путать с `src="url"` |
| `autoPlay` | Иначе может быть чёрный кадр до `play()` |
| `playsInline` | iOS: без fullscreen |
| `muted` | Autoplay policy (даже без audio track) |

`srcObject` в React только через ref + `useEffect` — prop’а нет.

---

## Ошибки (имя = диагноз)

| `DOMException.name` | Когда | Что делать |
|---------------------|--------|------------|
| `NotAllowedError` | Block / запрет в настройках сайта | Замок в адресной строке → Camera → Allow |
| `NotFoundError` | Нет камеры | Подключить / проброс USB в VM |
| `NotReadableError` | Камера занята | Закрыть Zoom / другую вкладку |
| `OverconstrainedError` | Не подобрали режим (часто `exact`) | Ослабить constraints → `ideal` |
| `SecurityError` | Не HTTPS и не localhost | Secure context |

---

## Мини-сценарий на стриме (2–3 мин)

1. **720p → Запросить → Allow** — preview + `readyState: live`, прочитать actual width/height.
2. **1080p → Перезапросить** — сравнить actual; если те же цифры: «constraints — wish list».
3. **Остановить** — tracks `ended`, камера свободна.
4. Переход: «Поток есть — что с ним можно делать?» → **Шаг 2**.

---

## Одна мысль на выход

> Камера начинается с `navigator.mediaDevices.getUserMedia` → `MediaStream` → показ через `video.srcObject`. Constraints — пожелания; истина — в `track.getSettings()`.
