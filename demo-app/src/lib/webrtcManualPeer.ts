/**
 * Для demo в одной Wi‑Fi STUN не нужен: host-кандидаты собираются сразу.
 * Публичный STUN часто тормозит offer на 5–30+ сек (ожидание ответа/таймаута).
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [];

/** Страховка, если браузер долго не ставит gathering = complete. */
const ICE_GATHER_TIMEOUT_MS = 1500;

export type PeerRole = 'sender' | 'viewer';

export interface PeerSnapshot {
  signaling: RTCSignalingState;
  ice: RTCIceConnectionState;
  iceGathering: RTCIceGatheringState;
  connection: RTCPeerConnectionState;
}

export interface SenderPeerCallbacks {
  onStateChange: (snapshot: PeerSnapshot) => void;
  onLocalSdp: (sdp: RTCSessionDescriptionInit) => void;
}

export interface ViewerPeerCallbacks {
  onStateChange: (snapshot: PeerSnapshot) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onLocalSdp: (sdp: RTCSessionDescriptionInit) => void;
}

export interface SenderPeerSession {
  role: 'sender';
  stop: () => void;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  acceptAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
}

export interface ViewerPeerSession {
  role: 'viewer';
  stop: () => void;
  acceptOfferAndCreateAnswer: (
    offer: RTCSessionDescriptionInit,
  ) => Promise<RTCSessionDescriptionInit>;
}

export type ManualPeerSession = SenderPeerSession | ViewerPeerSession;

function readSnapshot(pc: RTCPeerConnection): PeerSnapshot {
  return {
    signaling: pc.signalingState,
    ice: pc.iceConnectionState,
    iceGathering: pc.iceGatheringState,
    connection: pc.connectionState,
  };
}

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      pc.removeEventListener('icegatheringstatechange', onChange);
      window.clearTimeout(timer);
      resolve();
    };

    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        finish();
      }
    };

    const timer = window.setTimeout(finish, ICE_GATHER_TIMEOUT_MS);

    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

function attachStateListeners(
  pc: RTCPeerConnection,
  onStateChange: (snapshot: PeerSnapshot) => void,
): () => void {
  const notifyState = () => onStateChange(readSnapshot(pc));

  pc.onconnectionstatechange = notifyState;
  pc.oniceconnectionstatechange = notifyState;
  pc.onicegatheringstatechange = notifyState;
  pc.onsignalingstatechange = notifyState;

  notifyState();
  return notifyState;
}

async function localDescriptionPayload(
  pc: RTCPeerConnection,
  label: string,
): Promise<RTCSessionDescriptionInit> {
  await waitForIceGatheringComplete(pc);
  const local = pc.localDescription;
  if (!local) {
    throw new Error(`localDescription пуст после ${label}`);
  }
  return { type: local.type, sdp: local.sdp };
}

export function parseSessionDescription(raw: string): RTCSessionDescriptionInit {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Пустой SDP — вставьте offer или answer');
  }

  const parsed = JSON.parse(trimmed) as RTCSessionDescriptionInit;
  if (!parsed.type || !parsed.sdp) {
    throw new Error('JSON должен содержать type и sdp (кнопка Copy)');
  }
  return { type: parsed.type, sdp: parsed.sdp };
}

export function formatSessionDescription(desc: RTCSessionDescriptionInit): string {
  return JSON.stringify({ type: desc.type, sdp: desc.sdp }, null, 2);
}

/** Sender: камера → offer, потом принимает answer. Remote video не ждёт. */
export function createSenderPeer(options: {
  localStream: MediaStream;
  iceServers?: RTCIceServer[];
  callbacks: SenderPeerCallbacks;
}): SenderPeerSession {
  const { localStream, callbacks } = options;
  const iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
  const { onStateChange, onLocalSdp } = callbacks;

  const pc = new RTCPeerConnection({ iceServers });
  const notifyState = attachStateListeners(pc, onStateChange);

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  return {
    role: 'sender',
    stop: () => {
      pc.close();
      notifyState();
    },
    createOffer: async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const payload = await localDescriptionPayload(pc, 'offer');
      onLocalSdp(payload);
      notifyState();
      return payload;
    },
    acceptAnswer: async (answer) => {
      await pc.setRemoteDescription(answer);
      notifyState();
    },
  };
}

/** Viewer: принимает offer → answer, показывает remote stream через ontrack. */
export function createViewerPeer(options: {
  iceServers?: RTCIceServer[];
  callbacks: ViewerPeerCallbacks;
}): ViewerPeerSession {
  const { callbacks } = options;
  const iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
  const { onStateChange, onRemoteStream, onLocalSdp } = callbacks;

  const pc = new RTCPeerConnection({ iceServers });
  const notifyState = attachStateListeners(pc, onStateChange);

  pc.ontrack = (event) => {
    const remote =
      event.streams[0] ?? new MediaStream(event.track ? [event.track] : []);
    onRemoteStream(remote);
  };

  return {
    role: 'viewer',
    stop: () => {
      pc.close();
      onRemoteStream(null);
      notifyState();
    },
    acceptOfferAndCreateAnswer: async (offer) => {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const payload = await localDescriptionPayload(pc, 'answer');
      onLocalSdp(payload);
      notifyState();
      return payload;
    },
  };
}
