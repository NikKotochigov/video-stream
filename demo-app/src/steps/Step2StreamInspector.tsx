import { useCallback, useState } from 'react';
import { TrackList } from '../components/TrackList';
import { VideoPreview } from '../components/VideoPreview';
import { useStream } from '../context/StreamContext';
import { getUserMediaErrorMessage } from '../lib/camera';
import { requestStreamWithAudio } from '../lib/stream';

export default function Step2StreamInspector() {
  const { stream, setStream } = useStream();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((n) => n + 1), []);

  const hasAudio = (stream?.getAudioTracks().length ?? 0) > 0;
  const hasLiveVideo = stream?.getVideoTracks().some((t) => t.readyState === 'live');

  const requestWithAudio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mediaStream = await requestStreamWithAudio();
      setStream(mediaStream);
    } catch (err) {
      setError(getUserMediaErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [setStream]);

  return (
    <section className="step">
      <header className="step-header">
        <p className="step-header__eyebrow">Шаг 2</p>
        <h2 className="step-header__title">MediaStream & tracks</h2>
      </header>

      {!stream || !hasLiveVideo ? (
        <div className="alert alert--info">
          Сначала запросите камеру на <strong>Шаге 1</strong>, затем вернитесь сюда.
        </div>
      ) : null}

      {stream && !hasAudio ? (
        <div className="step-controls">
          <button
            type="button"
            className="btn btn--primary"
            onClick={requestWithAudio}
            disabled={loading}
          >
            {loading ? 'Запрос…' : 'Перезапросить с микрофоном'}
          </button>
        </div>
      ) : null}

      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="dual-preview">
        <VideoPreview stream={stream} label="Preview A" />
        <VideoPreview stream={stream} label="Preview B" />
      </div>

      <TrackList key={tick} stream={stream} onUpdate={bump} />

      <details className="code-hint">
        <summary>Код этого шага</summary>
        <pre>{`// один поток — два video
videoA.srcObject = stream;
videoB.srcObject = stream;

// пауза (камера всё ещё занята)
videoTrack.enabled = false;
videoTrack.enabled = true;

// освободить устройство
videoTrack.stop(); // readyState → "ended"`}</pre>
      </details>
    </section>
  );
}
