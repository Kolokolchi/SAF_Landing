import { createRoot } from 'react-dom/client';
import { Agentation } from 'agentation';

// React owns only this toolbar; the existing Tilda page keeps its own DOM and runtime.
if (process.env.NODE_ENV === 'development' && !document.getElementById('agentation-dev-root')) {
  const host = document.createElement('div');
  host.id = 'agentation-dev-root';
  document.body.appendChild(host);
  // Agentation uses an open shadow root. Keep its default position above the catalog button;
  // an explicitly dragged toolbar retains its own inline position.
  let observedShadow;
  const observer = new MutationObserver(() => {
    // Agentation portals its toolbar outside the React mount container.
    const shadow = document.querySelector('.saf-agentation-toolbar')?.shadowRoot;
    if (!shadow) return;
    if (observedShadow !== shadow) {
      observer.disconnect();
      observer.observe(shadow, { childList: true, subtree: true });
      observedShadow = shadow;
    }
    if (!shadow.querySelector('[data-agentation-toolbar]')) {
      return;
    }
    if (shadow.querySelector('style[data-saf-agentation-position]')) return;
    const style = document.createElement('style');
    style.dataset.safAgentationPosition = '';
    style.textContent = '[data-agentation-toolbar]:not([style]) { bottom: 152px; }';
    shadow.appendChild(style);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  createRoot(host).render(<Agentation appName="SAF Avenue" className="saf-agentation-toolbar" />);
}
