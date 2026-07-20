# WebRTC — подробный конспект (простым языком)

**Назначение:** разбор WebRTC для доклада «From Camera to WebRTC».  
**Код:** `demo-app/src/lib/webrtcManualPeer.ts`, `demo-app/src/steps/Step5WebRTCManual.tsx`  
**Demo:** Шаг 5 — два компьютера, signaling copy-paste, одна Wi‑Fi

---

## 1. Что такое WebRTC

**WebRTC** (Web Real-Time Communication) — API браузера для передачи **видео, звука и данных** почти в реальном времени между участниками (peers).

| HTTP streaming | WebRTC |
|----------------|--------|
| Поток **с сервера** | Медиа часто **между peers** |
| Файл / HLS / DASH | Живой канал, низкая задержка |
| Play / seek | Звонок, screen share, live preview |

---

## 2. Главная идея

```
Sender (камера)  ──signaling (copy-paste)──  Viewer
       └──────── медиа (ICE / RTP) ──────────┘
```

- **Signaling** — договориться текстом (SDP offer/answer). У нас: буфер обмена.  
- **Медиа** — после handshake кадры идут сами по сети, не через copy-paste.

В prod signaling обычно WebSocket. Смысл тот же.

---

## 3. Роли в нашем demo

| Роль | ПК | Камера | Действия |
|------|-----|--------|----------|
| **Sender** | с камерой | Шаг 1 → да | Create offer → Apply answer |
| **Viewer** | второй | не нужна | Paste offer → Create answer → смотреть Remote |

На каждой вкладке — **один** `RTCPeerConnection` (не два в одной, как в старом loopback).

```ts
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});
```

---

## 4. Последовательность действий (пошагово)

### 4.1. Подготовка

1. Оба устройства в **одной Wi‑Fi**.  
2. На Sender: в каталоге `demo-app` запустить `npm run dev` (уже с `--host`).  
3. В терминале Vite покажет Network URL, например `http://192.168.1.10:5173`.  
4. На Viewer открыть этот URL в Chrome/Edge.  
5. На Sender: **Шаг 1** → разрешить камеру.

### 4.2. Sender создаёт offer

1. Шаг 5 → роль **Sender (камера)**.  
2. Нажать **Create offer**.  
3. В логе: `addTrack` → `createOffer` → `setLocalDescription` → ждём `iceGatheringState → complete`.  
4. В левом поле — JSON `{ "type": "offer", "sdp": "..." }` (SDP **уже с ICE candidates**).  
5. **Copy** → передать Viewer (мессенджер, AirDrop, почта — канал signaling любой).

**Зачем ждать ICE complete:** чтобы не копировать candidates по одному (trickle). Один кусок текста = весь handshake-пакет для Viewer.

### 4.3. Viewer принимает offer и делает answer

1. Шаг 5 → роль **Viewer (смотреть)**.  
2. Вставить JSON offer в правое поле.  
3. **Create answer**.  
4. Внутри: `setRemoteDescription(offer)` → `createAnswer` → `setLocalDescription` → снова ждать ICE complete.  
5. **Copy** answer → вернуть Sender.

Камера на Viewer **не** запрашивается. Local preview пустой — это нормально.

### 4.4. Sender применяет answer

1. Вставить JSON answer в правое поле.  
2. **Apply answer** → `setRemoteDescription(answer)`.  
3. Signaling закончен (`signalingState → stable`).  
4. ICE ищет путь → `connected`.  
5. На Viewer срабатывает `ontrack` → Remote video с камерой Sender.

### 4.5. Остановка

**Stop** на любой стороне → `pc.close()`.  
Поток камеры в `StreamContext` на Sender можно оставить (Шаг 1) или остановить отдельно.

---

## 5. Что происходит в коде на каждом шаге

### Sender: создать peer и положить трек

```ts
const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });

for (const track of localStream.getTracks()) {
  pc.addTrack(track, localStream); // камера с Шага 1
}

pc.ontrack = ...; // у Sender обычно не нужен (мы только шлём)
```

### Sender: offer + ICE gathering

```ts
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
await waitForIceGatheringComplete(pc);
// Copy: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
```

