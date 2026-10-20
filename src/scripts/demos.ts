// Starts each CSS demo ([data-demo]) when it scrolls into view by adding
// `.is-in`. Under reduced motion the demos' CSS shows the finished state, so
// nothing here needs to know about it. One observer per page.
let observer: IntersectionObserver | null = null;

export function watchDemos(): void {
  observer?.disconnect();
  const els = document.querySelectorAll<HTMLElement>('[data-demo]:not(.is-in)');
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 },
  );
  observer = io;
  els.forEach((el) => io.observe(el));
}
