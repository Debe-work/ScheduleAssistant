import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type HelpHintProps = {
  label: string;
  children: React.ReactNode;
};

const PANEL_WIDTH = 296;
const VIEWPORT_MARGIN = 12;
const TRIGGER_GAP = 8;
const PASSIVE_CAPTURE_OPTIONS = { capture: true, passive: true } as const;
const PASSIVE_OPTIONS = { passive: true } as const;

export function HelpHint({ label, children }: HelpHintProps) {
  const [open, setOpen] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) {
      setPositioned(false);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const rect = trigger.getBoundingClientRect();
      const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
      const panelHeight = panel.offsetHeight;

      let top = rect.bottom + TRIGGER_GAP;
      let left = rect.left + rect.width / 2 - panelWidth / 2;
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - panelWidth - VIEWPORT_MARGIN));

      if (top + panelHeight > window.innerHeight - VIEWPORT_MARGIN) {
        const aboveTop = rect.top - panelHeight - TRIGGER_GAP;
        if (aboveTop >= VIEWPORT_MARGIN) {
          top = aboveTop;
        } else {
          top = Math.max(VIEWPORT_MARGIN, window.innerHeight - panelHeight - VIEWPORT_MARGIN);
        }
      }

      setPanelStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${panelWidth}px`,
        visibility: 'visible',
      });
      setPositioned(true);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, PASSIVE_CAPTURE_OPTIONS);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, PASSIVE_CAPTURE_OPTIONS);
    };
  }, [open, children]);

  useEffect(() => {
    if (!open) {
      setPositioned(false);
      setPanelStyle({ visibility: 'hidden' });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: Event) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, PASSIVE_OPTIONS);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const panel = open ? (
    <div
      id={panelId}
      ref={panelRef}
      className={`help-hint-panel${positioned ? ' help-hint-panel--visible' : ''}`}
      role="tooltip"
      style={panelStyle}
    >
      {children}
    </div>
  ) : null;

  return (
    <div className="help-hint" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="help-hint-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg className="help-hint-icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7.5 7.25c0-1.25 1.1-2.25 2.5-2.25s2.5 1 2.5 2.25c0 1.1-.85 1.65-1.55 2.05-.55.3-.95.55-.95 1.2v.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="14.75" r="0.9" fill="currentColor" />
        </svg>
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  );
}
