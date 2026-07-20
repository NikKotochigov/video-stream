interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack;
}

declare class MediaStreamTrackProcessor<T = VideoFrame> {
  constructor(init: MediaStreamTrackProcessorInit);
  readonly readable: ReadableStream<T>;
}

interface MediaStreamTrackGeneratorInit {
  kind: 'video' | 'audio';
}

// В Chrome генератор сам является MediaStreamTrack (наследует интерфейс).
declare class MediaStreamTrackGenerator extends MediaStreamTrack {
  constructor(init: MediaStreamTrackGeneratorInit);
  readonly writable: WritableStream<VideoFrame>;
}
