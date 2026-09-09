import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { NAV_PRIMARY, SITE_LINKS } from '../content/site';

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="hm-nav">
      <div className="hm-nav-inner">
        <Link to="/" className="hm-logo" onClick={() => setOpen(false)}>
          Hoosh<span className="hm-brand-grad"> AI</span>
        </Link>

        <nav aria-label="Primary">
          <ul className="hm-nav-links">
            {NAV_PRIMARY.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'hm-nav-active' : undefined)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hm-nav-actions">
          <a
            className="hm-btn hm-btn-ghost"
            href={SITE_LINKS.source}
            target="_blank"
            rel="noreferrer"
            style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem' }}
          >
            GitHub
          </a>
          <Link
            className="hm-btn"
            to="/download"
            style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem' }}
            onClick={() => setOpen(false)}
          >
            Download
          </Link>
          <button
            type="button"
            className="hm-menu-btn"
            aria-expanded={open}
            aria-controls="hm-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div id="hm-mobile-nav" className="hm-mobile-panel">
          {NAV_PRIMARY.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <a href={SITE_LINKS.source} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            GitHub
          </a>
        </div>
      )}
    </header>
  );
}
