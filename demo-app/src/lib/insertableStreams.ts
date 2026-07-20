export type InsertableFilterId = 'none' | 'grayscale' | 'mirror';

export const INSERTABLE_FILTERS: ReadonlyArray<{
  id: InsertableFilterId;
  label: string;
}> = [
  { id: 'none', label: 'Нет' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'mirror', label: 'Mirror' },
];

export function isInsertableStreamsSupported(): boolean {
  if (typeof MediaStreamTrackProcessor === 'undefined') return false;
  if (typeof MediaStreamTrackGenerator === 'undefined') return false;

  try {
    const generator = new MediaStreamTrackGenerator({ kind: 'video' });
    const supported =
      generator instanceof MediaStreamTrack && generator.writable != null;
    generator.stop();
    return supported;
  } catch {
    return false;
  }
}

function transformVideoFrame(
  frame: VideoFrame,
  filter: InsertableFilterId,
): VideoFrame {
  const width = frame.displayWidth;
  const height = frame.displayHeight;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('OffscreenCanvas 2D context недоступен');
  }

  if (filter === 'grayscale') {
    ctx.filter = 'grayscale(100%)';
    ctx.drawImage(frame, 0, 0);
  } else {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(frame, 0, 0, width, height);
  }

  return new VideoFrame(canvas, {
    timestamp: frame.timestamp,
    duration: frame.duration ?? undefined,
  });
}

export interface InsertablePipeline {
  outputStream: MediaStream;
  stop: () => void;
  getProcessedFps: () => number;
}

export function startInsertablePipeline(options: {
  inputTrack: MediaStreamTrack;
  getFilter: () => InsertableFilterId;
}): InsertablePipeline {
  const { inputTrack, getFilter } = options;

  //  берёт живой видео-трек (inputTrack с камеры) и превращает его в поток отдельных кадров.
  const processor = new MediaStreamTrackProcessor({ track: inputTrack });
  // создаёт новый видео-трек, в который вы записываете кадры вручную
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });
  const abortController = new AbortController();

  let frameCount = 0;
  let lastStatsTime = performance.now();
  let processedFps = 0;

  const transformer = new TransformStream<VideoFrame, VideoFrame>({
    transform(frame, controller) {
      const filter = getFilter();

      try {
        if (filter === 'none') {
          controller.enqueue(frame);
        } else {
          const output = transformVideoFrame(frame, filter);
          frame.close();
          controller.enqueue(output);
        }

        frameCount += 1;
        const now = performance.now();
        if (now - lastStatsTime >= 1000) {
          processedFps = frameCount;
          frameCount = 0;
          lastStatsTime = now;
        }
      } catch (err) {
        frame.close();
        throw err;
      }
    },
  });

  processor.readable
    .pipeThrough(transformer, { signal: abortController.signal })
    .pipeTo(generator.writable, { signal: abortController.signal })
    .catch(() => {
      // Abort or track ended — expected on stop()
    });

  const outputStream = new MediaStream([generator]);

  return {
    outputStream,
    stop: () => {
      abortController.abort();
      generator.stop();
    },
    getProcessedFps: () => processedFps,
  };
}
