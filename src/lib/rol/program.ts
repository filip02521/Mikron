/** Walidacja ustawień klienta ROL (okno „Ustawienia ROL”) — granica zaufania dla akcji serwera. */

export type RolProgramInput = {
  id?: string | null;
  label: string;
  fileLabel: string;
  khIds: string;
  discountPct: string;
  addressLines: string;
  nip: string;
  toEmails: string;
  ccEmails: string;
  activeFrom: string;
  activeTo: string;
};

export type RolProgramValues = {
  id: string | null;
  label: string;
  fileLabel: string;
  khIds: number[];
  discountPct: number;
  addressLines: string[];
  nip: string;
  toEmails: string[];
  ccEmails: string[];
  activeFrom: string;
  activeTo: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const splitList = (s: string) =>
  s
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

function parseEmails(raw: string, field: string): string[] | string {
  const list = [...new Set(splitList(raw).map((e) => e.toLowerCase()))];
  const bad = list.find((e) => !EMAIL_RE.test(e));
  return bad ? `${field}: „${bad}” nie wygląda na adres e-mail.` : list;
}

export function parseRolProgramInput(input: RolProgramInput): { ok: true; value: RolProgramValues } | { ok: false; error: string } {
  const id = input.id?.trim() || null;
  if (id && !UUID_RE.test(id)) return { ok: false, error: "Nieprawidłowy identyfikator klienta ROL." };
  const label = input.label.trim();
  if (!label || label.length > 120) return { ok: false, error: "Podaj nazwę klienta (do 120 znaków), np. „Przykładowa”." };
  const fileLabel = input.fileLabel.trim() || label;
  if (fileLabel.length > 80 || /[\\/:*?"<>|]/.test(fileLabel)) {
    return { ok: false, error: "Nazwa w plikach może mieć do 80 znaków, bez znaków \\ / : * ? \" < > |." };
  }
  const khRaw = splitList(input.khIds);
  const khIds = [...new Set(khRaw.map((x) => Number(x)))];
  if (!khRaw.length || khIds.some((n) => !Number.isInteger(n) || n <= 0)) {
    return { ok: false, error: "Podaj numer kartoteki klienta w Subiekcie (kh_Id), kilka oddziel przecinkiem." };
  }
  const discountPct = Number(input.discountPct.replace(",", "."));
  if (!(discountPct > 0 && discountPct < 100)) return { ok: false, error: "Rabat musi być liczbą między 0 a 100 (np. 25)." };
  const to = parseEmails(input.toEmails, "Do");
  if (typeof to === "string") return { ok: false, error: to };
  const cc = parseEmails(input.ccEmails, "DW");
  if (typeof cc === "string") return { ok: false, error: cc };
  const activeFrom = input.activeFrom.trim();
  if (!DATE_RE.test(activeFrom)) return { ok: false, error: "Podaj datę, od której klient ma status ROL." };
  const activeTo = input.activeTo.trim() || null;
  if (activeTo && (!DATE_RE.test(activeTo) || activeTo < activeFrom)) {
    return { ok: false, error: "Data końca statusu ROL musi być po dacie początku." };
  }
  return {
    ok: true,
    value: {
      id,
      label,
      fileLabel,
      khIds,
      discountPct,
      addressLines: input.addressLines
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 4),
      nip: input.nip.trim().slice(0, 32),
      toEmails: to,
      ccEmails: cc,
      activeFrom,
      activeTo,
    },
  };
}
