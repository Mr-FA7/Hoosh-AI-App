import { Seo } from '../components/Seo';
import { COMPANY, PRODUCT_NAME, SITE_LINKS } from '../content/site';

export default function LicensePage() {
  return (
    <>
      <Seo
        title={`License — ${PRODUCT_NAME}`}
        description="Hoosh AI is source-available under its project license — not conventional Open Source. Read the plain-English summary and LICENSE file."
        path="/license"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">License</p>
        <h1 className="hm-h1">Source-available, not conventional Open Source</h1>
        <p className="hm-lead">
          Public source visibility does not mean unrestricted commercial redistribution or resale.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap">
          <div className="hm-panel" style={{ marginBottom: '1rem' }}>
            <h3 className="hm-h3">In plain English</h3>
            <p className="hm-p">
              You may inspect the code, run Hoosh locally, use it for personal/local workflows, modify it locally, and contribute improvements under the project terms.
            </p>
            <p className="hm-p" style={{ marginBottom: 0 }}>
              You may not sell Hoosh, commercially redistribute or repackage it, host it as a paid competing SaaS product based primarily on the Software, or misuse Hoosh trademarks — without separate written permission from the copyright holder ({COMPANY} / the project maintainers).
            </p>
          </div>
          <p className="hm-p">
            This page is a summary only. The binding terms are in the repository{' '}
            <a className="hm-link" href={SITE_LINKS.license} target="_blank" rel="noreferrer">
              LICENSE
            </a>
            .
          </p>
          <p className="hm-p">
            {PRODUCT_NAME} is a product of {COMPANY}.
          </p>
        </div>
      </section>
    </>
  );
}
