import { useId, useState, type ReactNode } from 'react';

type AccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="hm-acc">
      <button
        type="button"
        id={buttonId}
        className="hm-acc-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="hm-acc-panel"
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}
