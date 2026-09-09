export function ProductVisual() {
  return (
    <div className="hm-visual" aria-hidden="true">
      <div className="hm-visual-bar">
        <span className="hm-dot" />
        <span className="hm-dot" />
        <span className="hm-dot" />
        <span style={{ marginLeft: '0.5rem' }}>Hoosh Desktop — Control Plane</span>
      </div>
      <div className="hm-visual-body">
        <div className="hm-visual-rail">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="hm-visual-main">
          <div className="hm-visual-line w80" />
          <div className="hm-visual-line accent" />
          <div className="hm-visual-line w60" />
          <div className="hm-visual-line w40" />
          <div className="hm-visual-line w80" />
          <p className="hm-visual-flow">
            Desktop → Local Runtime → Control Plane
            <br />
            → Files · Terminal · Git · Agents
            <br />
            → Your models (Ollama / LM Studio / APIs)
          </p>
        </div>
      </div>
    </div>
  );
}
