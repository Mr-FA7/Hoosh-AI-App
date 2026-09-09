import { Link } from 'react-router-dom';
import { Accordion } from '../components/Accordion';
import { Seo } from '../components/Seo';
import { PRODUCT_NAME, SITE_LINKS } from '../content/site';
import { LEGACY_BRIDGE_MAC, LEGACY_BRIDGE_WIN } from '../release';

const GATEKEEPER_CMD =
  'xattr -dr com.apple.quarantine "/Applications/Hoosh.app" && open "/Applications/Hoosh.app"';

export default function DocsPage() {
  return (
    <>
      <Seo
        title={`Docs — ${PRODUCT_NAME}`}
        description="Getting started with Hoosh AI: download, install, launch, connect models, and troubleshoot Gatekeeper."
        path="/docs"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">Documentation</p>
        <h1 className="hm-h1">Getting started</h1>
        <p className="hm-lead">
          From Reddit discovery to a running desktop workspace — without treating this website as the IDE.
        </p>
      </div>

      <section className="hm-section-tight">
        <div className="hm-wrap">
          <ol className="hm-steps">
            <li>
              <strong style={{ color: 'var(--hm-ink)' }}>Download</strong>
              <br />
              Get the macOS or Windows installer from the{' '}
              <Link className="hm-link" to="/download">
                Download page
              </Link>
              .
            </li>
            <li>
              <strong style={{ color: 'var(--hm-ink)' }}>Install</strong>
              <br />
              On Mac, open the DMG and follow <code>START HERE.txt</code> if Gatekeeper blocks double-click. On Windows, extract the ZIP and run the app.
            </li>
            <li>
              <strong style={{ color: 'var(--hm-ink)' }}>Launch</strong>
              <br />
              Hoosh Desktop starts the Local Runtime and opens the Control Plane UI in the desktop window.
            </li>
            <li>
              <strong style={{ color: 'var(--hm-ink)' }}>Sign in</strong>
              <br />
              The local UI uses Firebase Authentication for account surfaces. You need network access to sign in.
            </li>
            <li>
              <strong style={{ color: 'var(--hm-ink)' }}>Configure a model</strong>
              <br />
              Connect Ollama, LM Studio, or an OpenAI-compatible / cloud provider you already use. See{' '}
              <Link className="hm-link" to="/models">
                Models
              </Link>
              .
            </li>
            <li>
              <strong style={{ color: 'var(--hm-ink)' }}>Open a workspace</strong>
              <br />
              Use files, terminal, Git, and agents against a project on your machine.
            </li>
            <li>
              <strong style={{ color: 'var(--hm-ink)' }}>Run a first workflow</strong>
              <br />
              Ask the agent to inspect or edit files with your approval settings — keep secrets out of prompts.
            </li>
          </ol>

          <h2 className="hm-h2" style={{ marginTop: '2.5rem' }}>
            Troubleshooting
          </h2>
          <Accordion title="macOS shows “Not Opened” / Gatekeeper">
            <p>
              Current macOS builds are not Apple notarized. Use the Terminal steps from <code>START HERE.txt</code> in the DMG, or:
            </p>
            <pre className="hm-code">{GATEKEEPER_CMD}</pre>
          </Accordion>
          <Accordion title="First launch needs Node / network">
            <p style={{ margin: 0 }}>
              The Local Runtime may run <code>npm ci</code> on first install. Have Node available and allow network for dependency install.
              After that, local model workflows can stay on your machine.
            </p>
          </Accordion>
          <Accordion title="Where to get help">
            <p style={{ margin: 0 }}>
              Prefer{' '}
              <a className="hm-link" href={SITE_LINKS.issues} target="_blank" rel="noreferrer">
                GitHub Issues
              </a>
              {' '}for bugs and{' '}
              <a className="hm-link" href={SITE_LINKS.discussions} target="_blank" rel="noreferrer">
                Discussions
              </a>
              {' '}for questions. Security reports: follow{' '}
              <a className="hm-link" href={SITE_LINKS.security} target="_blank" rel="noreferrer">
                private advisories
              </a>
              .
            </p>
          </Accordion>

          <h2 className="hm-h2" style={{ marginTop: '2.5rem' }}>
            Advanced: legacy local bridge
          </h2>
          <p className="hm-p">
            An older browser + companion bridge path still exists for advanced users. It is <strong>not</strong> the primary product path.
            Prefer Hoosh Desktop.
          </p>
          <Accordion title="Legacy bridge downloads">
            <p>
              Only if you know you need the legacy companion/bridge installers:
            </p>
            <ul>
              <li>
                <a className="hm-link" href={LEGACY_BRIDGE_MAC}>
                  Mac companion (legacy)
                </a>
              </li>
              <li>
                <a className="hm-link" href={LEGACY_BRIDGE_WIN}>
                  Windows bridge (legacy)
                </a>
              </li>
            </ul>
          </Accordion>
        </div>
      </section>
    </>
  );
}
