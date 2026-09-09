export function ArchitectureDiagram() {
  const steps = [
    { title: 'Hoosh Desktop', detail: 'PyQt shell on your machine' },
    { title: 'Local Runtime', detail: 'companion on 127.0.0.1' },
    { title: 'Control Plane UI', detail: 'Agents, files, terminal, settings' },
    { title: 'Your models & tools', detail: 'Ollama / LM Studio / APIs / Git / Docker' },
  ];

  return (
    <div className="hm-arch" aria-label="How Hoosh runs on your machine">
      {steps.map((step, i) => (
        <div key={step.title}>
          {i > 0 && <div className="hm-arch-arrow" aria-hidden="true">↓</div>}
          <div className="hm-arch-step">
            <div>
              <strong>{step.title}</strong>
              <div style={{ color: 'var(--hm-muted)', marginTop: '0.2rem' }}>{step.detail}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
