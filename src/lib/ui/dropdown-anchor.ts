/** Pozycja menu fixed — otwiera w górę, gdy na dole viewportu brakuje miejsca. */
export function computeAnchoredDropdownPosition(
  anchor: DOMRect,
  menuHeight: number,
  opts?: {
    gap?: number;
    margin?: number;
    minWidth?: number;
    viewportHeight?: number;
  }
): { top: number; left: number; width: number; maxHeight: number } {
  const gap = opts?.gap ?? 4;
  const margin = opts?.margin ?? 8;
  const width = Math.max(anchor.width, opts?.minWidth ?? 168);
  const viewportHeight =
    opts?.viewportHeight ??
    (typeof window !== "undefined" ? window.innerHeight : 800);

  const spaceBelow = viewportHeight - anchor.bottom - margin;
  const spaceAbove = anchor.top - margin;
  const openBelow =
    spaceBelow >= menuHeight + gap || spaceBelow >= spaceAbove;

  let top: number;
  let maxHeight: number;
  if (openBelow) {
    top = anchor.bottom + gap;
    maxHeight = Math.max(120, spaceBelow - gap);
  } else {
    maxHeight = Math.max(120, spaceAbove - gap);
    const visibleHeight = Math.min(menuHeight, maxHeight);
    top = Math.max(margin, anchor.top - gap - visibleHeight);
  }

  const left = Math.max(margin, anchor.right - width);

  return { top, left, width, maxHeight };
}
