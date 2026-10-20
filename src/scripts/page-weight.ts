// Fills the carbon meter ([data-meter]) and live metrics ([data-dev]) with what
// this browser actually downloaded for the page's first view. Lazy images are
// left out, as the audit tool leaves them out, so the two agree. Loaded only on
// pages that show one of them (see BaseLayout).
import { estimateCarbon, gradeFromGrams, formatGrams, GRADE_COLORS } from '../lib/carbon.mjs';

const MEDIAN_BYTES = 1790 * 1000; // the study's median homepage
const ARC = 326.7; // circumference of the meter's ring (r = 52)

let lcp = 0;
try {
  new PerformanceObserver((list) => {
    const last = list.getEntries().at(-1);
    if (last) lcp = last.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
} catch {
  /* no LCP support: that figure keeps its placeholder */
}

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

function measure(): void {
  // Only on a full load of this page: resource timing piles up across soft
  // navigations, so after one the built-in text stays.
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!nav || new URL(nav.name).pathname !== location.pathname) return;

  const size = (e: PerformanceResourceTiming) => (e.transferSize > 0 ? e.transferSize : e.encodedBodySize || 0);
  const lazy = new Set(
    Array.from(document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]'), (img) => img.currentSrc || img.src),
  );
  const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
    (e) => !['beacon', 'fetch', 'xmlhttprequest'].includes(e.initiatorType) && !lazy.has(e.name),
  );

  const kinds: Record<string, number> = { html: size(nav), css: 0, js: 0, fonts: 0, images: 0 };
  for (const e of resources) {
    const path = new URL(e.name).pathname;
    const kind = /\.woff2?$/.test(path)
      ? 'fonts'
      : /\.css$/.test(path)
        ? 'css'
        : /\.m?js$/.test(path) || e.initiatorType === 'script'
          ? 'js'
          : 'images';
    kinds[kind] += size(e);
  }
  const bytes = Object.values(kinds).reduce((a, b) => a + b, 0);
  if (bytes < 20_000) return; // too little reported to be a real reading

  const { grams, rating } = estimateCarbon(bytes, true);
  const grade = rating ?? gradeFromGrams(grams);

  document.querySelectorAll<HTMLElement>('[data-meter]').forEach((meter) => {
    const arc = meter.querySelector<SVGCircleElement>('[data-meter-arc]');
    meter.querySelector('[data-meter-grade]')!.textContent = grade;
    if (arc) {
      arc.style.strokeDashoffset = String(ARC * (1 - Math.min(1, bytes / MEDIAN_BYTES)));
      if (grade !== 'A+') arc.style.stroke = (GRADE_COLORS as Record<string, string>)[grade];
    }
    const summary = meter.querySelector('[data-meter-summary]');
    if (summary) {
      summary.textContent = `${kb(bytes)} and ${formatGrams(grams)} of CO₂: ${Math.round((bytes / MEDIAN_BYTES) * 100)}% of the weight of a typical UK small business homepage.`;
    }
    for (const [k, v] of Object.entries(kinds)) {
      meter.querySelector<HTMLElement>(`[data-seg="${k}"]`)?.style.setProperty('--w', `${(v / bytes) * 100}%`);
      const label = meter.querySelector(`[data-seg-kb="${k}"]`);
      if (label) label.textContent = kb(v);
    }
  });

  const dev = (k: string, text: string) =>
    document.querySelectorAll(`[data-dev="${k}"]`).forEach((el) => (el.textContent = text));
  if (lcp) dev('lcp', `${(lcp / 1000).toFixed(1)} s`);
  dev('js', kb(kinds.js));
  dev('requests', String(resources.length + 1));
  dev('weight', kb(bytes));
  dev('grade', grade);
}

export function schedule(): void {
  if (document.readyState === 'complete') setTimeout(measure, 900);
  else window.addEventListener('load', () => setTimeout(measure, 900), { once: true });
}
