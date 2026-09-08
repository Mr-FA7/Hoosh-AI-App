/**
 * Viewport breakpoints for the workspace layout.
 *
 * Hoosh runs on phones, tablets, laptops, desktops and TVs, so the four
 * side-by-side panels (rail + explorer + workspace + AI) cannot have fixed
 * widths. This hook is the single source of truth for which layout applies.
 *
 *   mobile  < 640   one pane at a time (toggle between work and chat)
 *   tablet  < 1024  workspace + chat, no file tree
 *   laptop  < 1440  all panels, tightened
 *   desktop < 1920  all panels, default widths
 *   tv      >= 1920 all panels, roomier so it doesn't look sparse
 */
import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'tv';

export const BREAKPOINTS = { mobile: 640, tablet: 1024, laptop: 1440, desktop: 1920 } as const;

export function resolveBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  if (width < BREAKPOINTS.laptop) return 'laptop';
  if (width < BREAKPOINTS.desktop) return 'desktop';
  return 'tv';
}

export function useBreakpoint(): {
  bp: Breakpoint;
  isMobile: boolean;
  /** Too narrow for the file tree (mobile or tablet). */
  isNarrow: boolean;
  isTv: boolean;
  width: number;
} {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const bp = resolveBreakpoint(width);
  return {
    bp,
    width,
    isMobile: bp === 'mobile',
    isNarrow: bp === 'mobile' || bp === 'tablet',
    isTv: bp === 'tv'
  };
}
