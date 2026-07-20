export interface LoopbackSnapshot {
  signalingA: RTCSignalingState;
  signalingB: RTCSignalingState;
  iceA: RTCIceConnectionState;
  iceB: RTCIceConnectionState;
  connectionA: RTCPeerConnectionState;
  connectionB: RTCPeerConnectionState;
}

export interface WebRTCLoopbackCallbacks {
  onStateChange: (snapshot: LoopbackSnapshot) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onLog: (message: string) => void;
}

export interface WebRTCLoopbackSession {
  stop: () => void;
}

function wireIceExchange(a: RTCPeerConnection, b: RTCPeerConnection) {
  const pendingForA: RTCIceCandidateInit[] = [];
  const pendingForB: RTCIceCandidateInit[] = [];
  let aRemoteReady = false;
  let bRemoteReady = false;

  const flush = async (
    target: RTCPeerConnection,
    pending: RTCIceCandidateInit[],
  ) => {
    while (pending.length > 0) {
      const candidate = pending.shift();
      if (candidate) {
        await target.addIceCandidate(candidate);
      }
    }
  };

  a.onicecandidate = (event) => {
    if (!event.candidate) return;
    const candidate = event.candidate.toJSON();
    if (bRemoteReady) {
      void b.addIceCandidate(candidate);
    } else {
      pendingForB.push(candidate);
    }
  };

  b.onicecandidate = (event) => {
    if (!event.candidate) return;
    const candidate = event.candidate.toJSON();
    if (aRemoteReady) {
      void a.addIceCandidate(candidate);
    } else {
      pendingForA.push(candidate);
    }
  };

  return {
    markARemoteReady: async () => {
      aRemoteReady = true;
      await flush(a, pendingForA);
    },
    markBRemoteReady: async () => {
      bRemoteReady = true;
      await flush(b, pendingForB);
    },
  };
}

function readSnapshot(a: RTCPeerConnection, b: RTCPeerConnection): LoopbackSnapshot {
  return {
    signalingA: a.signalingState,
    signalingB: b.signalingState,
    iceA: a.iceConnectionState,
    iceB: b.iceConnectionState,
    connectionA: a.connectionState,
    connectionB: b.connectionState,
  };
}

export async function startWebRTCLoopback(
  localStream: MediaStream,
  callbacks: WebRTCLoopbackCallbacks,
): Promise<WebRTCLoopbackSession> {
  const { onStateChange, onRemoteStream, onLog } = callbacks;

  const pcA = new RTCPeerConnection();
  const pcB = new RTCPeerConnection();
  const ice = wireIceExchange(pcA, pcB);

  const notifyState = () => onStateChange(readSnapshot(pcA, pcB));

  const watch = (pc: RTCPeerConnection, label: string) => {
    pc.onconnectionstatechange = () => {
      onLog(`${label} connectionState → ${pc.connectionState}`);
      notifyState();
    };
    pc.oniceconnectionstatechange = () => {
      onLog(`${label} iceConnectionState → ${pc.iceConnectionState}`);
      notifyState();
    };
    pc.onsignalingstatechange = () => {
      onLog(`${label} signalingState → ${pc.signalingState}`);
      notifyState();
    };
  };

  watch(pcA, 'PC A (sender)');
  watch(pcB, 'PC B (receiver)');

  pcB.ontrack = (event) => {
    const remoteStream =
      event.streams[0] ?? new MediaStream(event.track ? [event.track] : []);
    onLog(`ontrack: ${event.track.kind} track получен на PC B`);
    onRemoteStream(remoteStream);
  };

  for (const track of localStream.getTracks()) {
    pcA.addTrack(track, localStream);
    onLog(`addTrack → PC A: ${track.kind}`);
  }

  onLog('createOffer на PC A…');
  const offer = await pcA.createOffer();
  await pcA.setLocalDescription(offer);
  await pcB.setRemoteDescription(offer);
  await ice.markBRemoteReady();
  onLog('offer установлен на PC B');

  onLog('createAnswer на PC B…');
  const answer = await pcB.createAnswer();
  await pcB.setLocalDescription(answer);
  await pcA.setRemoteDescription(answer);
  await ice.markARemoteReady();
  onLog('answer установлен на PC A');

  notifyState();

  return {
    stop: () => {
      onLog('stop: закрываем peer connections');
      pcA.close();
      pcB.close();
      notifyState();
    },
  };
}
