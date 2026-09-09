/**
 * Hosted marketing site (aihoosh.com) — brand + download only.
 * Full IDE runs inside Hoosh Desktop, not in the browser.
 */
import React, { useState } from 'react';
import { Download, Monitor, Terminal } from 'lucide-react';

const MAC_URL = 'https://github.com/Mr-FA7/Hoosh-AI-Releases/releases/latest/download/HooshSetup.dmg';
const WIN_URL = 'https://github.com/Mr-FA7/Hoosh-AI-Releases/releases/latest/download/HooshSetup-win.zip';
const LEGACY_MAC = '/HooshCompanionSetup.dmg';
const LEGACY_WIN = '/HooshBridgeSetup.exe';

const MarketingLanding: React.FC = () => {
  const [os, setOs] = useState<'mac' | 'win'>(() =>
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? 'mac' : 'win'
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const primaryHref = os === 'mac' ? MAC_URL : WIN_URL;
  const primaryLabel = os === 'mac' ? 'Download for Mac' : 'Download for Windows';

  return (
    <div className="hoosh-marketing">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        .hoosh-marketing {
          --hm-ink: #e8eef7;
          --hm-muted: #8b9bb0;
          --hm-accent: #3d8bfd;
          --hm-deep: #071018;
          --hm-mid: #0c1a28;
          position: fixed;
          inset: 0;
          overflow: auto;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          color: var(--hm-ink);
          background:
            radial-gradient(ellipse 90% 60% at 70% 20%, rgba(61, 139, 253, 0.18), transparent 55%),
            radial-gradient(ellipse 70% 50% at 10% 80%, rgba(20, 120, 90, 0.12), transparent 50%),
            linear-gradient(165deg, var(--hm-deep) 0%, var(--hm-mid) 45%, #06141f 100%);
        }
        .hm-hero {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(1.5rem, 4vw, 3.5rem);
          position: relative;
        }
        .hm-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(232, 238, 247, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232, 238, 247, 0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent);
          pointer-events: none;
          animation: hm-grid-drift 28s linear infinite;
        }
        @keyframes hm-grid-drift {
          from { transform: translateY(0); }
          to { transform: translateY(48px); }
        }
        @keyframes hm-rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hm-brand {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: clamp(3.2rem, 10vw, 6.5rem);
          letter-spacing: -0.04em;
          line-height: 0.95;
          margin: 0 0 1.25rem;
          animation: hm-rise 0.7s ease-out both;
        }
        .hm-brand span {
          background: linear-gradient(120deg, #f0f6ff 20%, #3d8bfd 70%, #5eead4 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .hm-line {
          max-width: 28rem;
          font-size: clamp(1.05rem, 2.2vw, 1.25rem);
          line-height: 1.55;
          color: var(--hm-muted);
          margin: 0 0 2rem;
          animation: hm-rise 0.7s ease-out 0.12s both;
        }
        .hm-cta-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem 1rem;
          animation: hm-rise 0.7s ease-out 0.22s both;
        }
        .hm-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.85rem 1.35rem;
          border-radius: 0.55rem;
          background: var(--hm-accent);
          color: #fff;
          font-weight: 600;
          font-size: 0.95rem;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hm-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(61, 139, 253, 0.35);
        }
        .hm-os {
          display: inline-flex;
          gap: 0.35rem;
        }
        .hm-os button {
          font: inherit;
          font-size: 0.8rem;
          padding: 0.45rem 0.75rem;
          border-radius: 0.4rem;
          border: 1px solid rgba(232, 238, 247, 0.14);
          background: transparent;
          color: var(--hm-muted);
          cursor: pointer;
        }
        .hm-os button[aria-pressed="true"] {
          color: var(--hm-ink);
          border-color: rgba(61, 139, 253, 0.55);
          background: rgba(61, 139, 253, 0.12);
        }
        .hm-section {
          padding: clamp(2.5rem, 6vw, 5rem) clamp(1.5rem, 4vw, 3.5rem);
          border-top: 1px solid rgba(232, 238, 247, 0.08);
          max-width: 42rem;
        }
        .hm-section h2 {
          font-family: 'Syne', sans-serif;
          font-size: 1.35rem;
          font-weight: 700;
          margin: 0 0 0.65rem;
          letter-spacing: -0.02em;
        }
        .hm-section p {
          margin: 0;
          color: var(--hm-muted);
          line-height: 1.6;
          font-size: 0.98rem;
        }
        .hm-adv {
          margin-top: 1.25rem;
        }
        .hm-adv summary {
          cursor: pointer;
          color: var(--hm-muted);
          font-size: 0.85rem;
          list-style: none;
        }
        .hm-adv summary::-webkit-details-marker { display: none; }
        .hm-adv-body {
          margin-top: 0.85rem;
          font-size: 0.85rem;
          color: var(--hm-muted);
          line-height: 1.55;
        }
        .hm-adv-body a {
          color: #7eb6ff;
        }
        .hm-foot {
          padding: 1.5rem clamp(1.5rem, 4vw, 3.5rem) 2.5rem;
          font-size: 0.75rem;
          color: rgba(139, 155, 176, 0.7);
        }
      `}</style>

      <section className="hm-hero" aria-label="Hoosh">
        <h1 className="hm-brand"><span>Hoosh</span></h1>
        <p className="hm-line">
          Free, local-first agent platform. Your models, your machine — download the desktop app and work offline.
        </p>
        <div className="hm-cta-row">
          <a className="hm-btn" href={primaryHref} download>
            <Download size={18} aria-hidden />
            {primaryLabel}
          </a>
          <div className="hm-os" role="group" aria-label="Platform">
            <button type="button" aria-pressed={os === 'mac'} onClick={() => setOs('mac')}>
              Mac
            </button>
            <button type="button" aria-pressed={os === 'win'} onClick={() => setOs('win')}>
              Windows
            </button>
          </div>
        </div>
      </section>

      <section className="hm-section">
        <h2>
          <Monitor size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} aria-hidden />
          Runs on your computer
        </h2>
        <p>
          Hoosh Desktop opens a dedicated browser shell with Local Runtime — files, terminal, Git, Docker, and local LLMs — without relying on the website as the IDE.
        </p>
      </section>

      <section className="hm-section">
        <h2>
          <Terminal size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} aria-hidden />
          Bring your own models
        </h2>
        <p>
          Connect Ollama, LM Studio, or your own API keys. No Hoosh token sales — core workflows stay free and local.
        </p>

        <details
          className="hm-adv"
          open={showAdvanced}
          onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
        >
          <summary>Advanced: legacy local bridge (website + companion)</summary>
          <div className="hm-adv-body">
            Prefer the old bridge flow?{' '}
            <a href={os === 'mac' ? LEGACY_MAC : LEGACY_WIN} download>
              {os === 'mac' ? 'HooshCompanionSetup.dmg' : 'HooshBridgeSetup.exe'}
            </a>
            . New installs should use Hoosh Desktop above.
          </div>
        </details>
      </section>

      <footer className="hm-foot">© {new Date().getFullYear()} Hoosh · Local-first · Model-agnostic</footer>
    </div>
  );
};

export default MarketingLanding;
