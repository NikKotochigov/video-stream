import { useEffect, useRef } from 'react';

interface VideoPreviewProps {
  stream: MediaStream | null;
  label?: string;
}

export function VideoPreview({ stream, label }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="video-preview">
      {label ? <p className="video-preview__label">{label}</p> : null}
      <video
        ref={videoRef}
        className="video-preview__video"
        autoPlay
        playsInline
        muted
      />
      {!stream ? (
        <div className="video-preview__empty">Камера не запущена</div>
      ) : null}
    </div>
  );
}
