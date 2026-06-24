import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';

/** Renders dropdown in a portal so parent overflow does not clip the panel. */
export function ComboboxPanel({ open, anchorRef, panelRef, children, className = 'cp-combobox-panel' }) {
  const innerRef = useRef(null);
  const setPanelRef = (el) => {
    innerRef.current = el;
    if (panelRef) {
      if (typeof panelRef === 'function') panelRef(el);
      else panelRef.current = el;
    }
  };
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setPos(null);
      return undefined;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const maxH = Math.min(280, window.innerHeight - r.bottom - 16);
      setPos({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        maxHeight: Math.max(120, maxH),
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={setPanelRef}
      className={className}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        zIndex: 1100,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
