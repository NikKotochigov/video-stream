import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from '../components/VideoPreview';
import { useStream } from '../context/StreamContext';
import {
  CANVAS_FILTERS,
  startCanvasPipeline,
  type CanvasPipeline,
  type FilterId,
} from '../lib/effects';

export default function Step3CanvasProcessing() {
  const { stream } = useStream();
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<CanvasPipeline | null>(null);
  const filterRef = useRef<FilterId>('none');

  const [filterId, setFilterId] = useState<FilterId>('none');
  const [captureFps, setCaptureFps] = useState(30);
  const [outputStream, setOutputStream] = useState<MediaStream | null>(null);
  const [drawFps, setDrawFps] = useState(0);

  const hasLiveVideo = stream?.getVideoTracks().some((t) => t.readyState === 'live');

  const activeFilter = CANVAS_FILTERS.find((f) => f.id === filterId)!;

  const stopPipeline = useCallback(() => {
    pipelineRef.current?.stop();
    pipelineRef.current = null;
    setOutputStream(null);
    setDrawFps(0);
  }, []);

  useEffect(() => {
    filterRef.current = filterId;
  }, [filterId]);

  useEffect(() => {
    const sourceVideo = sourceVideoRef.current;
    if (!sourceVideo) return;
    sourceVideo.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    const sourceVideo = sourceVideoRef.current;
    const canvas = canvasRef.current;

    if (!stream || !hasLiveVideo || !sourceVideo || !canvas) {
      stopPipeline();
      return;
    }

    stopPipeline();

    const pipeline = startCanvasPipeline({
      sourceVideo,
      canvas,
      getFilterCss: () => {
        const filter = CANVAS_FILTERS.find((f) => f.id === filterRef.current);
        return filter?.css ?? 'none';
      },
      captureFps,
    });

    pipelineRef.current = pipeline;
    setOutputStream(pipeline.outputStream);

    const statsTimer = window.setInterval(() => {
      setDrawFps(pipeline.getDrawFps());
    }, 500);

    return () => {
      window.clearInterval(statsTimer);
      pipeline.stop();
      pipelineRef.current = null;
    };
  }, [stream, hasLiveVideo, captureFps, stopPipeline]);

  return (
    <section className="step">
      <header className="step-header">
        <p className="step-header__eyebrow">Шаг 3</p>
        <h2 className="step-header__title">Canvas + captureStream</h2>
        <p className="step-header__desc">
          Читаем кадры с камеры, рисуем на canvas, отдаём новый MediaStream.
        </p>
      </header>

      {!stream || !hasLiveVideo ? (
        <div className="alert alert--info">
          Сначала запросите камеру на <strong>Шаге 1</strong>, затем вернитесь сюда.
        </div>
      ) : null}

      <div className="step-controls">
        <div className="preset-group" role="group" aria-label="Фильтр canvas">
          {CANVAS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`btn btn--toggle${filterId === filter.id ? ' btn--toggle-active' : ''}`}
              onClick={() => setFilterId(filter.id)}
              disabled={!hasLiveVideo}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="fps-control">
          <label className="fps-control__label" htmlFor="capture-fps">
            captureStream FPS: <strong>{captureFps}</strong>
          </label>
          <input
            id="capture-fps"
            className="fps-control__range"
            type="range"
            min={1}
            max={60}
            step={1}
            value={captureFps}
            onChange={(e) => setCaptureFps(Number(e.target.value))}
            disabled={!hasLiveVideo}
          />
        </div>
      </div>

      <p className="step-hint">
        <code>drawImage</code> крутится в <code>requestAnimationFrame</code>;{' '}
        <code>canvas.captureStream({captureFps})</code> задаёт частоту <em>выходного</em>{' '}
        потока.
      </p>

      <div className="dual-preview">
        <VideoPreview stream={stream} label="Input (камера)" />
        <VideoPreview stream={outputStream} label="Output (canvas)" />
      </div>

      <div className="info-panel pipeline-stats">
        <h3 className="info-panel__title">Pipeline</h3>
        <dl className="info-panel__list">
          <div className="info-row">
            <dt>Фильтр</dt>
            <dd>{activeFilter.css}</dd>
          </div>
          <div className="info-row">
            <dt>draw loop</dt>
            <dd>~{drawFps} fps (rAF)</dd>
          </div>
          <div className="info-row">
            <dt>captureStream</dt>
            <dd>{captureFps} fps (задано)</dd>
          </div>
          <div className="info-row">
            <dt>output tracks</dt>
            <dd>{outputStream?.getVideoTracks().length ?? 0}</dd>
          </div>
        </dl>
      </div>

      <video
        ref={sourceVideoRef}
        className="pipeline-source-video"
        autoPlay
        playsInline
        muted
        aria-hidden
      />
      <canvas ref={canvasRef} className="pipeline-canvas" aria-hidden />

      <details className="code-hint">
        <summary>Код этого шага</summary>
        <pre>{`// скрытый video — источник кадров
sourceVideo.srcObject = cameraStream;

const loop = () => {
  ctx.filter = 'grayscale(100%)';
  ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
  requestAnimationFrame(loop);
};
loop();

// новый MediaStream с canvas (не камера!)
const output = canvas.captureStream(${captureFps});
outputVideo.srcObject = output;`}</pre>
      </details>
    </section>
  );
}
