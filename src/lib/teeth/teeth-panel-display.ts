/** Skrócona etykieta produktu — bez powtarzania nazwy dostawcy i symbolu. */
export function compactTeethProductLabel(
  product: string,
  symbol: string | null | undefined,
  supplierName?: string | null,
): { primary: string; secondary: string | null } {
  const sym = symbol?.trim() && symbol !== "-" ? symbol.trim() : null;
  let name = product.trim();

  if (supplierName) {
    const prefix = supplierName.trim();
    if (prefix && name.toLowerCase().startsWith(prefix.toLowerCase())) {
      name = name.slice(prefix.length).replace(/^[\s\-·.,]+/, "").trim();
    }
  }

  if (!name && sym) return { primary: sym, secondary: null };
  if (!name) return { primary: product.trim() || "Produkt", secondary: null };

  if (sym) {
    const symNorm = sym.toLowerCase();
    const nameNorm = name.toLowerCase();
    const fullNorm = product.trim().toLowerCase();
    if (nameNorm === symNorm || nameNorm.includes(symNorm)) {
      return { primary: name, secondary: null };
    }
    if (fullNorm.includes(symNorm) && name.length > 0) {
      return { primary: name, secondary: null };
    }
    return { primary: name, secondary: sym };
  }

  return { primary: name, secondary: null };
}
