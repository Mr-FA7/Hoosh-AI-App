import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { COMPANY, PRODUCT_NAME, SITE_LINKS } from '../content/site';

export default function AboutPage() {
  return (
    <>
      <Seo
        title={`About — ${PRODUCT_NAME}`}
        description={`${PRODUCT_NAME} is a local-first AI agent platform developed by ${COMPANY}.`}
        path="/about"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">About</p>
        <h1 className="hm-h1">Hoosh by {COMPANY}</h1>
        <p className="hm-lead">
          {PRODUCT_NAME} is a product of {COMPANY}. We build a local-first agent platform so you can connect the models and tools you choose.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap">
          <h2 className="hm-h2">Why Hoosh exists</h2>
          <p className="hm-p">
            Many AI tools push you into a single hosted chat surface. Hoosh focuses on giving you control over the runtime,
            model connections, and a local development-oriented workspace — Desktop, Runtime, and Control Plane on your machine.
          </p>
          <h2 className="hm-h2">Philosophy</h2>
          <ul className="hm-p">
            <li>Local-first Runtime on localhost</li>
            <li>Model-agnostic connections (bring your own)</li>
            <li>Honest licensing: source-available, not conventional Open Source slogans</li>
            <li>Website for discovery; application for work</li>
          </ul>
          <p className="hm-p">
            <Link className="hm-link" to="/contact">
              Contact & community
            </Link>
            {' · '}
            <a className="hm-link" href={SITE_LINKS.source} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
