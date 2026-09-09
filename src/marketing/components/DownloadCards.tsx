import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Accordion } from './Accordion';
import { HOOSH_VERSION, SITE_LINKS } from '../content/site';

const GATEKEEPER_CMD =
  'xattr -dr com.apple.quarantine "/Applications/Hoosh.app" && open "/Applications/Hoosh.app"';

export function DownloadCards() {
  const initial = useMemo<'mac' | 'win'>(() => {
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')) return 'mac';
    return 'win';
  }, []);
  const [os, setOs] = useState<'mac' | 'win'>(initial);

  const href = os === 'mac' ? SITE_LINKS.downloadMac : SITE_LINKS.downloadWin;
  const label = os === 'mac' ? 'Download for Mac' : 'Download for Windows';

  return (
    <div>
      <p className="hm-p">
        Latest release: <strong style={{ color: 'var(--hm-ink)' }}>v{HOOSH_VERSION}</strong>
        {' · '}
        <a className="hm-link" href={SITE_LINKS.releases} target="_blank" rel="noreferrer">
          All releases on GitHub
        </a>
      </p>

      <div className="hm-os-toggle" role="group" aria-label="Choose operating system">
        <button type="button" aria-pressed={os === 'mac'} onClick={() => setOs('mac')}>
          macOS
        </button>
        <button type="button" aria-pressed={os === 'win'} onClick={() => setOs('win')}>
          Windows
        </button>
      </div>

      <div className="hm-dl-grid">
        <div className="hm-panel">
          <h3 className="hm-h3">{os === 'mac' ? 'macOS' : 'Windows'}</h3>
          <p className="hm-p">
            {os === 'mac'
              ? 'Desktop installer (DMG). Current builds are not Apple notarized.'
              : 'Desktop installer (ZIP). Extract and run the application.'}
          </p>
          <a className="hm-btn" href={href}>
            <Download size={18} aria-hidden />
            {label}
          </a>
        </div>
        <div className="hm-panel">
          <h3 className="hm-h3">What you get</h3>
          <p className="hm-p" style={{ marginBottom: 0 }}>
            Hoosh Desktop launches the Local Runtime and opens the Control Plane on your machine.
            The website is for discovery and download — not the IDE.
          </p>
        </div>
      </div>

      {os === 'mac' && (
        <div style={{ marginTop: '1.25rem' }}>
          <Accordion title="macOS first-launch instructions (Gatekeeper)">
            <p>
              Because the build is not notarized, macOS may show “Not Opened” if you double-click the app.
              Prefer the steps in <strong>START HERE.txt</strong> inside the DMG, or run:
            </p>
            <pre className="hm-code">{GATEKEEPER_CMD}</pre>
            <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              Adjust the path if you installed Hoosh somewhere other than <code>/Applications</code>.
            </p>
          </Accordion>
        </div>
      )}
    </div>
  );
}
