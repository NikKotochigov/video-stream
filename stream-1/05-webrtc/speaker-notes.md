# Этап 6 — Speaker notes: WebRTC (два компьютера, copy-paste)

**Общее время:** ~12–15 мин  
**Demo:** Шаг 5 — два ПК в одной Wi‑Fi  
**Код:** `lib/webrtcManualPeer.ts`, `steps/Step5WebRTCManual.tsx`  
**Переход:** «Путь от камеры до WebRTC пройден» → финал / Q&A

**Формат:** На стриме → Под капотом → В нашем коде → Зритель должен унести

---

## WebRTC = P2P медиа

### На стриме

> Мы умеем получать поток, управлять треками, обрабатывать кадры. Финал — **отправить медиа по WebRTC на другой компьютер**.  
> Signaling — **руками**: copy-paste offer/answer. Камера на **Sender** → картинка на **Viewer**.

### Под капотом — что такое WebRTC

| API | Роль |
|-----|------|
| `RTCPeerConnection` | Соединение: SDP, ICE, send/receive tracks |
| `MediaStreamTrack` | Что передаём (video/audio) |
| `RTCDataChannel` | Произвольные данные (сегодня не demo) |

**Не HTTP streaming.** Медиа идёт по ICE path (часто UDP), после handshake.

### Под капотом — наш demo vs prod

| | Demo (Шаг 5) | Prod (звонок) |
|---|--------------|---------------|
| Устройства | 2 ПК, одна Wi‑Fi | Любые сети |
| Signaling | **Copy-paste** JSON `{ type, sdp }` | WebSocket / SIP |
| ICE | STUN + host (LAN) | STUN + часто TURN |
| Роли | Sender шлёт камеру, Viewer смотрит | Обычно двусторонне / SFU |

### В нашем коде

- `createManualPeer({ role: 'sender' | 'viewer' })` — **один** PC на вкладку  
- Ждём `iceGatheringState === 'complete'`, чтобы в SDP уже были candidates (удобно для рук)  
- UI: роль, Create offer / Create answer / Apply answer, Copy

### Зритель должен унести

> WebRTC передаёт **треки**. Signaling — отдельно: у нас это буфер обмена, в prod — сервер.

---

## Последовательность действий в demo (говори вслух)

### Подготовка сети

1. Оба ПК в **одной Wi‑Fi**.  
2. На ПК с камерой: `npm run dev` (vite с `--host`).  
3. Узнать IP Sender (например `192.168.1.10`).  
4. Viewer открывает `http://192.168.1.10:5173` — **камера на Viewer не нужна**.

### На Sender (ПК с камерой)

1. **Шаг 1** → запросить камеру.  
2. **Шаг 5** → роль **Sender (камера)**.  
3. **Create offer** → ждём ICE gathering → в поле появляется JSON.  
4. **Copy** → передать Viewer (AirDrop / мессенджер / USB-текст — неважно).

### На Viewer (второй ПК)

1. **Шаг 5** → роль **Viewer (смотреть)**.  
2. Вставить offer в правое поле.  
3. **Create answer** → ждать ICE → JSON answer.  
4. **Copy** → вернуть Sender.

### Снова на Sender

1. Вставить answer в правое поле.  
2. **Apply answer**.  
3. Смотреть лог: `connectionState → connected`.  
4. На **Viewer** в Remote появляется камера Sender.

### Stop

На любой стороне **Stop** → `pc.close()`. Камера на Шаге 1 при этом может остаться живой.

### Что сказать зрителям

> Мы только что сделали то же, что signaling-сервер: перенесли offer и answer между двумя peers. Медиа пошло уже **мимо** буфера обмена — по WebRTC.

---

## Signaling

### На стриме

> WebRTC **не говорит**, как доставить offer. Это **signaling** — отдельный канал.  
> Prod: WebSocket. Demo: **copy-paste**. Смысл один: peer должен получить чужой SDP.

### Под капотом — что передаём

1. **SDP offer** — Sender → Viewer  
2. **SDP answer** — Viewer → Sender  
3. **ICE candidates** — у нас **внутри SDP**: ждём `iceGatheringState === 'complete'`, не гоняем trickle руками

### Под капотом — почему так удобно для рук

Trickle ICE (`onicecandidate` по одному) для live-демо неудобен.  
**Non-trickle:** после `setLocalDescription` ждём complete → копируем **один** JSON со всеми candidates.

