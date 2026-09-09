import { Link } from 'react-router-dom';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram';
import { Seo } from '../components/Seo';
import { PRODUCT_NAME } from '../content/site';

export default function HowItWorksPage() {
  return (
    <>
      <Seo
        title={`How it works — ${PRODUCT_NAME}`}
        description="How Hoosh Desktop, Local Runtime, and Control Plane fit together — and how the website differs from the application."
        path="/how-it-works"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">How it works</p>
        <h1 className="hm-h1">Website discovers. Desktop runs.</h1>
        <p className="hm-lead">
          aihoosh.com is for discovery, download, and documentation. The agent workspace runs through Hoosh Desktop and a Local Runtime on your machine.
        </p>
      </div>

      <section className="hm-section-tight">
        <div className="hm-wrap hm-grid-2" style={{ alignItems: 'start' }}>
          <div>
            <h2 className="hm-h2">On your machine</h2>
            <ArchitectureDiagram />
          </div>
          <div>
            <h2 className="hm-h2">Website vs application</h2>
            <div className="hm-panel" style={{ marginBottom: '1rem' }}>
              <h3 className="hm-h3">Website</h3>
              <p className="hm-p" style={{ marginBottom: 0 }}>
                Discovery, download, documentation, license, and release information.
              </p>
            </div>
            <div className="hm-panel">
              <h3 className="hm-h3">Application</h3>
              <p className="hm-p" style={{ marginBottom: 0 }}>
                Hoosh Desktop, Local Runtime, Control Plane, agents, tools, files, terminal, Git, Docker (when installed), and model connections.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="hm-section" style={{ paddingTop: 0 }}>
        <div className="hm-wrap">
          <h2 className="hm-h2">What “local-first” means here</h2>
          <p className="hm-p">
            Hoosh is designed around a Local Runtime on your machine. When you use local models such as Ollama or LM Studio,
            your AI workflow can run locally without depending on Hoosh&apos;s website as the application environment.
          </p>
          <div className="hm-grid-2">
            <div className="hm-panel">
              <h3 className="hm-h3">Typically local</h3>
              <p className="hm-p" style={{ marginBottom: 0 }}>
                Hoosh Runtime, desktop application, local files, local tools, and local models where you configure them.
              </p>
            </div>
            <div className="hm-panel">
              <h3 className="hm-h3">Remote when you choose</h3>
              <p className="hm-p" style={{ marginBottom: 0 }}>
                External model APIs, cloud services you connect, Firebase Auth for sign-in, and downloads/updates from GitHub.
              </p>
            </div>
          </div>
          <p className="hm-p" style={{ marginTop: '1.25rem' }}>
            See also{' '}
            <Link className="hm-link" to="/security">
              Security & privacy
            </Link>
            {' '}and{' '}
            <Link className="hm-link" to="/download">
              Download
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
