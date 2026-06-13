import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { addDays } from "date-fns";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { DepartmentBoardData } from "@/lib/data/department-board";
import type { SalesNotepadData } from "@/lib/data/sales-notepad";
import { SUMMARY_COLORS } from "@/types/database";
import type { SupplierWithSchedule } from "@/types/database";
import { INFORMACJA_FLOW_SALES_DIRECT } from "@/lib/orders/informacja-flow-copy";

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
    canCancelBySales: extra.canCancelBySales ?? false,
    salesCancelPhase: extra.salesCancelPhase ?? null,
    maxSalesCancelQuantity: extra.maxSalesCancelQuantity ?? null,
    defaultSalesCancelQuantity: extra.defaultSalesCancelQuantity ?? null,
    canPartialSalesCancel: extra.canPartialSalesCancel ?? false,
    showSalesCancelRemainder: extra.showSalesCancelRemainder ?? false,
    salesCancelDeliveredQty: extra.salesCancelDeliveredQty ?? 0,
    salesCancelUndoRestore: extra.salesCancelUndoRestore ?? {},
    clientName: extra.clientName ?? null,
    clientKhId: extra.clientKhId ?? null,
    requestNote: extra.requestNote ?? null,
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
    clientLabel: "Gabinet Dr Kowalski",
    requestNote: null,
    supplierId: "demo-supplier-a",
    salesPersonId: DEMO_SALES_PERSON_ID,
    requestKind: "zamowienie",
    canEditBySales: false,
    headline: "Zamówione u dostawcy",
    headlineTone: "info",
    subline: "Gabinet Dr Kowalski · 2 szt.",
    ...overrides,
  };
}

