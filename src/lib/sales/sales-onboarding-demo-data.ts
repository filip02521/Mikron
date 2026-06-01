import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { addDays } from "date-fns";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { SalesNotepadData } from "@/lib/data/sales-notepad";
import { SUMMARY_COLORS } from "@/types/database";
import type { SupplierWithSchedule } from "@/types/database";

const DEMO_SALES_PERSON_ID = "onboarding-demo";

function demoIsoDate(dayOffset: number): string {
  return formatDateString(addDays(todayInWarsaw(), dayOffset));
}

function demoZkSnapshot(
  client: {
    khId: number;
    email: string;
    phone: string;
    name: string;
  },
  lines: Array<{ name: string; symbol?: string; qty?: number }> = []
) {
  return {
    dok_Status: 7,
    dok_Pozycja: lines.map((line, index) => ({
      ob_Id: index + 1,
      tw_Nazwa: line.name,
      tw_Symbol: line.symbol ?? null,
      ob_Ilosc: line.qty ?? 1,
    })),
    kh__Kontrahent_Odbiorca: {
      kh_Id: client.khId,
      kh_Symbol: client.name,
      kh_EMail: client.email,
      adr_Telefon: client.phone,
    },
  };
}

function demoLine(
  id: string,
  product: string,
  extra: Partial<MyOrderRow["lines"][number]> = {}
): MyOrderRow["lines"][number] {
  return {
    id,
    product,
    symbol: extra.symbol ?? null,
    subiektTwId: null,
    mikranCode: extra.mikranCode ?? null,
    quantity: extra.quantity ?? "1",
    quantityLabel: extra.quantityLabel ?? "1 szt.",
    progressLabel: extra.progressLabel ?? null,
    stockStatus: extra.stockStatus ?? "waiting",
    canAcknowledgePickup: extra.canAcknowledgePickup ?? false,
    clientName: extra.clientName ?? null,
  };
}

function demoOrderRow(overrides: Partial<MyOrderRow>): MyOrderRow {
  return {
    id: "demo-row",
    kind: "zamowienie",
    lineCount: 1,
    lines: [demoLine("demo-line", "Przykładowy produkt")],
    submittedLabel: "12.05.2026",
    supplierName: "Przykładowy dostawca",
    product: "Przykładowy produkt",
    symbol: "SYM-001",
    quantityLabel: "2 szt.",
    progressLabel: null,
    statusTitle: "Zamówione u dostawcy",
    statusDetail: "Zakupy potwierdziły zamówienie — czekamy na dostawę.",
    timingLabel: "Szac. dostawa za ok. 5 dni",
    badgeVariant: "info",
    rowColor: SUMMARY_COLORS.historyMain,
    orderIds: ["demo-order-1"],
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    canCancelBySales: true,
    salesCancelPhase: null,
    salesCancelOrderIds: [],
    cancelNoticeOrderIds: [],
    cancelledAckOrderIds: [],
    clientLabel: "Klinika Smile",
    supplierId: "demo-supplier-a",
    salesPersonId: DEMO_SALES_PERSON_ID,
    requestKind: "zamowienie",
    canEditBySales: false,
    headline: "Zamówione u dostawcy",
    headlineTone: "info",
    subline: "Klinika Smile · 2 szt.",
    ...overrides,
  };
}

