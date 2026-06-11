"use client";

import { useMemo } from "react";
import { splitTextBySearchHighlight } from "@/lib/orders/my-order-search-highlight";
import { searchQueryTokens } from "@/lib/orders/my-order-search";

const markClass =
  "rounded-sm bg-amber-200/90 px-0.5 text-inherit [box-decoration-break:clone]";

export function SearchHighlightText({
  text,
  searchQuery,
  className,
  as: Tag = "span",
}: {
  text: string;
  searchQuery?: string | null;
  className?: string;
  as?: "span" | "p" | "dd";
}) {
  const segments = useMemo(
    () => splitTextBySearchHighlight(text, searchQuery),
    [text, searchQuery]
  );
  const active = searchQueryTokens(searchQuery).length > 0;

  if (!active || (segments.length === 1 && !segments[0]?.match)) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={className}>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className={markClass}>
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </Tag>
  );
}

/** Kilka pól łączonych separatorem — każde podświetlane osobno. */
export function SearchHighlightJoined({
  parts,
  separator = " · ",
  searchQuery,
  className,
}: {
  parts: Array<string | null | undefined>;
  separator?: string;
  searchQuery?: string | null;
  className?: string;
}) {
  const items = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  if (!items.length) return null;

  const active = searchQueryTokens(searchQuery).length > 0;
  if (!active) {
    return <span className={className}>{items.join(separator)}</span>;
  }

  return (
    <span className={className}>
      {items.map((part, i) => (
        <span key={`${i}-${part}`}>
          {i > 0 ? separator : null}
          <SearchHighlightText text={part} searchQuery={searchQuery} />
        </span>
      ))}
    </span>
  );
}
