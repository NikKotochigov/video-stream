import { getUserMediaErrorMessage } from './camera';

export const STREAM_WITH_AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  audio: true,
};

export async function requestStreamWithAudio(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(STREAM_WITH_AUDIO_CONSTRAINTS);
}

export { getUserMediaErrorMessage };
