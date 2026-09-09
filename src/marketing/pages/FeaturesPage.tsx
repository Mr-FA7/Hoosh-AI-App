import { Link } from 'react-router-dom';
import { FeatureGrid } from '../components/FeatureGrid';
import { Seo } from '../components/Seo';
import { FEATURES, PRODUCT_NAME } from '../content/site';

export default function FeaturesPage() {
  return (
    <>
      <Seo
        title={`Features — ${PRODUCT_NAME}`}
        description="Verified Hoosh AI capabilities: Desktop, Local Runtime, Control Plane, agents, files, terminal, Git, Docker, and BYO models."
        path="/features"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">Features</p>
        <h1 className="hm-h1">What Hoosh actually includes</h1>
        <p className="hm-lead">
          Feature list derived from the running product — not a wishlist. Conditional items need software you install locally.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap">
          <FeatureGrid items={FEATURES} />
          <p className="hm-p" style={{ marginTop: '1.5rem' }}>
            Looking for install steps?{' '}
            <Link className="hm-link" to="/download">
              Download Hoosh
            </Link>
            {' · '}
            <Link className="hm-link" to="/docs">
              Docs
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
