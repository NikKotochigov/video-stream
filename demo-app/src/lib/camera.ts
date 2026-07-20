export type CameraPresetId = '720p' | '1080p';

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  constraints: MediaStreamConstraints;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: '720p',
    label: '720p',
    constraints: {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    },
  },
  {
    id: '1080p',
    label: '1080p',
    constraints: {
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    },
  },
];

export function getUserMediaErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : String(error);
  }

  switch (error.name) {
    case 'NotAllowedError':
      return 'Доступ запрещён. Разрешите камеру в настройках сайта (иконка замка в адресной строке).';
    case 'NotFoundError':
      return 'Камера не найдена. Проверьте, что устройство подключено и не отключено в системе.';
    case 'NotReadableError':
      return 'Камера занята другим приложением или вкладкой.';
    case 'OverconstrainedError':
      return 'Браузер не может подобрать режим под эти constraints. Попробуйте другой пресет.';
    case 'SecurityError':
      return 'Нужен secure context: HTTPS или localhost.';
    default:
      return `${error.name}: ${error.message}`;
  }
}