export function buildOnboardingMojePresented() {
  const pickupReady = demoOrderRow({
    id: "demo-pickup",
    supplierName: "Straumann",
    product: "Implant BLX",
    symbol: "STM-BLX",
    lineCount: 1,
    lines: [
      demoLine("demo-l1", "Implant BLX", {
        symbol: "STM-BLX",
        quantity: "2",
        quantityLabel: "2 szt.",
        clientName: "Gabinet Dr Kowalski",
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
    subline: "Gabinet Dr Kowalski · 2 szt.",
    clientLabel: "Gabinet Dr Kowalski",
    canCancelBySales: false,
  });

  const inProgress = demoOrderRow({
    id: "demo-progress",
    supplierName: "Dentsply",
    product: "Końcówka polerska",
    symbol: "DEN-POL",
    quantityLabel: "1 szt.",
    statusTitle: "Zamówione u dostawcy",
    statusDetail: "Zakupy potwierdziły — czekamy na dostawę.",
    timingLabel: "Szac. dostawa za ok. 5 dni",
    badgeVariant: "info",
    clientLabel: "Klinika Smile",
    supplierId: "demo-supplier-b",
    lines: [
      demoLine("demo-l3", "Końcówka polerska", {
        symbol: "DEN-POL",
        quantity: "1",
        quantityLabel: "1 szt.",
        clientName: "Klinika Smile",
      }),
    ],
    headline: "Zamówione u dostawcy",
    headlineTone: "info",
    subline: "Klinika Smile · 1 szt.",
  });

  const informacja = demoOrderRow({
    id: "demo-info",
    kind: "informacja",
    supplierName: "Magazyn",
    product: "Cement Ivoclar Speed",
    symbol: "IVO-CEM",
    quantityLabel: "3 szt.",
    statusTitle: INFORMACJA_FLOW_SALES_DIRECT.statusTitle,
    statusDetail: INFORMACJA_FLOW_SALES_DIRECT.statusDetail,
    timingLabel: null,
    badgeVariant: "purple",
    rowColor: SUMMARY_COLORS.informacja,
    requestKind: "informacja",
    clientLabel: "Gabinet Dr Kowalski",
    supplierId: null,
    lines: [
      demoLine("demo-l4", "Cement Ivoclar Speed", {
        symbol: "IVO-CEM",
        quantity: "3",
        quantityLabel: "3 szt.",
        clientName: "Gabinet Dr Kowalski",
        stockStatus: "waiting",
      }),
    ],
    headline: INFORMACJA_FLOW_SALES_DIRECT.statusTitle,
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
    supplierName: "Straumann",
    product: "Healing cap",
    symbol: "STM-HC",
    quantityLabel: "4 szt.",
    clientLabel: "Klinika Smile",
    supplierId: "demo-supplier-a",
    submittedLabel: formatDateString(addDays(todayInWarsaw(), -10)),
    statusTitle: "Odebrane z magazynu",
    statusDetail: `Potwierdzono ${acknowledgedLabel}`,
    headline: "Odebrane z magazynu",
    headlineTone: "neutral",
    subline: `Potwierdzono ${acknowledgedLabel}`,
    lines: [
      demoLine("demo-archive-l1", "Healing cap", {
        symbol: "STM-HC",
        quantity: "4",
        quantityLabel: "4 szt.",
        clientName: "Klinika Smile",
        stockStatus: "on_stock",
      }),
    ],
  });

  const informacjaDone = demoArchivedRow({
    id: "demo-archive-info",
    kind: "informacja",
    requestKind: "informacja",
    supplierName: "Magazyn",
    product: "Cement Ivoclar Speed",
    symbol: "IVO-CEM",
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
      demoLine("demo-archive-l2", "Cement Ivoclar Speed", {
        symbol: "IVO-CEM",
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
      symbol: "STM-BLX",
      mikranCode: "4521",
      product: "Implant Straumann BLX",
      quantity: "2",
      clientName: "Klinika Smile",
    },
    {
      id: "onboarding-line-2",
      supplierId: "",
      salesPersonId,
      symbol: "IVO-CEM",
      mikranCode: "8834",
      product: "Cement Ivoclar Speed",
      quantity: "3",
      clientName: "Gabinet Dr Kowalski",
    },
  ];
}

const DEMO_SUPPLIERS: SupplierWithSchedule[] = [
  {
    id: "demo-supplier-a",
    name: "Straumann",
    location: "IMPORT",
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
    name: "Dentsply",
    location: "POLSKA",
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

export function buildOnboardingTablicaDemo(): DepartmentBoardData {
  const now = new Date().toISOString();
  const announcementId = "demo-board-announcement";
  const answeredQuestionId = "demo-board-question-answered";
  const openQuestionId = "demo-board-question-open";

  return {
    announcements: [
      {
        id: announcementId,
        kind: "announcement",
        status: "open",
        created_by: "demo-procurement",
        sales_person_id: null,
        title: "Zamówienia importowe — podaj kod Mikran",
        body: "Przy zamówieniach importowych wpisz kod Mikran w prośbie. Bez kodu zakupy nie przyjmą zgłoszenia.",
        color: "default",
        pinned: true,
        published_at: now,
        expires_at: null,
        answered_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        author: { email: "zakupy@firma.pl", role: "zakupy" },
      },
    ],
    questions: [
      {
        id: answeredQuestionId,
        kind: "question",
        status: "answered",
        created_by: "demo-sales-peer",
        sales_person_id: DEMO_SALES_PERSON_ID,
        title: "Próbki implantów poza harmonogramem?",
        body: "Klient pyta o pilne próbki przed wizytą w przyszłym tygodniu.",
        color: "default",
        pinned: false,
        published_at: now,
        expires_at: null,
        answered_at: now,
        archived_at: null,
        created_at: now,
        updated_at: now,
        author: { email: "anna@firma.pl", role: "sales" },
        sales_person: { id: DEMO_SALES_PERSON_ID, name: "Anna K." },
        posts: [
          {
            id: "demo-board-post-1",
            thread_id: answeredQuestionId,
            created_by: "demo-procurement",
            body: "Tak — złóż normalną prośbę z adnotacją „próbki”. Zakupy potwierdzą dostępność u dostawcy.",
            created_at: now,
            author: { email: "zakupy@firma.pl", role: "zakupy" },
          },
        ],
      },
      {
        id: openQuestionId,
        kind: "question",
        status: "open",
        created_by: "demo-sales-peer-2",
        sales_person_id: "demo-sales-peer-2",
        title: "Jaki termin realizacji u Straumann?",
        body: "Klient czeka na potwierdzenie daty dostawy implantów.",
        color: "default",
        pinned: false,
        published_at: now,
        expires_at: null,
        answered_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        author: { email: "piotr@firma.pl", role: "sales" },
        sales_person: { id: "demo-sales-peer-2", name: "Piotr M." },
        posts: [],
      },
    ],
    readAnnouncementIds: [],
  };
}

export const ONBOARDING_TABLICA_UNSEEN_QUESTION_IDS = ["demo-board-question-answered"] as const;

/** Uwaga tablicy w tourze — banner nowej odpowiedzi. */
export function buildOnboardingBoardAttention() {
  return {
    unseenAnswerCount: 1,
    unseenAnswerPreview: {
      threadId: "demo-board-question-answered",
      title: "Próbki implantów poza harmonogramem?",
      isOwnQuestion: false,
    },
    unreadAnnouncementBannerCount: 0,
    unreadAnnouncementBannerLatestTitle: null as string | null,
  };
}

/** Kontekst panelu Start dnia w tourze onboardingowym /moje. */
export function buildOnboardingDayStartContext(salesPersonId: string) {
  const notepad = buildOnboardingNotepadDemo(salesPersonId);
  const now = new Date().toISOString();
  return {
    watches: notepad.zkWatches,
    notes: notepad.notes,
    boardAttention: {
      unreadAnnouncementCount: 0,
      unreadAnnouncementLatestTitle: null,
      unreadAnnouncementBannerCount: 0,
      unreadAnnouncementBannerLatestTitle: null,
      unreadAnnouncementBannerLatestId: null,
      unseenAnswerCount: 1,
      unseenAnswerPreview: {
        threadId: "demo-board-question-answered",
        title: "Próbki implantów poza harmonogramem?",
        isOwnQuestion: false,
      },
      unseenQuestionIds: ["demo-board-question-answered"],
      pinnedAnnouncements: [
        {
          id: "demo-board-announcement-pinned",
          kind: "announcement",
          title: "Harmonogram dostaw Straumann",
          body: "Zamówienia u Straumann wysyłamy we wtorki i czwartki.",
          pinned: true,
          status: "open",
          created_by: "demo-procurement",
          created_at: now,
          updated_at: now,
          archived_at: null,
          expires_at: null,
          answered_at: null,
        } as never,
      ],
      navBadgeCount: 1,
    },
    previewDla: null,
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
        client_label: "Gabinet Dr Kowalski",
        client_kh_id: 8802,
        amount_net: 2840,
        amount_gross: 3493.2,
        zk_issued_at: issuedOlder,
        closed_at: null,
        note: "Klient pytał o termin implantów — oddzwonić w piątek.",
        line_summary: "Implant BLX · abutment · 2 poz.",
        line_checks: [{ key: "ob:1", arrived: true }],
        subiekt_snapshot: demoZkSnapshot(
          {
            khId: 8802,
            name: "Dr Kowalski",
            email: "biuro@drkowalski.pl",
            phone: "601 555 218",
          },
          [
            { name: "Implant Straumann BLX", symbol: "STM-BLX", qty: 1 },
            { name: "Abutment", symbol: "STM-ABT", qty: 1 },
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
        note: "Można zgłosić prośbę do zakupów.",
        line_summary: "Końcówka polerska · 2 szt.",
        line_checks: [],
        subiekt_snapshot: demoZkSnapshot(
          {
            khId: 8801,
            name: "Klinika Smile",
            email: "zakupy@klinikasmile.pl",
            phone: "512 400 772",
          },
          [{ name: "Końcówka polerska", symbol: "DEN-POL", qty: 2 }]
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
        title: "Oddzwonić do Gabinetu Dr Kowalski",
        body: "Potwierdzić termin dostawy implantów — klient pytał wczoraj.",
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
        body: "Przygotować ofertę na implanty Straumann na czerwiec.",
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
    zkLinkableOrders: [
      {
        id: "demo-link-open",
        sales_person_id: salesPersonId,
        sales_client_name: "Klinika Smile",
        sales_client_kh_id: 8801,
        source_zk_watch_id: "demo-watch-active",
        source_zk_number: "ZK/2026/0142",
        subiekt_tw_id: 91001,
        symbol: "DEN-POL",
        products: "Końcówka polerska",
        mikran_code: null,
        quantity: "2",
        delivered_quantity: "0",
        status: "Zamowione",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
      },
      {
        id: "demo-link-delivered",
        sales_person_id: salesPersonId,
        sales_client_name: "Gabinet Dr Kowalski",
        sales_client_kh_id: 8802,
        source_zk_watch_id: "demo-watch-follow-up",
        source_zk_number: "ZK/2026/0138",
        subiekt_tw_id: 91002,
        symbol: "STM-BLX",
        products: "Implant Straumann BLX",
        mikran_code: null,
        quantity: "1",
        delivered_quantity: "1",
        status: "Zrealizowane",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
      },
    ],
  };
}
