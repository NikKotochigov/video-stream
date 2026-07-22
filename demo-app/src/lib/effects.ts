export type FilterId = 'none' | 'grayscale' | 'sepia' | 'invert' | 'neon' | 'warm';

export const CANVAS_FILTERS: ReadonlyArray<{
  id: FilterId;
  label: string;
  css: string;
}> = [
  { id: 'none', label: 'Нет', css: 'none' },
  { id: 'grayscale', label: 'Grayscale', css: 'grayscale(100%)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(100%)' },
  { id: 'invert', label: 'Invert', css: 'invert(100%)' },
  {
    id: 'neon',
    label: 'Neon',
    css: 'hue-rotate(280deg) saturate(220%) contrast(130%)',
  },
  {
    id: 'warm',
    label: 'Warm',
    css: 'sepia(50%) saturate(160%) hue-rotate(-20deg) contrast(110%)',
  },
];

export interface CanvasPipeline {
  outputStream: MediaStream;
  stop: () => void;
}

export interface StartCanvasPipelineOptions {
  sourceVideo: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  getFilterCss: () => string;
  captureFps: number;
}

export function startCanvasPipeline(options: StartCanvasPipelineOptions): CanvasPipeline {
  const { sourceVideo, canvas, getFilterCss, captureFps } = options;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context недоступен');
  }

  let running = true;
  let rafId = 0;

  const outputStream = canvas.captureStream(captureFps);

  const syncCanvasSize = () => {
    const width = sourceVideo.videoWidth;
    const height = sourceVideo.videoHeight;
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  const draw = () => {
    if (!running) return;

    if (sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      syncCanvasSize();
      ctx.filter = getFilterCss();
      ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
    }

    rafId = requestAnimationFrame(draw);
  };

  draw();

  return {
    outputStream,
    stop: () => {
      running = false;
      cancelAnimationFrame(rafId);
      outputStream.getTracks().forEach((track) => track.stop());
    },
  };
}
