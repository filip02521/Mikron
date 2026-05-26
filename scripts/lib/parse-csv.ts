/** Parser CSV — obsługa pól w cudzysłowie i wielu linii (eksport Google Sheets). */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row.map((c) => c.trim()));
    }
    row = [];
  };

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n" || (c === "\r" && content[i + 1] === "\n")) {
      if (c === "\r") i++;
      pushField();
      pushRow();
    } else if (c !== "\r") {
      field += c;
    }
  }

  pushField();
  pushRow();
  return rows;
}

export function headerIndex(headers: string[], ...names: string[]): number {
  const upper = headers.map((h) => h.toUpperCase().trim());
  for (const n of names) {
    const i = upper.indexOf(n.toUpperCase());
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = upper.findIndex((h) => h.includes(n.toUpperCase()));
    if (i >= 0) return i;
  }
  return -1;
}
