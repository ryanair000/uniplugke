"use client";

import { useMemo, useState } from "react";

type HelpItem = {
  question: string;
  answer: string;
};

export function HelpFaq({ items }: { items: HelpItem[] }) {
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.question} ${item.answer}`.toLowerCase().includes(normalized)
    );
  }, [items, query]);

  return (
    <section className="help-faq-upgrade" aria-labelledby="help-faq-title">
      <div className="help-faq-heading">
        <div>
          <p className="upgrade-eyebrow">Common questions</p>
          <h2 id="help-faq-title">Find the answer without waiting.</h2>
        </div>
        <label>
          <span>Search help topics</span>
          <input
            type="search"
            placeholder="Try activation, renewal, order…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <p className="help-result-count" aria-live="polite">
        {visibleItems.length} answer{visibleItems.length === 1 ? "" : "s"}
      </p>

      {visibleItems.length ? (
        <div className="upgrade-faq-list">
          {visibleItems.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      ) : (
        <div className="catalog-empty">
          <h3>No matching answer</h3>
          <p>Try a shorter search, or create a support ticket above.</p>
          <button className="button button-light" type="button" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}