export function buildOnboardingMojePresented() {
  const pickupReady = demoOrderRow({
    id: "demo-pickup",
    supplierName: "Dental Supply PL",
    product: "Filtr powietrza XYZ",
    symbol: "FIL-100",
    lineCount: 1,
    lines: [
      demoLine("demo-l1", "Filtr powietrza XYZ", {
        symbol: "FIL-100",
        quantity: "2",
        quantityLabel: "2 szt.",
        clientName: "Klinika Smile",
        stockStatus: "on_stock",
        canAcknowledgePickup: true,
      }),
    ],
    quantityLabel: "2 szt.",
    statusTitle: "Gotowe do odbioru",
    statusDetail: "Towar na magazynie — potwierdź odbiór, gdy przekażesz klientowi.",
    timingLabel: null,
    badgeVariant: "success",
    rowColor: SUMMARY_COLORS.forSomeone,
    acknowledgeMode: "pickup",
    pickupPendingCount: 1,
    pickupPendingIds: ["demo-l1"],
    pickupReadyTotal: 1,
    pickupAcknowledgedCount: 0,
    headline: "Odbierz towar z magazynu",
    headlineTone: "action",
    subline: "Po potwierdzeniu wpis zniknie z listy",
    canCancelBySales: false,
  });

  const inProgress = demoOrderRow({
    id: "demo-progress",
    supplierName: "Import Medica",
    product: "Skaler ultradźwiękowy UDS",
    symbol: "UDS-400",
    quantityLabel: "1 szt.",
    statusTitle: "Zamówione u dostawcy",
    statusDetail: "Zakupy potwierdziły — czekamy na dostawę od importu.",
    timingLabel: "Szac. dostawa za ok. 12 dni",
    badgeVariant: "info",
    clientLabel: "Serwis AutoMax",
    supplierId: "demo-supplier-b",
    lines: [
      demoLine("demo-l3", "Skaler ultradźwiękowy UDS", {
        symbol: "UDS-400",
        quantity: "1",
        quantityLabel: "1 szt.",
        clientName: "Serwis AutoMax",
      }),
    ],
    headline: "Zamówione u dostawcy",
    headlineTone: "info",
    subline: "Serwis AutoMax · 1 szt.",
  });

  const informacja = demoOrderRow({
    id: "demo-info",
    kind: "informacja",
    supplierName: "Magazyn Mikran",
    product: "Końcówka silikonowa 2 mm",
    symbol: "KS-2",
    quantityLabel: "3 szt.",
    statusTitle: "Czekamy na magazyn",
    statusDetail: "Powiadomimy e-mailem, gdy towar będzie dostępny.",
    timingLabel: null,
    badgeVariant: "purple",
    rowColor: SUMMARY_COLORS.informacja,
    requestKind: "informacja",
    clientLabel: "Gabinet Dr Kowalski",
    supplierId: null,
    lines: [
      demoLine("demo-l4", "Końcówka silikonowa 2 mm", {
        symbol: "KS-2",
        quantity: "3",
        quantityLabel: "3 szt.",
        clientName: "Gabinet Dr Kowalski",
        stockStatus: "waiting",
      }),
    ],
    headline: "Prośba o dostępność",
    headlineTone: "info",
    subline: "Gabinet Dr Kowalski · 3 szt.",
    canCancelBySales: true,
  });

  return {
    zamowienia: [pickupReady, inProgress],
    informacje: [informacja],
    productLineCount: 3,
  };
}

function demoArchivedRow(overrides: Partial<MyOrderRow>): MyOrderRow {
  return demoOrderRow({
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    canCancelBySales: false,
    canEditBySales: false,
    badgeVariant: "default",
    rowColor: SUMMARY_COLORS.historyMain,
    timingLabel: null,
    progressLabel: null,
    sortPriority: 100,
    ...overrides,
  });
}

