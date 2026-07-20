interface StepPlaceholderProps {
  step: number;
  title: string;
  description: string;
}

export function StepPlaceholder({ step, title, description }: StepPlaceholderProps) {
  return (
    <section className="step">
      <header className="step-header">
        <p className="step-header__eyebrow">Шаг {step}</p>
        <h2 className="step-header__title">{title}</h2>
        <p className="step-header__desc">{description}</p>
      </header>
      <div className="step-placeholder">
        <p>Контент шага будет добавлен на следующем этапе.</p>
      </div>
    </section>
  );
}
