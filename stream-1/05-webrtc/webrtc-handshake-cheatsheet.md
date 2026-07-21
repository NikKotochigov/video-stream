# WebRTC (два компьютера): простая шпаргалка

**Схема:** [`webrtc-overview.svg`](./webrtc-overview.svg) · [`webrtc-overview.png`](./webrtc-overview.png)

Каждое WebRTC-соединение удобно объяснять как **3 части**:

1. **Signaling** — чтобы договориться о старте соединения (как передать друг другу `offer`/`answer`).
2. **Peer Connection** — создать объект `RTCPeerConnection`, который будет обмениваться данными.
3. **Обмен офферами (SDP)** — договориться о том, **какие медиа** и **как** будут передаваться.

После handshake медиа идут уже сами по найденному пути (часто UDP), а не «через signaling».

---

## ICE: как находится путь между двумя peer’ами

**ICE (Internet Connection Establishment)** — это процесс поиска пути, по которому два клиента смогут связаться **даже если они за NAT/файрволом**.

ICE опирается на кандидаты (candidates) — это «варианты адресов/способов связаться».

### NAT и файрвол (коротко)

| | Простыми словами | Проблема для WebRTC |
|---|---|---|
| **NAT** | Роутер прячет локальные адреса (`192.168…`) за одним публичным IP | Снаружи не видно «настоящий» адрес устройства |
| **Файрвол** | Охранник сети: какой трафик пускать, какой нет | Может запретить прямое соединение |

Поэтому нужны ICE / STUN / иногда TURN.

### STUN
**STUN** помогает клиентам узнать свой адрес так, как их может увидеть другая сторона.

Простая формулировка:
**STUN** = «Скажи мне мой внешний IP:порт, как меня видит интернет».

### TURN
**TURN** включают, когда прямое соединение не получилось.

TURN выступает промежуточным узлом, через который гоняются данные.

Простая формулировка:
**TURN** = «Если напрямую никак — гоняй видео через меня».

В одной Wi‑Fi сети обычно хватает `host` candidates (и часто STUN/TURN не требуется). В вашем demo `iceServers` задаётся пустым массивом.

---

## SDP: что за текст и зачем он нужен

**SDP (Session Description Protocol)** — формат описания медиа-сессии:
- какие кодеки и потоки планируются,
- параметры отправки/приёма,
- и (важно для demo) адреса из ICE-кандидатов, когда они уже собраны.

В WebRTC SDP обменивают как:
- **offer** — предложение Sender,
- **answer** — ответ Viewer.

---

## Методы на практике (ваш код, simple flow)

### Sender: `pc.createOffer()`
Это метод `RTCPeerConnection`: браузер генерирует локальный **offer** (текст SDP).

`createOffer()` = «сгенерируй SDP-предложение по тому, что уже есть в `pc` (треки, настройки и т.д.)».

**В вашем demo** `addTrack(...)` делается до `createOffer`, чтобы в offer попала информация о видео.

### Sender: `pc.setLocalDescription(offer)`
Фиксирует `offer` как **локальное** описание этого `pc`.

Что внутри обычно происходит:
1. `pc.localDescription = offer`
2. запуск **ICE gathering**
3. в локальный SDP постепенно дописываются candidates

Поскольку вы копируете SDP **одним JSON**, вы ждёте завершения gathering:

`waitForIceGatheringComplete(pc)` = «подожди, пока candidates соберутся, чтобы в SDP были адреса».

Потом готовый JSON (типа `{ type: "offer", sdp: "..." }`) показывается в textarea и копируется на Viewer.

---

### Viewer: `pc.setRemoteDescription(offer)`
Viewer говорит браузеру: «вот что предложил Sender».

Браузер узнаёт из offer:
- какие медиа планируются,
- как Sender примерно будет доступен (ICE candidates внутри SDP).

### Viewer: `const answer = pc.createAnswer()`
Браузер смотрит на remote offer и формирует **answer**: «ок, принимаю, вот мои условия».

У Viewer нет камеры как sender-трека, поэтому answer обычно про приём.

### Viewer: `pc.setLocalDescription(answer)` + ожидание ICE
Viewer фиксирует свой answer локально и снова ждёт gathering, чтобы в answer были адреса Viewer.

Потом JSON answer копируется обратно на Sender.

---

### Sender: `pc.setRemoteDescription(answer)` (метод `acceptAnswer`)
Sender принимает answer Viewer:
1. signaling SDP handshake завершён (у обоих peer’ов local/remote description готовы)
2. браузеры начинают **ICE checks** — пробуют связаться по комбинациям candidates

---

## Что происходит дальше после “Apply answer”

После того как Sender применил `answer`:

1. **ICE checks** (автоматически)
   - проверяются пары адресов вида: `Sender-candidate ↔ Viewer-candidate`
   - в одной Wi‑Fi это часто происходит быстро

2. **connection → connected**
   - путь найден, handshake завершён

3. **Видео появляется у Viewer**
   - у Viewer срабатывает `pc.ontrack`
   - вызывается `onRemoteStream(...)`
   - в `<video>` появляется картинка (Remote)

---

## Мини-схема (как в интерфейсе)

```text
Sender:   Create offer → Copy
Viewer:   Paste offer → Create answer → Copy
Sender:   Paste answer → Apply answer  ← тут соединение начинает “дожиматься”
          ↓
       ICE checks → connected
          ↓
       видео на Viewer
```

---

## Одной фразой
После `Apply answer` браузеры сами находят путь по Wi‑Fi и запускают видеопоток — вы больше не “направляете” медиа, только обеспечили обмен SDP (signaling).

