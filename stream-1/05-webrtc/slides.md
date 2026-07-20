# Этап 6 — WebRTC: два ПК, copy-paste (6 слайдов)

> Длительность блока: ~12–15 мин  
> Demo: **Шаг 5** — Sender (камера) + Viewer (смотреть), одна Wi‑Fi

---

## Слайд 1 — WebRTC = P2P медиа

**Заголовок:**  
WebRTC — peer-to-peer медиа в браузере

**Буллеты:**
- Передача **audio/video** между устройствами
- Demo: камера на **Sender** → картинка на **Viewer**
- Signaling руками: **copy-paste** offer/answer
- Передаём **MediaStreamTrack**, не файл

**Схема:**

```
Sender: camera → addTrack → PC ──медиа──► PC → ontrack → Viewer video
                 └─ offer/answer (clipboard) ─┘
```

---

## Слайд 2 — Signaling = copy-paste

**Заголовок:**  
Signaling — обмен SDP (у нас буфер обмена)

| В prod | В нашем demo |
|--------|----------------|
| WebSocket / SIP | Copy-paste JSON `{ type, sdp }` |
| Два клиента | Два ПК, одна Wi‑Fi |

**Буллеты:**
- Signaling **не стандартизирован** — WebRTC только медиа-путь
- Передаём: **offer**, **answer** (candidates уже внутри SDP)
- Ждём `iceGatheringState === 'complete'` — один JSON, без trickle руками

**Заметка:**  
«Сервер signaling только знакомит peers».

---

## Слайд 3 — Offer / Answer (SDP)

**Заголовок:**  
SDP — «контракт» соединения

**Код на слайде:**

```js
// Sender
await pc.setLocalDescription(await pc.createOffer());
// wait ICE complete → Copy offer

// Viewer
await pc.setRemoteDescription(offer);
await pc.setLocalDescription(await pc.createAnswer());
// wait ICE complete → Copy answer

// Sender
await pc.setRemoteDescription(answer);
```

**Буллеты:**
- **Offer** — «хочу такое соединение»
- **Answer** — «ок, вот мой ответ»
- SDP — текст (кодеки, directions, fingerprint, candidates)

---

## Слайд 4 — ICE + STUN (одна Wi‑Fi)

**Заголовок:**  
ICE — как достучаться до peer

**Буллеты:**
- **ICE** — поиск пути (host / srflx / relay)
- В LAN часто хватает **host** + **STUN**
- **TURN** — если напрямую нельзя (сегодня не нужен)
- Log: `iceGathering → complete`, затем `ice → connected`

---

## Слайд 5 — `addTrack` / `ontrack`

**Заголовок:**  
Отправка и приём track

**Код на слайде:**

```js
// Sender
pc.addTrack(videoTrack, stream);

// Viewer
pc.ontrack = (e) => {
  remoteVideo.srcObject = e.streams[0];
};
```

**Буллеты:**
- Viewer **без** getUserMedia
- Remote — после encode/decode по сети
- Local (Sender) — до WebRTC; Remote (Viewer) — после

---

## Слайд 6 — Чеклист demo + что дальше

**Заголовок:**  
На сцене / за рамками

**Чеклист:**
1. `npm run dev -- --host`, общая Wi‑Fi  
2. Sender: Шаг 1 → Create offer → Copy  
3. Viewer: Paste → Create answer → Copy  
4. Sender: Apply answer → Viewer Remote live  

| Дальше | Зачем |
|--------|--------|
| WebSocket signaling | Без copy-paste |
| TURN | Чужие сети / жёсткий NAT |
| SFU | Много участников |
| Insertable → addTrack | Эффект в звонок |

---

## Переход к demo

→ Шаг 5: Sender / Viewer, copy-paste, Remote на втором ПК  
**Фраза:** «Signaling — руками; медиа уже само по WebRTC»