### Viewer: принять offer, отдать answer

```ts
await pc.setRemoteDescription(offerFromClipboard);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
await waitForIceGatheringComplete(pc);
// Copy answer обратно Sender
```

### Viewer: показать remote

```ts
pc.ontrack = (event) => {
  setRemoteStream(event.streams[0]); // → <video srcObject>
};
```

### Sender: закрыть signaling

```ts
await pc.setRemoteDescription(answerFromClipboard);
// дальше браузеры сами гоняют медиа по найденному ICE path
```

---

## 6. Почему copy-paste — это нормальный signaling

WebRTC стандартизирует:

- как описать сессию (**SDP**);
- как найти путь (**ICE**);
- как слать медиа (**RTP/SRTP**).

WebRTC **не** стандартизирует:

- доставку offer/answer между людьми/приложениями.

Поэтому:

| Способ | Где |
|--------|-----|
| Copy-paste | наш Шаг 5 |
| WebSocket | Zoom / Meet / свой бэкенд |
| Даже QR / SMS | тоже валидный signaling |

Смысл для доклада: «сервер signaling только **знакомит** peers; видео потом часто идёт P2P».

---

## 7. SDP, ICE, состояния — шпаргалка

| Термин | Простыми словами |
|--------|------------------|
| **SDP** | Текстовый договор: кодеки, треки, fingerprint, candidates |
| **Offer** | Предложение Sender |
| **Answer** | Ответ Viewer |
| **ICE** | Перебор адресов, пока не найдётся рабочий путь |
| **STUN** | «Скажи мой внешний адрес» (у нас в demo включён) |
| **TURN** | Relay, если напрямую нельзя (в одной Wi‑Fi обычно не нужен) |

| State в UI | О чём |
|------------|--------|
| `signaling` | Идёт ли offer/answer |
| `ice gathering` | Собираем candidates (`complete` = можно копировать SDP) |
| `ice` | Проверка пути (`checking` → `connected`) |
| `connection` | Итог PC (`connected` / `failed` / `closed`) |

---

## 8. Типичные проблемы на демо

| Симптом | Что проверить |
|---------|----------------|
| Viewer не открывает страницу | `--host`, один Wi‑Fi, правильный IP, файрвол |
| Create offer серый | На Sender нет live-камеры (Шаг 1) |
| Apply answer неактивен | Сначала Create offer на этом же Sender (та же сессия PC) |
| JSON ошибка | Вставлять целиком то, что дала кнопка Copy |
| SDP обменяли, Remote чёрный | Разные сети / жёсткий NAT → для LAN редко; смотреть log `ice` / `failed` |
| Камера на Viewer по HTTP IP | Viewer камеру **не** просит — ок |

---

## 9. Связь с путём доклада

```
Шаг 1  getUserMedia              → MediaStream на Sender
Шаг 2  tracks                    → enabled / stop / muted
Шаг 3  Canvas + captureStream    → новый поток с эффектом
Шаг 4  Insertable Streams        → VideoFrame pipeline
Шаг 5  WebRTC 2 ПК (copy-paste)  → track уходит на Viewer
```

Опционально позже: на Sender вместо «сырой» камеры отдать track после Шага 3/4 — в звонок уйдёт уже обработанная картинка.

---

## 10. Три фразы унести со сцены

1. **WebRTC** передаёт **треки** между peers в real-time.  
2. **Signaling** отдельно: offer/answer можно даже copy-paste — это не «магия сервера видео».  
3. Сначала **договор (SDP + ICE)**, потом **медиа** по найденному пути; Viewer смотрит камеру Sender через `ontrack`.

---

## 11. Шпаргалка по файлам

| Файл | Зачем |
|------|--------|
| `lib/webrtcManualPeer.ts` | Один PC, offer/answer, wait ICE complete, STUN |
| `steps/Step5WebRTCManual.tsx` | Роли Sender/Viewer, textarea, Copy, log |
| `05-webrtc/speaker-notes.md` | Сценарий выступления + чеклист demo |
| `05-webrtc/webrtc-connection-setup.png` | Схема handshake |
| Этот файл | Подробный конспект + последовательность действий |
