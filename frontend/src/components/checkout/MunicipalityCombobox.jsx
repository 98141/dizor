"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { municipalityLabel, searchMunicipalities } from "@/lib/municipalities";

export default function MunicipalityCombobox({ options, selected, initialText = "", onChange, error }) {
  const [query, setQuery] = useState(() => selected ? municipalityLabel(selected) : initialText);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const popupRef = useRef(null);
  const results = useMemo(() => searchMunicipalities(options, query), [options, query]);
  const visible = results.slice(0, 50);
  const activeId = open && visible[activeIndex] ? `municipality-option-${visible[activeIndex].id}` : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  // visualViewport también se reduce al abrir el teclado del teléfono.
  // La lista sigue debajo del campo y desplaza sus opciones internamente.
  useEffect(() => {
    if (!open) return;
    let frame;
    const update = () => {
      const input = inputRef.current;
      const popup = popupRef.current;
      if (!input || !popup) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (viewport?.height || innerHeight);
      let rect = input.getBoundingClientRect();
      let room = viewportBottom - rect.bottom - 12;
      if (room < 100) {
        const headerBottom = Math.max(viewportTop, ...[...document.querySelectorAll(".site-header, .site-header-compact")]
          .filter((element) => getComputedStyle(element).visibility !== "hidden")
          .map((element) => element.getBoundingClientRect())
          .filter((bounds) => bounds.top <= viewportTop + 1 && bounds.bottom > viewportTop)
          .map((bounds) => bounds.bottom));
        const distance = Math.min(100 - room, Math.max(0, rect.top - headerBottom - 12));
        if (distance > 0) window.scrollBy({ top: distance, behavior: "instant" });
        rect = input.getBoundingClientRect();
        room = viewportBottom - rect.bottom - 12;
      }
      popup.style.setProperty("--municipality-popup-height", `${Math.max(44, Math.min(260, room))}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open]);

  const select = (entry) => {
    setQuery(municipalityLabel(entry));
    onChange(entry);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => !visible.length ? -1 : !open || current < 0
        ? direction > 0 ? 0 : visible.length - 1
        : (current + direction + visible.length) % visible.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      event.stopPropagation();
      if (visible[activeIndex]) select(visible[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="auth-field municipality-combobox" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActiveIndex(-1); }
    }}>
      <label className="auth-field__label" htmlFor="municipality">Ciudad o municipio</label>
      <div className="municipality-combobox__control">
      <input ref={inputRef} id="municipality" name="municipality" type="text" role="combobox"
        className={`auth-field__input${error ? " auth-field__input--error" : ""}`}
        placeholder="Busca tu ciudad o municipio" autoComplete="off" required
        aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open}
        aria-controls="municipality-listbox" aria-activedescendant={activeId}
        aria-invalid={Boolean(error)} aria-describedby={error ? "municipality-error municipality-hint" : "municipality-hint"}
        value={query} onFocus={() => { setOpen(true); setActiveIndex(visible.length ? 0 : -1); }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange(null);
          setOpen(true);
          setActiveIndex(0);
        }} onKeyDown={handleKeyDown} />
      <div ref={popupRef} className="municipality-combobox__popup" hidden={!open}>
        <ul id="municipality-listbox" role="listbox" aria-label="Ciudades y municipios de Colombia" className="municipality-combobox__list">
          {visible.map((entry, index) => (
            <li id={`municipality-option-${entry.id}`} key={entry.id} role="option"
              aria-selected={selected?.id === entry.id}
              className={`municipality-combobox__option${index === activeIndex ? " municipality-combobox__option--active" : ""}`}
              onMouseDown={(event) => event.preventDefault()} onClick={() => select(entry)}>
              {municipalityLabel(entry)}
            </li>
          ))}
        </ul>
      </div>
      </div>
      <p role="status" aria-live="polite" className={open && !results.length ? "municipality-combobox__empty" : "sr-only"}>
        {open ? results.length ? `${results.length} resultados. ${results.length > visible.length ? `Se muestran ${visible.length}; sigue escribiendo para acotar. ` : ""}Usa las flechas y Enter para elegir.` : "No se encontraron ciudades o municipios." : ""}
      </p>
      <span id="municipality-hint" className="auth-field__hint">{initialText && !selected ? "Selecciona el municipio de esta dirección para continuar." : "Elige una opción de la lista; incluye su departamento."}</span>
      {error && <span id="municipality-error" className="auth-field__error">{error}</span>}
    </div>
  );
}
