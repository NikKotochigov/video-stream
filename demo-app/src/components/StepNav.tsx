export interface StepMeta {
  id: number;
  title: string;
  subtitle: string;
}

interface StepNavProps {
  steps: StepMeta[];
  activeStep: number;
  onStepChange: (step: number) => void;
}

export function StepNav({ steps, activeStep, onStepChange }: StepNavProps) {
  return (
    <nav className="step-nav" aria-label="Шаги демо">
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          className={`step-nav__item${activeStep === step.id ? ' step-nav__item--active' : ''}`}
          onClick={() => onStepChange(step.id)}
          aria-current={activeStep === step.id ? 'step' : undefined}
        >
          <span className="step-nav__num">{step.id}</span>
          <span className="step-nav__text">
            <span className="step-nav__title">{step.title}</span>
            <span className="step-nav__subtitle">{step.subtitle}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
