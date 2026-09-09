import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { PRODUCT_NAME, SITE_LINKS } from '../content/site';

export default function PrivacyPage() {
  return (
    <>
      <Seo
        title={`Privacy — ${PRODUCT_NAME}`}
        description="Privacy-relevant behavior for Hoosh AI: local runtime data, Firebase Auth, model providers, and marketing hosting."
        path="/privacy"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">Privacy</p>
        <h1 className="hm-h1">Privacy summary</h1>
        <p className="hm-lead">
          Hoosh is local-first, but we do not claim “zero data collection” in all configurations. This summary aligns with the repository PRIVACY.md.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap">
          <h2 className="hm-h2">May stay local</h2>
          <p className="hm-p">
            Project files via Local Runtime, local model traffic you configure on your machine, and local Runtime state under user directories.
          </p>
          <h2 className="hm-h2">May leave your machine</h2>
          <p className="hm-p">
            Optional cloud model providers, Firebase Authentication, this marketing site&apos;s hosting logs, GitHub downloads, and any remotes or web tools you use.
          </p>
          <h2 className="hm-h2">Your choices</h2>
          <p className="hm-p">
            Prefer local models for sensitive work. Avoid pasting secrets into chat, Issues, or logs. Review provider and Firebase settings for your deployment.
          </p>
          <p className="hm-p">
            <a className="hm-link" href={SITE_LINKS.privacy} target="_blank" rel="noreferrer">
              Full PRIVACY.md
            </a>
            {' · '}
            <Link className="hm-link" to="/security">
              Security & privacy
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