export function buildOnboardingMojeArchiveDemo(): {
  archiwumRecent: MyOrderRow[];
  archiwumExtended: MyOrderRow[];
} {
  const acknowledgedLabel = formatDateString(addDays(todayInWarsaw(), -2));

  const pickupDone = demoArchivedRow({
    id: "demo-archive-pickup",
    supplierName: "Dental Supply PL",
    product: "Uszczelka do kompresora",
    symbol: "USZ-40",
    quantityLabel: "4 szt.",
    clientLabel: "Serwis AutoMax",
    supplierId: "demo-supplier-a",
    submittedLabel: formatDateString(addDays(todayInWarsaw(), -10)),
    statusTitle: "Odebrane z magazynu",
    statusDetail: `Potwierdzono ${acknowledgedLabel}`,
    headline: "Odebrane z magazynu",
    headlineTone: "neutral",
    subline: `Potwierdzono ${acknowledgedLabel}`,
    lines: [
      demoLine("demo-archive-l1", "Uszczelka do kompresora", {
        symbol: "USZ-40",
        quantity: "4",
        quantityLabel: "4 szt.",
        clientName: "Serwis AutoMax",
        stockStatus: "on_stock",
      }),
    ],
  });

  const informacjaDone = demoArchivedRow({
    id: "demo-archive-info",
    kind: "informacja",
    requestKind: "informacja",
    supplierName: "Magazyn Mikran",
    product: "Pasta polerska",
    symbol: "PP-01",
    quantityLabel: "2 szt.",
    clientLabel: "Gabinet Dr Kowalski",
    supplierId: null,
    rowColor: SUMMARY_COLORS.informacja,
    submittedLabel: formatDateString(addDays(todayInWarsaw(), -5)),
    statusTitle: "Powiadomienie potwierdzone",
    statusDetail: `Potwierdzono ${acknowledgedLabel}`,
    headline: "Powiadomienie potwierdzone",
    headlineTone: "neutral",
    subline: `Potwierdzono ${acknowledgedLabel}`,
    lines: [
      demoLine("demo-archive-l2", "Pasta polerska", {
        symbol: "PP-01",
        quantity: "2",
        quantityLabel: "2 szt.",
        clientName: "Gabinet Dr Kowalski",
      }),
    ],
  });

  const archiwumRecent = [pickupDone, informacjaDone];
  return {
    archiwumRecent,
    archiwumExtended: archiwumRecent,
  };
}

export type OnboardingProsbaLine = {
  id: string;
  supplierId: string;
  salesPersonId: string;
  symbol: string;
  mikranCode: string;
  product: string;
  quantity: string;
  clientName?: string;
  subiektTwId?: number | null;
};

export function buildOnboardingProsbaLines(salesPersonId: string): OnboardingProsbaLine[] {
  return [
    {
      id: "onboarding-line-1",
      supplierId: "",
      salesPersonId,
      symbol: "FIL-100",
      mikranCode: "4521",
      product: "Filtr powietrza XYZ",
      quantity: "2",
      clientName: "Klinika Smile",
    },
    {
      id: "onboarding-line-2",
      supplierId: "",
      salesPersonId,
      symbol: "",
      mikranCode: "",
      product: "Uszczelka gumowa 40 mm",
      quantity: "5",
      clientName: "Serwis AutoMax",
    },
  ];
}

const DEMO_SUPPLIERS: SupplierWithSchedule[] = [
  {
    id: "demo-supplier-a",
    name: "Dental Supply PL",
    location: "POLSKA",
    pickup_mikran: true,
    pickup_pallet: false,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: "co 2 tygodnie",
    interval_weeks: 2,
    stock_raw: null,
    stock: null,
    stats_mode: "LACZNIE",
    order_on_demand: false,
    is_active: true,
    subiekt_kh_id: null,
    schedule: {
      id: "demo-sched-a",
      supplier_id: "demo-supplier-a",
      order_date: demoIsoDate(5),
      shift_date: null,
      computed_next_date: demoIsoDate(5),
      vacation_note: null,
    },
  },
  {
    id: "demo-supplier-b",
    name: "Import Medica",
    location: "IMPORT",
    pickup_mikran: false,
    pickup_pallet: true,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: "co 4 tygodnie",
    interval_weeks: 4,
    stock_raw: null,
    stock: null,
    stats_mode: "LACZNIE",
    order_on_demand: false,
    is_active: true,
    subiekt_kh_id: null,
    schedule: {
      id: "demo-sched-b",
      supplier_id: "demo-supplier-b",
      order_date: demoIsoDate(12),
      shift_date: null,
      computed_next_date: demoIsoDate(12),
      vacation_note: null,
    },
  },
];

