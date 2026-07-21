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

export interface ManualPeerCallbacks {
  onStateChange: (snapshot: PeerSnapshot) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onLocalSdp: (sdp: RTCSessionDescriptionInit) => void;
}

export interface ManualPeerSession {
  role: PeerRole;
  stop: () => void;
  /** Sender: create offer (with ICE gathered). */
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  /** Viewer: apply remote offer, create answer (with ICE gathered). */
  acceptOfferAndCreateAnswer: (
    offer: RTCSessionDescriptionInit,
  ) => Promise<RTCSessionDescriptionInit>;
  /** Sender: apply remote answer. */
  acceptAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
}

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

export function createManualPeer(options: {
  role: PeerRole;
  localStream?: MediaStream | null;
  iceServers?: RTCIceServer[];
  callbacks: ManualPeerCallbacks;
}): ManualPeerSession {
  const { role, localStream, callbacks } = options;
  const iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
  const { onStateChange, onRemoteStream, onLocalSdp } = callbacks;

  const pc = new RTCPeerConnection({ iceServers });

  const notifyState = () => onStateChange(readSnapshot(pc));

  pc.onconnectionstatechange = notifyState;
  pc.oniceconnectionstatechange = notifyState;
  pc.onicegatheringstatechange = notifyState;
  pc.onsignalingstatechange = notifyState;

  pc.ontrack = (event) => {
    const remote =
      event.streams[0] ?? new MediaStream(event.track ? [event.track] : []);
    onRemoteStream(remote);
  };

  if (role === 'sender') {
    if (!localStream) {
      throw new Error('Sender: нужен localStream с камеры (Шаг 1)');
    }
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }

  notifyState();

  return {
    role,
    stop: () => {
      pc.close();
      onRemoteStream(null);
      notifyState();
    },
    createOffer: async () => {
      if (role !== 'sender') {
        throw new Error('createOffer только у sender');
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      const local = pc.localDescription;
      if (!local) {
        throw new Error('localDescription пуст после offer');
      }
      const payload: RTCSessionDescriptionInit = { type: local.type, sdp: local.sdp };
      onLocalSdp(payload);
      notifyState();
      return payload;
    },
    acceptOfferAndCreateAnswer: async (offer) => {
      if (role !== 'viewer') {
        throw new Error('acceptOffer только у viewer');
      }
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGatheringComplete(pc);
      const local = pc.localDescription;
      if (!local) {
        throw new Error('localDescription пуст после answer');
      }
      const payload: RTCSessionDescriptionInit = { type: local.type, sdp: local.sdp };
      onLocalSdp(payload);
      notifyState();
      return payload;
    },
    acceptAnswer: async (answer) => {
      if (role !== 'sender') {
        throw new Error('acceptAnswer только у sender');
      }
      await pc.setRemoteDescription(answer);
      notifyState();
    },
  };
}
