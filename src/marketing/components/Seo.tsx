import { useEffect } from 'react';
import { SITE_ORIGIN } from '../release';

type SeoProps = {
  title: string;
  description: string;
  path?: string;
};

export function Seo({ title, description, path = '/' }: SeoProps) {
  useEffect(() => {
    document.title = title;
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', `${SITE_ORIGIN}${path}`);
    setMeta('property', 'og:image', `${SITE_ORIGIN}/og-hoosh.png`);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', `${SITE_ORIGIN}/og-hoosh.png`);

    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_ORIGIN}${path}`;
  }, [title, description, path]);

  return null;
}
