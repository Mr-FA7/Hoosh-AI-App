import { Link } from 'react-router-dom';
import { DownloadCards } from '../components/DownloadCards';
import { Seo } from '../components/Seo';
import { HOOSH_VERSION, PRODUCT_NAME, SITE_LINKS } from '../content/site';

export default function DownloadPage() {
  return (
    <>
      <Seo
        title={`Download — ${PRODUCT_NAME}`}
        description={`Download Hoosh AI v${HOOSH_VERSION} for macOS and Windows. Local-first desktop agent platform by FA7 Labs LTD.`}
        path="/download"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">Download</p>
        <h1 className="hm-h1">Get Hoosh Desktop</h1>
        <p className="hm-lead">
          Installers are published on GitHub Releases. After install, you run agents through Desktop + Local Runtime — not in this browser tab.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap">
          <DownloadCards />
          <p className="hm-p" style={{ marginTop: '1.5rem' }}>
            Next:{' '}
            <Link className="hm-link" to="/docs">
              Getting started
            </Link>
            {' · '}
            <a className="hm-link" href={SITE_LINKS.releases} target="_blank" rel="noreferrer">
              Release assets
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
