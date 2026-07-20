function kindLabel(kind: MediaStreamTrack['kind']) {
  return kind === 'video' ? 'Video' : 'Audio';
}

interface TrackListProps {
  stream: MediaStream | null;
  onUpdate: () => void;
}

export function TrackList({ stream, onUpdate }: TrackListProps) {
  const tracks = stream?.getTracks() ?? [];

  if (!stream) {
    return (
      <div className="info-panel info-panel--empty">
        <p>Нет потока. Запросите камеру на Шаге 1 или кнопкой ниже.</p>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="info-panel info-panel--empty">
        <p>В потоке нет треков (все остановлены).</p>
      </div>
    );
  }

  return (
    <div className="track-list">
      {tracks.map((track) => (
        <div key={track.id} className="track-card">
          <div className="track-card__header">
            <span className="track-card__kind">{kindLabel(track.kind)}</span>
            <span className="track-card__label">{track.label || '—'}</span>
          </div>

          <dl className="track-card__meta">
            <div className="info-row">
              <dt>readyState</dt>
              <dd>{track.readyState}</dd>
            </div>
            <div className="info-row">
              <dt>enabled</dt>
              <dd>{String(track.enabled)}</dd>
            </div>
            <div className="info-row">
              <dt>muted</dt>
              <dd>{String(track.muted)}</dd>
            </div>
          </dl>

          <div className="track-card__actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={track.readyState === 'ended'}
              onClick={() => {
                track.enabled = !track.enabled;
                onUpdate();
              }}
            >
              {track.enabled ? 'enabled = false' : 'enabled = true'}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={track.readyState === 'ended'}
              onClick={() => {
                track.stop();
                onUpdate();
              }}
            >
              stop()
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
