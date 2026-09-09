import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { PRODUCT_NAME } from '../content/site';

export default function ModelsPage() {
  return (
    <>
      <Seo
        title={`Models & providers — ${PRODUCT_NAME}`}
        description="Connect Ollama, LM Studio, OpenAI-compatible APIs, and optional cloud providers. Hoosh does not sell inference tokens."
        path="/models"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">Models</p>
        <h1 className="hm-h1">Bring the models you already use</h1>
        <p className="hm-lead">
          Hoosh is model-agnostic by design. You choose the model infrastructure — Hoosh does not require a Hoosh AI token balance.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap hm-feature-grid">
          <article className="hm-panel">
            <h3 className="hm-h3">Ollama</h3>
            <p className="hm-p" style={{ marginBottom: 0 }}>
              First-class local provider path. Point Hoosh at your local Ollama instance and use models you already pull.
            </p>
          </article>
          <article className="hm-panel">
            <h3 className="hm-h3">LM Studio</h3>
            <p className="hm-p" style={{ marginBottom: 0 }}>
              Supported via LM Studio&apos;s OpenAI-compatible local server endpoint.
            </p>
          </article>
          <article className="hm-panel">
            <h3 className="hm-h3">OpenAI-compatible APIs</h3>
            <p className="hm-p" style={{ marginBottom: 0 }}>
              Configure compatible endpoints with your own base URL and keys. Optional cloud providers (for example Anthropic or OpenRouter) can be added when you supply credentials.
            </p>
          </article>
        </div>
        <div className="hm-wrap" style={{ marginTop: '1.5rem' }}>
          <div className="hm-panel">
            <h3 className="hm-h3">What Hoosh does not do</h3>
            <p className="hm-p" style={{ marginBottom: 0 }}>
              Hoosh does not sell hosted inference tokens as a product. If you use a paid third-party API, that provider bills you under their terms.
            </p>
          </div>
          <p className="hm-p" style={{ marginTop: '1.25rem' }}>
            <Link className="hm-link" to="/download">
              Download Hoosh
            </Link>
            {' · '}
            <Link className="hm-link" to="/security">
              What can leave your machine
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
