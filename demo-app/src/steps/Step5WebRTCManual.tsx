import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from '../components/VideoPreview';
import { useStream } from '../context/StreamContext';
import {
  createManualPeer,
  formatSessionDescription,
  parseSessionDescription,
  type ManualPeerSession,
  type PeerRole,
  type PeerSnapshot,
} from '../lib/webrtcManualPeer';

const EMPTY_SNAPSHOT: PeerSnapshot = {
  signaling: 'closed',
  ice: 'closed',
  iceGathering: 'new',
  connection: 'closed',
};

function formatTime(date: Date) {
  return date.toLocaleTimeString('ru-RU', { hour12: false });
}

export default function Step5WebRTCManual() {
  const { stream } = useStream();
  const sessionRef = useRef<ManualPeerSession | null>(null);

  const [role, setRole] = useState<PeerRole>('sender');
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [snapshot, setSnapshot] = useState<PeerSnapshot>(EMPTY_SNAPSHOT);
  const [localSdpText, setLocalSdpText] = useState('');
  const [remoteSdpText, setRemoteSdpText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const hasLiveVideo = stream?.getVideoTracks().some((t) => t.readyState === 'live') ?? false;

  const appendLog = useCallback((message: string) => {
    setLogs((prev) => [...prev.slice(-24), `${formatTime(new Date())} ${message}`]);
  }, []);

  const stopSession = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setHasSession(false);
    setRemoteStream(null);
    setSnapshot(EMPTY_SNAPSHOT);
    setLocalSdpText('');
    setCopyStatus(null);
  }, []);

  const startPeer = useCallback(
    (peerRole: PeerRole) => {
      const peer = createManualPeer({
        role: peerRole,
        localStream: peerRole === 'sender' ? stream : null,
        callbacks: {
          onStateChange: setSnapshot,
          onRemoteStream: setRemoteStream,
          onLocalSdp: (sdp) => setLocalSdpText(formatSessionDescription(sdp)),
          onLog: appendLog,
        },
      });
      sessionRef.current = peer;
      setHasSession(true);
      return peer;
    },
    [stream, appendLog],
  );

  const changeRole = (next: PeerRole) => {
    if (next === role) return;
    stopSession();
    setRemoteSdpText('');
    setLogs([]);
    setRole(next);
  };

  const createOffer = async () => {
    setBusy(true);
    setCopyStatus(null);
    try {
      stopSession();
      const peer = startPeer('sender');
      await peer.createOffer();
    } catch (err) {
      appendLog(err instanceof Error ? err.message : String(err));
      stopSession();
    } finally {
      setBusy(false);
    }
  };

  const acceptOfferCreateAnswer = async () => {
    setBusy(true);
    setCopyStatus(null);
    try {
      stopSession();
      const offer = parseSessionDescription(remoteSdpText);
      if (offer.type !== 'offer') {
        throw new Error('Ожидался type: "offer"');
      }
      const peer = startPeer('viewer');
      await peer.acceptOfferAndCreateAnswer(offer);
    } catch (err) {
      appendLog(err instanceof Error ? err.message : String(err));
      stopSession();
    } finally {
      setBusy(false);
    }
  };

  const applyAnswer = async () => {
    setBusy(true);
    setCopyStatus(null);
    try {
      const session = sessionRef.current;
      if (!session || session.role !== 'sender') {
        throw new Error('Сначала создайте offer на этом ПК (роль Sender)');
      }
      const answer = parseSessionDescription(remoteSdpText);
      if (answer.type !== 'answer') {
        throw new Error('Ожидался type: "answer"');
      }
      await session.acceptAnswer(answer);
    } catch (err) {
      appendLog(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copyLocalSdp = async () => {
    if (!localSdpText) return;
    try {
      await navigator.clipboard.writeText(localSdpText);
      setCopyStatus('Скопировано в буфер');
    } catch {
      setCopyStatus('Не удалось скопировать — выделите текст вручную');
    }
  };

  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (role === 'sender' && (!stream || !hasLiveVideo)) {
      stopSession();
    }
  }, [role, stream, hasLiveVideo, stopSession]);

  return (
    <section className="step">
      <header className="step-header">
        <p className="step-header__eyebrow">Шаг 5</p>
        <h2 className="step-header__title">WebRTC: два компьютера</h2>
        <p className="step-header__desc">
          Signaling руками: copy-paste offer/answer. Камера на Sender → просмотр на Viewer (одна
          Wi‑Fi).
        </p>
      </header>

      <div className="alert alert--info">
        Оба ПК в одной Wi‑Fi. На Sender: <code>npm run dev -- --host</code>, камера на{' '}
        <strong>Шаге 1</strong>. Viewer открывает <code>http://&lt;IP-Sender&gt;:5173</code> — камера
        ему не нужна.
      </div>

      <div className="step-controls">
        <div className="preset-group" role="group" aria-label="Роль">
          <button
            type="button"
            className={`btn btn--toggle${role === 'sender' ? ' btn--toggle-active' : ''}`}
            onClick={() => changeRole('sender')}
            disabled={busy}
          >
            Sender (камера)
          </button>
          <button
            type="button"
            className={`btn btn--toggle${role === 'viewer' ? ' btn--toggle-active' : ''}`}
            onClick={() => changeRole('viewer')}
            disabled={busy}
          >
            Viewer (смотреть)
          </button>
        </div>
        <div className="action-group">
          <button type="button" className="btn btn--secondary" onClick={stopSession} disabled={busy}>
            Stop
          </button>
        </div>
      </div>

      {role === 'sender' && (!stream || !hasLiveVideo) ? (
        <div className="alert alert--info">
          Sender: сначала запросите камеру на <strong>Шаге 1</strong>.
        </div>
      ) : null}

      <p className="step-hint">
        {role === 'sender' ? (
          <>
            1) Create offer → Copy → вставить на Viewer. 2) Вставить answer с Viewer → Apply answer.
          </>
        ) : (
          <>
            1) Вставить offer с Sender → Create answer. 2) Copy answer → вернуть Sender. Камера на
            этом ПК не нужна.
          </>
        )}
      </p>

      <div className="dual-preview">
        <VideoPreview
          stream={role === 'sender' ? stream : null}
          label={role === 'sender' ? 'Local (камера)' : 'Local (нет — viewer)'}
        />
        <VideoPreview stream={remoteStream} label="Remote (WebRTC)" />
      </div>

      <div className="signaling-grid">
        <div className="info-panel signaling-panel">
          <h3 className="info-panel__title">
            {role === 'sender' ? 'Ваш offer (отправить Viewer)' : 'Ваш answer (вернуть Sender)'}
          </h3>
          <textarea
            className="sdp-textarea"
            value={localSdpText}
            readOnly
            rows={8}
            placeholder={
              role === 'sender'
                ? 'Нажмите «Create offer» — здесь появится JSON'
                : 'После offer здесь появится answer'
            }
          />
          <div className="action-group">
            {role === 'sender' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={createOffer}
                disabled={busy || !hasLiveVideo}
              >
                {busy ? 'Ждём ICE…' : 'Create offer'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--secondary"
              onClick={copyLocalSdp}
              disabled={!localSdpText}
            >
              Copy
            </button>
            {copyStatus ? <span className="copy-status">{copyStatus}</span> : null}
          </div>
        </div>

        <div className="info-panel signaling-panel">
          <h3 className="info-panel__title">
            {role === 'sender' ? 'Answer от Viewer (вставить)' : 'Offer от Sender (вставить)'}
          </h3>
          <textarea
            className="sdp-textarea"
            value={remoteSdpText}
            onChange={(e) => setRemoteSdpText(e.target.value)}
            rows={8}
            placeholder="Вставьте JSON { type, sdp }…"
          />
          <div className="action-group">
            {role === 'sender' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={applyAnswer}
                disabled={busy || !remoteSdpText.trim() || !hasSession}
              >
                Apply answer
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                onClick={acceptOfferCreateAnswer}
                disabled={busy || !remoteSdpText.trim()}
              >
                {busy ? 'Ждём ICE…' : 'Create answer'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="step-grid">
        <div className="info-panel">
          <h3 className="info-panel__title">Peer state</h3>
          <dl className="info-panel__list">
            <div className="info-row">
              <dt>role</dt>
              <dd>{role}</dd>
            </div>
            <div className="info-row">
              <dt>signaling</dt>
              <dd>{snapshot.signaling}</dd>
            </div>
            <div className="info-row">
              <dt>ice gathering</dt>
              <dd>{snapshot.iceGathering}</dd>
            </div>
            <div className="info-row">
              <dt>ice</dt>
              <dd>{snapshot.ice}</dd>
            </div>
            <div className="info-row">
              <dt>connection</dt>
              <dd>{snapshot.connection}</dd>
            </div>
          </dl>
        </div>

        <div className="info-panel loopback-log">
          <h3 className="info-panel__title">Log</h3>
          {logs.length === 0 ? (
            <p className="info-panel--empty">Действий пока нет</p>
          ) : (
            <ol className="loopback-log__list">
              {logs.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <details className="code-hint">
        <summary>Код этого шага</summary>
        <pre>{`// Sender
pc.addTrack(cameraTrack, stream);
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
// дождаться iceGatheringState === 'complete'
// → copy JSON { type, sdp } на Viewer

// Viewer
await pc.setRemoteDescription(offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
// дождаться ICE complete → copy answer на Sender

// Sender
await pc.setRemoteDescription(answer);
// Viewer: ontrack → remote <video>`}</pre>
      </details>
    </section>
  );
}
