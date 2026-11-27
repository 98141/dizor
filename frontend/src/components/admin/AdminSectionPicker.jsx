"use client";

// Compact section/tray picker for narrow screens, shared by Pedidos ("Bandeja") and Productos
// ("Sección"). It replaces a native <select>: the browser draws that option list outside the
// layout (it could overflow the card) and it cannot be styled. Options are real links, so the
// URL, browser history, reload and permissions behave exactly as with the desktop tabs.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export default function AdminSectionPicker({ label, items, className = "", navLabel }) {
  const [open, setOpen] = useState(false);
  const id = useId(), root = useRef(null), button = useRef(null);
  const current = items.find((item) => item.current) || items[0];

  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); button.current?.focus(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !root.current?.contains(document.activeElement)) return;
      const links = [...root.current.querySelectorAll(".sp__option")];
      const at = links.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
        : event.key === "ArrowDown" ? (at + 1) % links.length : (at <= 0 ? links.length - 1 : at - 1);
      event.preventDefault(); links[next]?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keydown); };
  }, [open]);

  return <div ref={root} className={`sp ${className}`} data-open={open || undefined}>
    <span id={`${id}-label`} className="sp__label">{label}</span>
    <button ref={button} type="button" id={`${id}-button`} className="sp__button" aria-expanded={open} aria-controls={`${id}-panel`}
      aria-labelledby={`${id}-label ${id}-button`} onClick={() => setOpen((value) => !value)}>
      <span className="sp__current">{current?.label}</span>
      {current?.count != null && <span className="sp__count">{current.count}</span>}
      <svg className="sp__chevron" aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m5 8 5 5 5-5" /></svg>
    </button>
    <nav id={`${id}-panel`} className="sp__panel" aria-label={navLabel || label} hidden={!open}>
      <ul className="sp__list">
        {items.map((item) => {
          const content = <>
            <span className="sp__option-label">{item.label}</span>
            {item.count != null && <span className="sp__count">{item.count}</span>}
            {item.current && <svg className="sp__check" aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>}
          </>;
          // An option is a link (navigation) or, where a screen switches sections in place, an action.
          return <li key={item.key}>{item.href
            ? <Link href={item.href} className="sp__option" aria-current={item.current ? "page" : undefined} onClick={() => setOpen(false)}>{content}</Link>
            : <button type="button" className="sp__option" aria-current={item.current ? "true" : undefined} disabled={item.disabled}
              onClick={() => { setOpen(false); button.current?.focus(); if (!item.current) item.onSelect?.(); }}>{content}</button>}</li>;
        })}
      </ul>
    </nav>
  </div>;
}
