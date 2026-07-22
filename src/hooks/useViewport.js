import { useState, useEffect } from 'react';

// Breakpoints tuned for the two priority devices:
// phone   <= 599px  (Galaxy S23 Ultra portrait ~412px)
// tablet  <= 1024px (iPad Pro 11" portrait 834px, landscape 1194px falls to desktop)
// desktop >  1024px
const PHONE_MAX = 599;
const TABLET_MAX = 1024;

function getBreakpoint(width) {
  if (width <= PHONE_MAX) return 'phone';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

function getIsTouch() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

function getState() {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const height = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    width,
    height,
    breakpoint: getBreakpoint(width),
    isTouch: getIsTouch(),
    // Orientation-aware phone detection: uses the SHORTER of width/height so a phone
    // rotated to landscape (e.g. S23 Ultra ~915x412) still counts as "phone" rather than
    // falling into the width-only "tablet" bucket. iPad stays "not phone" in either
    // orientation since its shorter dimension (834) is well above PHONE_MAX.
    isPhone: Math.min(width, height) <= PHONE_MAX,
  };
}

// Tracks viewport breakpoint + touch capability so components can branch
// their inline styles for mobile layouts (no CSS media queries available).
export function useViewport() {
  const [state, setState] = useState(getState);

  useEffect(() => {
    const phoneQuery = window.matchMedia(`(max-width: ${PHONE_MAX}px)`);
    const tabletQuery = window.matchMedia(`(max-width: ${TABLET_MAX}px)`);

    function handleChange() {
      setState(getState());
    }

    phoneQuery.addEventListener('change', handleChange);
    tabletQuery.addEventListener('change', handleChange);
    window.addEventListener('resize', handleChange);
    handleChange();

    return () => {
      phoneQuery.removeEventListener('change', handleChange);
      tabletQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, []);

  return state;
}

export default useViewport;
