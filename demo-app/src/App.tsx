import { lazy, Suspense, useState } from 'react';
import { StepNav, type StepMeta } from './components/StepNav';

const Step1CameraAccess = lazy(() => import('./steps/Step1CameraAccess'));
const Step2StreamInspector = lazy(() => import('./steps/Step2StreamInspector'));
const Step3CanvasProcessing = lazy(() => import('./steps/Step3CanvasProcessing'));
const Step4InsertableStreams = lazy(() => import('./steps/Step4InsertableStreams'));
const Step5WebRTCManual = lazy(() => import('./steps/Step5WebRTCManual'));

const STEPS: StepMeta[] = [
  { id: 1, title: 'Камера', subtitle: 'getUserMedia' },
  { id: 2, title: 'Поток', subtitle: 'MediaStream & tracks' },
  { id: 3, title: 'Canvas', subtitle: 'captureStream' },
  { id: 4, title: 'Insertable', subtitle: 'VideoFrame' },
  { id: 5, title: 'WebRTC', subtitle: '' },
];

const STEP_COMPONENTS = [
  Step1CameraAccess,
  Step2StreamInspector,
  Step3CanvasProcessing,
  Step4InsertableStreams,
  Step5WebRTCManual,
];

export default function App() {
  const [activeStep, setActiveStep] = useState(1);
  const ActiveComponent = STEP_COMPONENTS[activeStep - 1];

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-header__title">От камеры до WebRTC</h1>
        </div>
      </header>

      <div className="app-layout">
        <StepNav steps={STEPS} activeStep={activeStep} onStepChange={setActiveStep} />

        <main className="app-main">
          <Suspense fallback={<div className="step-loading">Загрузка шага…</div>}>
            <ActiveComponent />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
