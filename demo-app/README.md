# Demo: От камеры до WebRTC

Демо-приложение для стрима. Один URL, пять шагов — от `getUserMedia` до WebRTC loopback.

## Запуск

```bash
cd demo-app
npm install
npm run dev
```

Открыть http://localhost:5173

## Требования

- Node.js 16+ (протестировано на 16.15)
- Современный браузер с поддержкой WebRTC (Chrome рекомендуется)

## Структура

```
src/
├── App.tsx              # роутинг шагов
├── components/StepNav.tsx
├── context/StreamContext.tsx   # общий MediaStream между шагами
└── steps/
    ├── Step1CameraAccess.tsx
    ├── Step2StreamInspector.tsx
    ├── Step3CanvasProcessing.tsx
    ├── Step4InsertableStreams.tsx
    └── Step5WebRTCLoopback.tsx
```

## На стриме

1. Запустить `npm run dev` до начала эфира
2. Открыть вкладку с demo, разрешить камеру когда дойдёте до Step 1
3. Переключать шаги через боковую навигацию

## Сборка

```bash
npm run build
npm run preview
```