```ts
await pc.setLocalDescription(offer);
await waitForIceGatheringComplete(pc);
// pc.localDescription уже с candidates → Copy
```

### Зритель должен унести

> Signaling — «почта» для SDP. WebRTC — медиа **после** handshake.

---

## Offer / Answer (SDP)

### На стриме

> **Offer** — «хочу соединиться, вот кодеки и треки». **Answer** — «принимаю». Оба — текст SDP в JSON.

### Под капотом — state

| Шаг | Sender | Viewer |
|-----|--------|--------|
| Create offer + setLocal | `have-local-offer` | — |
| setRemote(offer) | | `have-remote-offer` |
| createAnswer + setLocal | | → `stable` |
| setRemote(answer) | `stable` | `stable` |

В панели demo: `signaling`, `ice gathering`, `ice`, `connection`.

### В нашем коде

```ts
// Sender
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
await waitForIceGatheringComplete(pc);
// → formatSessionDescription → Copy

// Viewer
await pc.setRemoteDescription(offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
await waitForIceGatheringComplete(pc);
// → Copy answer

// Sender
await pc.setRemoteDescription(answer);
```

### Зритель должен унести

> Offer/Answer — обмен **описанием** соединения, не кадрами видео.

---

## ICE / STUN (одна Wi‑Fi)

### На стриме

> SDP договорился «что» слать. **ICE** ищет «**как** достучаться». В одной Wi‑Fi обычно хватает host + STUN.

### Под капотом

| Тип | Когда |
|-----|--------|
| host | Локальный IP в LAN |
| srflx | Через STUN (внешний адрес) |
| relay | TURN — нам сегодня не нужен |

В коде:

```ts
new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});
```

### Live demo

Log: `iceGatheringState → complete` → потом `iceConnectionState → connected`.

### Зритель должен унести

> ICE — путь пакетов. Copy-paste несёт candidates внутри SDP; медиа едет уже само.

---

## addTrack / ontrack

### На стриме

> Sender: `addTrack(камера)`. Viewer: `ontrack` → Remote `<video>`.  
> Viewer **не** вызывает getUserMedia.

### В нашем коде

```ts
// Sender
for (const track of localStream.getTracks()) {
  pc.addTrack(track, localStream);
}

// Viewer
pc.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};
```

Local на Sender — `StreamContext` (Шаг 1).  
Remote на Viewer — stream из `ontrack`.

### Зритель должен унести

> Local — до WebRTC. Remote — после encode/decode по сети.

---

## Что дальше

### На стриме

> Copy-paste — учебный signaling. В продуктах: WebSocket + часто SFU + TURN.  
> Следующий уровень — обработанный track (Canvas / Insertable) сразу в звонок.

### Переход

> Резюме: camera → stream → tracks → canvas/insertable → WebRTC на второй ПК.

---

## Demo — краткий чеклист на сцене

1. Wi‑Fi общая, `npm run dev -- --host`, IP на экране.  
2. Sender: Шаг 1 → камера → Шаг 5 → Create offer → Copy.  
3. Viewer: Paste offer → Create answer → Copy.  
4. Sender: Paste answer → Apply.  
5. Viewer: Remote live. Log: `connected` / `ontrack`.  
6. Stop.

### Поток данных

```
Sender ПК                         Viewer ПК
─────────                         ─────────
Шаг 1: getUserMedia
   │
   ▼
pc.addTrack ──offer (copy)──► setRemote(offer)
   │                              │
   │                         createAnswer
   │◄────answer (copy)────────────┘
setRemote(answer)
   │
   └─── медиа (ICE / RTP) ───► ontrack → Remote <video>
```

---

## Шпаргалка

| Вопрос | Ответ |
|--------|--------|
| Зачем copy-paste? | Signaling без сервера; тот же SDP, что по WebSocket |
| Sender / Viewer? | Шлёт камеру / только смотрит |
| Почему ждать ICE complete? | Чтобы candidates попали в один JSON |
| Local vs Remote? | До и после WebRTC |
| Нужна ли камера Viewer? | Нет |
| Одна Wi‑Fi? | Да для этого demo; иначе может понадобиться TURN |
| Где код? | `webrtcManualPeer.ts`, `Step5WebRTCManual.tsx` |
