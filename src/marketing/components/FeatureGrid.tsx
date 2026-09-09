import type { FeatureItem } from '../content/site';

type FeatureGridProps = {
  items: FeatureItem[];
};

function statusLabel(item: FeatureItem): string | null {
  if (item.status === 'conditional') return item.statusNote || 'Requires local software';
  if (item.status === 'caveat') return item.statusNote || 'Important caveat';
  if (item.status === 'legacy') return 'Legacy';
  return null;
}

export function FeatureGrid({ items }: FeatureGridProps) {
  return (
    <div className="hm-feature-grid">
      {items.map((item) => {
        const badge = statusLabel(item);
        return (
          <article key={item.id} className="hm-panel">
            <h3 className="hm-h3">{item.title}</h3>
            <p className="hm-p" style={{ marginBottom: 0 }}>{item.body}</p>
            {badge && (
              <span
                className={`hm-badge ${
                  item.status === 'conditional'
                    ? 'hm-badge-conditional'
                    : item.status === 'caveat'
                      ? 'hm-badge-caveat'
                      : ''
                }`}
              >
                {badge}
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}
