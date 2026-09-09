import { Link } from 'react-router-dom';
import {
  COMPANY,
  FOOTER_COMPANY,
  FOOTER_PRODUCT,
  FOOTER_RESOURCES,
  PRODUCT_NAME,
  SITE_LINKS,
} from '../content/site';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="hm-footer">
      <div className="hm-wrap hm-footer-grid">
        <div>
          <div className="hm-logo" style={{ marginBottom: '0.75rem' }}>
            Hoosh<span className="hm-brand-grad"> AI</span>
          </div>
          <p className="hm-p" style={{ marginBottom: '0.5rem' }}>
            Local-first AI agent platform.
          </p>
          <p className="hm-p" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
            {PRODUCT_NAME} is a product of {COMPANY}.
          </p>
        </div>

        <div>
          <h3>Product</h3>
          <ul>
            {FOOTER_PRODUCT.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Resources</h3>
          <ul>
            {FOOTER_RESOURCES.map((item) =>
              'href' in item ? (
                <li key={item.label}>
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                </li>
              ) : (
                <li key={item.to}>
                  <Link to={item.to}>{item.label}</Link>
                </li>
              )
            )}
          </ul>
        </div>

        <div>
          <h3>Company</h3>
          <ul>
            {FOOTER_COMPANY.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
            <li>
              <a href={SITE_LINKS.issues} target="_blank" rel="noreferrer">
                GitHub Issues
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="hm-wrap hm-footer-bottom">
        <div>
          © {year} {COMPANY}. All rights reserved.
        </div>
        <div>
          {PRODUCT_NAME} is a product of {COMPANY}.
        </div>
      </div>
    </footer>
  );
}
