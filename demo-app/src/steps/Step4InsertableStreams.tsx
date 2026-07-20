import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from '../components/VideoPreview';
import { useStream } from '../context/StreamContext';
import {
  INSERTABLE_FILTERS,
  isInsertableStreamsSupported,
  startInsertablePipeline,
  type InsertableFilterId,
  type InsertablePipeline,
} from '../lib/insertableStreams';

const INSERTABLE_SUPPORTED = isInsertableStreamsSupported();

export default function Step4InsertableStreams() {
  const { stream } = useStream();
  const pipelineRef = useRef<InsertablePipeline | null>(null);
  const filterRef = useRef<InsertableFilterId>('none');

  const [filterId, setFilterId] = useState<InsertableFilterId>('none');
  const [outputStream, setOutputStream] = useState<MediaStream | null>(null);
  const [processedFps, setProcessedFps] = useState(0);

  const videoTrack = stream?.getVideoTracks()[0] ?? null;
  const hasLiveVideo = videoTrack?.readyState === 'live';

  const stopPipeline = useCallback(() => {
    pipelineRef.current?.stop();
    pipelineRef.current = null;
    setOutputStream(null);
    setProcessedFps(0);
  }, []);

  useEffect(() => {
    filterRef.current = filterId;
  }, [filterId]);

  useEffect(() => {
    if (!INSERTABLE_SUPPORTED || !stream || !hasLiveVideo || !videoTrack) {
      stopPipeline();
      return;
    }

    stopPipeline();

    const pipeline = startInsertablePipeline({
      inputTrack: videoTrack,
      getFilter: () => filterRef.current,
    });
    pipelineRef.current = pipeline;
    setOutputStream(pipeline.outputStream);

    const statsTimer = window.setInterval(() => {
      setProcessedFps(pipeline.getProcessedFps());
    }, 500);

    return () => {
      window.clearInterval(statsTimer);
      pipeline.stop();
      pipelineRef.current = null;
    };
  }, [stream, hasLiveVideo, videoTrack, stopPipeline]);

  return (
    <section className="step">
      <header className="step-header">
        <p className="step-header__eyebrow">Шаг 4</p>
        <h2 className="step-header__title">Insertable Streams</h2>
        <p className="step-header__desc">
          VideoFrame pipeline: Processor → Transform → Generator.
        </p>
      </header>

      {!INSERTABLE_SUPPORTED ? (
        <div className="alert alert--info">
          Браузер не поддерживает <code>MediaStreamTrackProcessor</code>. Откройте шаг в Chrome /
          Edge.
        </div>
      ) : null}

      {!stream || !hasLiveVideo ? (
        <div className="alert alert--info">
          Сначала запросите камеру на <strong>Шаге 1</strong>, затем вернитесь сюда.
        </div>
      ) : null}

      <div className="step-controls">
        <div className="preset-group" role="group" aria-label="Фильтр">
          {INSERTABLE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`btn btn--toggle${filterId === filter.id ? ' btn--toggle-active' : ''}`}
              onClick={() => setFilterId(filter.id)}
              disabled={!hasLiveVideo || !INSERTABLE_SUPPORTED}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <p className="step-hint">
        Каждый <code>VideoFrame</code> после обработки нужно <code>close()</code> — иначе утечка
        памяти.
      </p>

      <div className="dual-preview">
        <VideoPreview stream={stream} label="Input (камера)" />
        <VideoPreview stream={outputStream} label="Output (обработанный track)" />
      </div>

      <div className="info-panel pipeline-stats">
        <h3 className="info-panel__title">Pipeline</h3>
        <dl className="info-panel__list">
          <div className="info-row">
            <dt>API</dt>
            <dd>Processor → Transform → Generator</dd>
          </div>
          <div className="info-row">
            <dt>Фильтр</dt>
            <dd>{filterId}</dd>
          </div>
          <div className="info-row">
            <dt>processed fps</dt>
            <dd>~{processedFps}</dd>
          </div>
          <div className="info-row">
            <dt>input track</dt>
            <dd>{videoTrack?.readyState ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <details className="code-hint">
        <summary>Код этого шага</summary>
        <pre>{`const processor = new MediaStreamTrackProcessor({ track });
const generator = new MediaStreamTrackGenerator({ kind: 'video' });

const transform = new TransformStream({
  transform(frame, controller) {
    const out = applyFilter(frame); // OffscreenCanvas
    frame.close();                  // обязательно!
    controller.enqueue(out);
  },
});

processor.readable
  .pipeThrough(transform)
  .pipeTo(generator.writable);

const output = new MediaStream([generator]);`}</pre>
      </details>
    </section>
  );
}