export function buildOnboardingPlanDemo() {
  const suppliers = DEMO_SUPPLIERS;
  const workspace = buildSummaryWorkspace(suppliers, []);
  return {
    suppliers,
    workspace,
    prioritySupplierIds: ["demo-supplier-a", "demo-supplier-b"],
    openOrderCountBySupplier: {
      "demo-supplier-a": 2,
      "demo-supplier-b": 1,
    },
    statsBySupplierId: {
      "demo-supplier-a": {
        supplier_id: "demo-supplier-a",
        main_sum: 14,
        main_count: 5,
        main_avg: 2.8,
        side_sum: null,
        side_count: null,
        side_avg: null,
      },
      "demo-supplier-b": {
        supplier_id: "demo-supplier-b",
        main_sum: 21,
        main_count: 3,
        main_avg: 7,
        side_sum: null,
        side_count: null,
        side_avg: null,
      },
    },
  };
}

export function buildOnboardingNotepadDemo(salesPersonId: string): SalesNotepadData {
  const now = new Date().toISOString();
  const today = demoIsoDate(0);
  const issuedRecent = demoIsoDate(-8);
  const issuedOlder = demoIsoDate(-14);

  return {
    zkWatches: [
      {
        id: "demo-watch-follow-up",
        sales_person_id: salesPersonId,
        subiekt_dok_id: 9002,
        zk_number: "ZK/2026/0138",
        client_label: "Gabinet stomatologiczny Dr Kowalski",
        client_kh_id: 8802,
        amount_net: 2840,
        amount_gross: 3493.2,
        zk_issued_at: issuedOlder,
        closed_at: null,
        note: "Klient pytał o termin dostawy skalera — oddzwonić w piątek.",
        line_summary: "Skaler UDS · końcówki · 4 poz.",
        line_checks: [{ key: "ob:1", arrived: true }],
        subiekt_snapshot: demoZkSnapshot(
          {
            khId: 8802,
            name: "Dr Kowalski",
            email: "biuro@drkowalski.pl",
            phone: "601 555 218",
          },
          [
            { name: "Skaler ultradźwiękowy UDS", symbol: "UDS-01", qty: 1 },
            { name: "Końcówki skalerowe", symbol: "KON-UDS", qty: 3 },
          ]
        ),
        follow_up_at: today,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "demo-watch-active",
        sales_person_id: salesPersonId,
        subiekt_dok_id: 9001,
        zk_number: "ZK/2026/0142",
        client_label: "Klinika Smile",
        client_kh_id: 8801,
        amount_net: 1250,
        amount_gross: 1537.5,
        zk_issued_at: issuedRecent,
        closed_at: null,
        note: "Towar do potwierdzenia u dostawcy — można zgłosić prośbę.",
        line_summary: "Filtr powietrza XYZ · 2 szt.",
        line_checks: [],
        subiekt_snapshot: demoZkSnapshot(
          {
            khId: 8801,
            name: "Klinika Smile",
            email: "zakupy@klinikasmile.pl",
            phone: "512 400 772",
          },
          [{ name: "Filtr powietrza XYZ", symbol: "FP-100", qty: 2 }]
        ),
        follow_up_at: demoIsoDate(2),
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    archivedZkWatches: [],
    notes: [
      {
        id: "demo-note-1",
        sales_person_id: salesPersonId,
        title: "Oddzwonić do AutoMax",
        body: "Potwierdzić termin dostawy skalera — klient pytał wczoraj.",
        color: "yellow",
        pinned: true,
        sort_order: 0,
        archived_at: null,
        follow_up_at: demoIsoDate(-1),
        created_at: now,
        updated_at: now,
      },
      {
        id: "demo-note-2",
        sales_person_id: salesPersonId,
        title: null,
        body: "Przygotować ofertę na filtry na czerwiec.",
        color: "default",
        pinned: false,
        sort_order: 1,
        archived_at: null,
        follow_up_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    archivedNotes: [],
  };
}
