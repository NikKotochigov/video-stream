import { useCallback, useState } from 'react';
import { TrackInfoPanel } from '../components/TrackInfoPanel';
import { VideoPreview } from '../components/VideoPreview';
import { useStream } from '../context/StreamContext';
import {
  CAMERA_PRESETS,
  getUserMediaErrorMessage,
  type CameraPresetId,
} from '../lib/camera';

export default function Step1CameraAccess() {
  const { stream, setStream, clearStream } = useStream();
  const [presetId, setPresetId] = useState<CameraPresetId>('720p');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConstraints, setLastConstraints] = useState<MediaStreamConstraints | null>(
    null,
  );

  const activePreset = CAMERA_PRESETS.find((p) => p.id === presetId)!;

  const requestCamera = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(
        activePreset.constraints,
      );
      setLastConstraints(activePreset.constraints);
      setStream(mediaStream);
    } catch (err) {
      setError(getUserMediaErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activePreset, setStream]);

  const stopCamera = useCallback(() => {
    clearStream();
    setLastConstraints(null);
    setError(null);
  }, [clearStream]);

  return (
    <section className="step">
      <header className="step-header">
        <p className="step-header__eyebrow">Шаг 1</p>
        <h2 className="step-header__title">getUserMedia</h2>
      </header>

      <div className="step-controls">
        <div className="preset-group" role="group" aria-label="Пресет разрешения">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`btn btn--toggle${presetId === preset.id ? ' btn--toggle-active' : ''}`}
              onClick={() => setPresetId(preset.id)}
              disabled={loading}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="action-group">
          <button
            type="button"
            className="btn btn--primary"
            onClick={requestCamera}
            disabled={loading}
          >
            {loading ? 'Запрос…' : stream ? 'Перезапросить камеру' : 'Запросить камеру'}
          </button>
          {stream ? (
            <button type="button" className="btn btn--secondary" onClick={stopCamera}>
              Остановить
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="step-grid">
        <VideoPreview stream={stream} label="Preview (srcObject)" />
        <TrackInfoPanel stream={stream} requestedConstraints={lastConstraints ?? undefined} />
      </div>

      <details className="code-hint">
        <summary>Код этого шага</summary>
        <pre>{`const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    width:  { ideal: ${presetId === '1080p' ? 1920 : 1280} },
    height: { ideal: ${presetId === '1080p' ? 1080 : 720} },
    frameRate: { ideal: 30 },
  },
  audio: false,
});
video.srcObject = stream;`}</pre>
      </details>
    </section>
  );
}
