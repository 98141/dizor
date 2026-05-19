"use client";

import { useEffect, useState } from "react";

const MIN_CHARS = 1;
const DEBOUNCE_MS = 300;

export default function CatalogSearch({ value = "", onSearch }) {
  const [input, setInput] = useState(value);

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    const trimmed = input.trim();

    if (trimmed.length < MIN_CHARS) {
      if (!value) return undefined;
      const clearTimer = setTimeout(() => onSearch(""), DEBOUNCE_MS);
      return () => clearTimeout(clearTimer);
    }

    if (trimmed === value) return undefined;

    const timer = setTimeout(() => onSearch(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, value, onSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length >= MIN_CHARS) onSearch(trimmed);
    else onSearch("");
  };

  return (
    <form className="catalog-search" onSubmit={handleSubmit}>
      <input
        type="search"
        className="catalog-search__input auth-field__input"
        placeholder="Buscar por nombre..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="Buscar productos por nombre"
        autoComplete="off"
      />
      {input && (
        <button
          type="button"
          className="catalog-search__clear"
          onClick={() => setInput("")}
          aria-label="Borrar búsqueda"
        >
          ×
        </button>
      )}
    </form>
  );
}
