function Row({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  );
}

interface TrackInfoPanelProps {
  stream: MediaStream | null;
  requestedConstraints?: MediaStreamConstraints;
}

export function TrackInfoPanel({ stream, requestedConstraints }: TrackInfoPanelProps) {
  const videoTrack = stream?.getVideoTracks()[0] ?? null;
  const settings = videoTrack?.getSettings();
  const appliedConstraints = videoTrack?.getConstraints();

  if (!stream || !videoTrack) {
    return (
      <div className="info-panel info-panel--empty">
        <p>Здесь появятся параметры video track.</p>
      </div>
    );
  }

  const requestedVideo =
    requestedConstraints?.video === true
      ? 'true'
      : requestedConstraints?.video && typeof requestedConstraints.video === 'object'
        ? JSON.stringify(requestedConstraints.video, null, 0)
        : '—';

  const appliedLabel =
    appliedConstraints && Object.keys(appliedConstraints).length > 0
      ? JSON.stringify(appliedConstraints, null, 0)
      : '—';

  return (
    <div className="info-panel">
      <h3 className="info-panel__title">Video track</h3>
      <dl className="info-panel__list">
        <Row label="id" value={videoTrack.id} />
        <Row label="label" value={videoTrack.label || '(пусто до разрешения)'} />
        <Row label="readyState" value={videoTrack.readyState} />
        <Row label="muted" value={String(videoTrack.muted)} />
        <Row label="width (actual)" value={settings?.width} />
        <Row label="height (actual)" value={settings?.height} />
        <Row label="frameRate (actual)" value={settings?.frameRate?.toFixed(1)} />
        <Row
          label="deviceId"
          value={settings?.deviceId ? `${settings.deviceId.slice(0, 12)}…` : undefined}
        />
      </dl>

      <h3 className="info-panel__title">Constraints</h3>
      <dl className="info-panel__list">
        <Row label="requested (video)" value={requestedVideo} />
        <Row label="applied (track)" value={appliedLabel} />
      </dl>
    </div>
  );
}
