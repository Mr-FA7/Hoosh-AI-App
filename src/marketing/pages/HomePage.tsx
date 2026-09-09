import { Link } from 'react-router-dom';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram';
import { Faq } from '../components/Faq';
import { FeatureGrid } from '../components/FeatureGrid';
import { ProductVisual } from '../components/ProductVisual';
import { Seo } from '../components/Seo';
import {
  AUDIENCES,
  FAQ_ITEMS,
  FEATURES,
  POSITIONING,
  PRODUCT_NAME,
  SITE_LINKS,
} from '../content/site';

export default function HomePage() {
  const homeFeatures = FEATURES.filter((f) =>
    ['desktop', 'runtime', 'control-plane', 'agents', 'models', 'files', 'terminal', 'git'].includes(f.id)
  );

  return (
    <>
      <Seo
        title={`${PRODUCT_NAME} — Local-First AI Agent Platform`}
        description="Hoosh is a local-first AI agent platform that lets you connect your own models and AI services to a workflow running on your machine."
        path="/"
      />

      <section className="hm-hero">
        <div className="hm-hero-grid" aria-hidden="true" />
        <div className="hm-wrap hm-hero-inner">
          <div className="hm-hero-copy">
            <p className="hm-eyebrow">{POSITIONING.eyebrow}</p>
            <h1 className="hm-hero-brand">
              <span className="hm-brand-grad">Hoosh</span>
            </h1>
            <p className="hm-h2" style={{ fontWeight: 700, marginBottom: '0.85rem' }}>
              {POSITIONING.headline}
            </p>
            <p className="hm-lead">{POSITIONING.support}</p>
            <div className="hm-btn-row">
              <Link className="hm-btn" to="/download">
                Download Hoosh
              </Link>
              <a className="hm-btn hm-btn-ghost" href={SITE_LINKS.source} target="_blank" rel="noreferrer">
                Explore the project
              </a>
            </div>
          </div>
          <ProductVisual />
        </div>
      </section>

      <section className="hm-section-tight">
        <div className="hm-wrap">
          <p className="hm-eyebrow">What is Hoosh?</p>
          <h2 className="hm-h2">An agent platform for your machine</h2>
          <p className="hm-p">{POSITIONING.notChatbot}</p>
          <p className="hm-p">
            Discover and download on this website. Run the real workflow through Hoosh Desktop and the Local Runtime —
            not in the public browser IDE.
          </p>
        </div>
      </section>

      <section className="hm-section">
        <div className="hm-wrap hm-grid-2" style={{ alignItems: 'start' }}>
          <div>
            <p className="hm-eyebrow">How it works</p>
            <h2 className="hm-h2">Desktop → Runtime → Control Plane → your models</h2>
            <p className="hm-p">
              Hoosh is designed around a local runtime on your machine. When you use local models such as Ollama or LM Studio,
              your agent workflow can run locally without depending on this website as the application environment.
            </p>
            <Link className="hm-link" to="/how-it-works">
              Full architecture →
            </Link>
          </div>
          <ArchitectureDiagram />
        </div>
      </section>

      <section className="hm-section" style={{ paddingTop: 0 }}>
        <div className="hm-wrap">
          <p className="hm-eyebrow">Models</p>
          <h2 className="hm-h2">Bring the models you already use</h2>
          <p className="hm-p">
            Connect Ollama, LM Studio, OpenAI-compatible APIs, and optional cloud providers you configure.
            Hoosh does not require a Hoosh AI token balance — you choose the model infrastructure.
          </p>
          <Link className="hm-link" to="/models">
            Models & providers →
          </Link>
        </div>
      </section>

      <section className="hm-section" style={{ paddingTop: 0 }}>
        <div className="hm-wrap">
          <p className="hm-eyebrow">Features</p>
          <h2 className="hm-h2">What ships in the product</h2>
          <p className="hm-p">Only capabilities verified in the application — no invented feature lists.</p>
          <FeatureGrid items={homeFeatures} />
          <p style={{ marginTop: '1.25rem' }}>
            <Link className="hm-link" to="/features">
              All features →
            </Link>
          </p>
        </div>
      </section>

      <section className="hm-section" style={{ paddingTop: 0 }}>
        <div className="hm-wrap">
          <p className="hm-eyebrow">Who it&apos;s for</p>
          <h2 className="hm-h2">Built for technical users</h2>
          <div className="hm-grid-3" style={{ marginTop: '1.25rem' }}>
            {AUDIENCES.map((a) => (
              <article key={a.title} className="hm-panel">
                <h3 className="hm-h3">{a.title}</h3>
                <p className="hm-p" style={{ marginBottom: 0 }}>{a.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hm-section" style={{ paddingTop: 0 }}>
        <div className="hm-wrap">
          <p className="hm-eyebrow">Source available</p>
          <h2 className="hm-h2">Inspect the code</h2>
          <p className="hm-p">
            Hoosh&apos;s source is publicly available for transparency, inspection, and permitted use under the project license.
            Source-available is not the same as conventional Open Source.
          </p>
          <div className="hm-btn-row">
            <a className="hm-btn hm-btn-ghost" href={SITE_LINKS.source} target="_blank" rel="noreferrer">
              View on GitHub
            </a>
            <Link className="hm-btn hm-btn-ghost" to="/license">
              License
            </Link>
          </div>
        </div>
      </section>

      <section className="hm-section" style={{ paddingTop: 0 }}>
        <div className="hm-wrap">
          <p className="hm-eyebrow">FAQ</p>
          <h2 className="hm-h2">Common questions</h2>
          <Faq items={FAQ_ITEMS.slice(0, 6)} />
          <p style={{ marginTop: '1rem' }}>
            <Link className="hm-link" to="/docs">
              Getting started docs →
            </Link>
          </p>
        </div>
      </section>

      <section className="hm-section-tight">
        <div className="hm-wrap hm-panel" style={{ textAlign: 'center' }}>
          <h2 className="hm-h2">Download Hoosh</h2>
          <p className="hm-p" style={{ marginInline: 'auto' }}>
            Get the desktop app, connect your models, and run agents on your machine.
          </p>
          <div className="hm-btn-row" style={{ justifyContent: 'center' }}>
            <Link className="hm-btn" to="/download">
              Download Hoosh
            </Link>
            <a className="hm-btn hm-btn-ghost" href={SITE_LINKS.source} target="_blank" rel="noreferrer">
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
