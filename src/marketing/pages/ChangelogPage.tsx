import { Seo } from '../components/Seo';
import { CHANGELOG_ENTRIES, PRODUCT_NAME, SITE_LINKS } from '../content/site';

export default function ChangelogPage() {
  return (
    <>
      <Seo
        title={`Changelog — ${PRODUCT_NAME}`}
        description="Release notes for Hoosh AI, starting with the v1.0.0 public source-available release."
        path="/changelog"
      />
      <div className="hm-page-hero hm-wrap">
        <p className="hm-eyebrow">Changelog</p>
        <h1 className="hm-h1">Releases</h1>
        <p className="hm-lead">
          Notable product changes. Full detail lives in the repository changelog.
        </p>
      </div>
      <section className="hm-section-tight">
        <div className="hm-wrap">
          {CHANGELOG_ENTRIES.map((entry) => (
            <article key={entry.version} className="hm-panel" style={{ marginBottom: '1rem' }}>
              <h2 className="hm-h2" style={{ marginBottom: '0.35rem' }}>
                v{entry.version}
              </h2>
              <p className="hm-p" style={{ fontSize: '0.9rem' }}>
                {entry.date}
              </p>
              <ul className="hm-p" style={{ marginBottom: 0 }}>
                {entry.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </article>
          ))}
          <p className="hm-p">
            <a className="hm-link" href={SITE_LINKS.changelog} target="_blank" rel="noreferrer">
              CHANGELOG.md on GitHub
            </a>
            {' · '}
            <a className="hm-link" href={SITE_LINKS.releases} target="_blank" rel="noreferrer">
              Installer releases
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
