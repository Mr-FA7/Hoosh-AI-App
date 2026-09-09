import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { PRODUCT_NAME, SITE_LINKS } from '../content/site';

export default function SecurityPage() {
  return (
    <>
      <Seo
        title={`Security & privacy — ${PRODUCT_NAME}`}
        description="How Hoosh handles local runtime data, model connections, Firebase Auth, and what may leave your machine."
        path="/security"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">Security & privacy</p>
        <h1 className="hm-h1">Architecture, not slogans</h1>
        <p className="hm-lead">
          Hoosh is local-first by design. That does not mean “nothing ever leaves your computer.” Here is what the codebase supports today.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap">
          <h2 className="hm-h2">Local by design</h2>
          <p className="hm-p">
            The Runtime binds to localhost by default. Project files and local tool operations run through software on your machine.
            Desktop mode can gate the Control Plane so ordinary browsers are not the intended client.
          </p>

          <h2 className="hm-h2">Your model connections</h2>
          <p className="hm-p">
            You choose which providers to connect. Local engines keep traffic on your machine. Remote APIs receive whatever context you send under those providers&apos; policies.
          </p>

          <h2 className="hm-h2">No Hoosh token requirement</h2>
          <p className="hm-p">
            The core product does not require purchasing Hoosh-hosted inference tokens. Third-party APIs you configure are separate.
          </p>

          <h2 className="hm-h2">What can leave your machine</h2>
          <div className="hm-grid-2">
            <div className="hm-panel">
              <h3 className="hm-h3">Often stays local</h3>
              <p className="hm-p" style={{ marginBottom: 0 }}>
                Project files via Local Runtime, local model traffic (Ollama / LM Studio / similar), Runtime state under local user directories.
              </p>
            </div>
            <div className="hm-panel">
              <h3 className="hm-h3">May leave when used</h3>
              <p className="hm-p" style={{ marginBottom: 0 }}>
                Cloud model APIs, web research tools, Git remotes, GitHub downloads, Firebase Authentication for sign-in, and standard hosting logs on this marketing site.
              </p>
            </div>
          </div>

          <h2 className="hm-h2" style={{ marginTop: '2rem' }}>
            Accounts & Firebase
          </h2>
          <p className="hm-p">
            The desktop/local Control Plane initializes Firebase Auth. Sign-up and sign-in data is processed by Google Firebase for that project.
            A Firebase Analytics <code>measurementId</code> may be present in client config; do not assume Analytics is fully disabled without verifying your build.
          </p>

          <h2 className="hm-h2">Telemetry</h2>
          <p className="hm-p">
            No dedicated third-party product-analytics SDK (such as PostHog or Mixpanel) is a core dependency. This site does not add marketing analytics trackers.
          </p>

          <p className="hm-p">
            Full notes:{' '}
            <a className="hm-link" href={SITE_LINKS.privacy} target="_blank" rel="noreferrer">
              PRIVACY.md
            </a>
            {' · '}
            <Link className="hm-link" to="/privacy">
              Privacy summary
            </Link>
            {' · '}
            <a className="hm-link" href={SITE_LINKS.security} target="_blank" rel="noreferrer">
              Report a vulnerability
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
