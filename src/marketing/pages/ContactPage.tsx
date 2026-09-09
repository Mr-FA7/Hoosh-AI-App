import { Seo } from '../components/Seo';
import { COMPANY, PRODUCT_NAME, SITE_LINKS } from '../content/site';

export default function ContactPage() {
  return (
    <>
      <Seo
        title={`Contact — ${PRODUCT_NAME}`}
        description="Reach the Hoosh AI project via GitHub Issues, Discussions, or private security advisories."
        path="/contact"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">Contact</p>
        <h1 className="hm-h1">Community & support</h1>
        <p className="hm-lead">
          {PRODUCT_NAME} is developed by {COMPANY}. Use the official GitHub channels below — we do not invent extra social accounts here.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap hm-grid-3">
          <a className="hm-panel" href={SITE_LINKS.issues} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 className="hm-h3">GitHub Issues</h3>
            <p className="hm-p" style={{ marginBottom: 0 }}>Bugs, regressions, and concrete product problems.</p>
          </a>
          <a className="hm-panel" href={SITE_LINKS.discussions} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 className="hm-h3">Discussions</h3>
            <p className="hm-p" style={{ marginBottom: 0 }}>Questions, ideas, and community conversation.</p>
          </a>
          <a className="hm-panel" href={SITE_LINKS.security} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 className="hm-h3">Security</h3>
            <p className="hm-p" style={{ marginBottom: 0 }}>Private vulnerability reporting via GitHub advisories.</p>
          </a>
        </div>
      </section>
    </>
  );
}
