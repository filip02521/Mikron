"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  actionDeleteZdEstimatePackaging,
  actionDeleteZdEstimatePackagingBulk,
  actionExcludeZdEstimateProduct,
  actionExcludeZdEstimateProducts,
  actionListZdEstimateExclusions,
  actionListZdEstimatePackaging,
  actionRestoreZdEstimateProduct,
  actionRestoreZdEstimateProducts,
  actionRunZdEstimateManual,
  actionSearchZdEstimateGroups,
  actionUpsertZdEstimatePackaging,
  actionUpsertZdEstimatePackagingBulk,
  type ZdEstimateGroupOption,
  type ZdEstimateSupplierOption,
} from "@/app/actions/zd-estimate";
import type { ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import { applyGroupStockWindow } from "@/lib/orders/zd-estimate-group-stock";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  DEFAULT_DNI_ZAPASU,
  formatQty,
  salesWindowFromDniZapasu,
} from "@/lib/orders/zd-estimate-manual";
import {
  ZD_ESTIMATE_BULK_MAX,
} from "@/lib/orders/zd-estimate-bulk";
import {
  filterOrderableLinesWithPackaging,
  formatZdPackHint,
  orderableLinesToTsv,
  packagingByTwId,
  resolveOrderQtyForLine,
  summarizePackOrderQty,
  type PackagingLookup,
} from "@/lib/orders/zd-estimate-packaging";
import { ZdEstimateBulkBar } from "@/components/zakupy/ZdEstimateBulkBar";
import { ZdEstimateBulkExcludeDialog } from "@/components/zakupy/ZdEstimateBulkExcludeDialog";
import { ZdEstimateBulkPackagingDialog } from "@/components/zakupy/ZdEstimateBulkPackagingDialog";
import { ZdEstimateExcludeDialog } from "@/components/zakupy/ZdEstimateExcludeDialog";
import { ZdEstimateExclusionsModal } from "@/components/zakupy/ZdEstimateExclusionsModal";
import { ZdEstimatePackagingDialog } from "@/components/zakupy/ZdEstimatePackagingDialog";
import { ZdEstimatePackagingModal } from "@/components/zakupy/ZdEstimatePackagingModal";
import { ZdEstimateRowActions } from "@/components/zakupy/ZdEstimateRowActions";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconChevronDown,
  IconClipboardList,
  IconPackage,
  IconSearch,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  checkboxBrandClass,
  panelTypography,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";

/** Luźniejszy inset niż standard panelu dziennego — tabela potrzebuje powietrza. */
const estimateSectionInsetClass =
  "px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-6";

const estimateMetaPillClass =
  "min-w-0 rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 px-4 py-3 shadow-sm shadow-slate-900/[0.02]";

type Bootstrap = {
  configured: boolean;
  liveBaseUrl: string | null;
  ordersBaseUrl: string | null;
  ordersBlockedReason: string | null;
  ordersMessage: string | null;
  testPort: number;
  todayKey: string;
  salesEndKey: string;
  salesEndFromFs: boolean;
  defaultWindow: { dataOd: string; dataDo: string };
  suppliers: ZdEstimateSupplierOption[];
  quickGroups: ZdEstimateGroupOption[];
  exclusions: ZdEstimateExclusionRow[];
  exclusionsError: string | null;
  packaging: ZdEstimatePackagingRow[];
  packagingError: string | null;
};

type RunMeta = {
  pagesFetched: number;
  totalCountApi: number;
  truncated: boolean;
  ordersBaseUrl: string;
  durationMs: number;
  totalFromSubiekt: number;
};

type ListFilter = "order" | "all" | "excluded";

function resolveWindowForGroup(
  group: ZdEstimateGroupOption,
  suppliers: ZdEstimateSupplierOption[],
  salesEndKey: string
) {
  if (group.dniZapasu != null && group.dniZapasu > 0) {
    const window = salesWindowFromDniZapasu(group.dniZapasu, salesEndKey);
    return {
      dniZapasu: group.dniZapasu,
      dataOd: window.dataOd,
      dataDo: window.dataDo,
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      stockLabel: group.stockLabel,
      matched: true as const,
    };
  }
  return applyGroupStockWindow({
    groupName: group.grt_Nazwa,
    suppliers,
    salesEndKey,
    fallbackDniZapasu: DEFAULT_DNI_ZAPASU,
    salesWindowFromDniZapasu,
  });
}

function MetaPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={estimateMetaPillClass}>
      <p className={panelTypography.caption}>{label}</p>
      <p
        className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-900 sm:text-[0.9375rem]"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export function ZdEstimateWorkbench({ bootstrap }: { bootstrap: Bootstrap }) {
  const [estimating, startEstimate] = useTransition();
  const [searching, startSearch] = useTransition();
  const [mutating, startMutate] = useTransition();
  const exclusionsGenRef = useRef(0);
  const packagingGenRef = useRef(0);

  const [groupQuery, setGroupQuery] = useState("");
  const [groupHits, setGroupHits] = useState<ZdEstimateGroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ZdEstimateGroupOption | null>(
    null
  );
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [dniZapasu, setDniZapasu] = useState(
    String(
      bootstrap.quickGroups.find((g) => g.dniZapasu)?.dniZapasu ?? DEFAULT_DNI_ZAPASU
    )
  );
  const [dataOd, setDataOd] = useState(bootstrap.defaultWindow.dataOd);
  const [dataDo, setDataDo] = useState(bootstrap.defaultWindow.dataDo);
  const [zapasMin, setZapasMin] = useState("0");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showZkColumn, setShowZkColumn] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("order");
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lines, setLines] = useState<ManualZdEstimateLine[] | null>(null);
  const [paramInfo, setParamInfo] = useState<Record<string, unknown> | null>(null);
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [exclusions, setExclusions] = useState<ZdEstimateExclusionRow[]>(
    bootstrap.exclusions
  );
  const [exclusionsError, setExclusionsError] = useState<string | null>(
    bootstrap.exclusionsError
  );
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [packaging, setPackaging] = useState<ZdEstimatePackagingRow[]>(
    bootstrap.packaging
  );
  const [packagingError, setPackagingError] = useState<string | null>(
    bootstrap.packagingError
  );
  const [packagingOpen, setPackagingOpen] = useState(false);
  const [packagingCandidate, setPackagingCandidate] =
    useState<ManualZdEstimateLine | null>(null);
  const [excludeCandidate, setExcludeCandidate] =
    useState<ManualZdEstimateLine | null>(null);
  const [mutatingTwId, setMutatingTwId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [bulkExcludeOpen, setBulkExcludeOpen] = useState(false);
  const [bulkPackagingOpen, setBulkPackagingOpen] = useState(false);
  const [bulkPackagingMode, setBulkPackagingMode] = useState<"set" | "clear">(
    "set"
  );
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const busy = estimating || searching || mutating;
  const exclusionsTrusted = exclusionsError == null;
  const packagingTrusted = packagingError == null;
  const settingsTrusted = exclusionsTrusted && packagingTrusted;

  const clearSelection = useCallback(() => setSelected({}), []);

  const clearSucceededFromSelection = useCallback((ids: number[]) => {
    if (!ids.length) return;
    setSelected((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of ids) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const applyExclusionsMutation = useCallback(
    (rows: ZdEstimateExclusionRow[]) => {
      exclusionsGenRef.current += 1;
      setExclusions(rows);
      setExclusionsError(null);
    },
    []
  );

  const applyPackagingMutation = useCallback(
    (rows: ZdEstimatePackagingRow[]) => {
      packagingGenRef.current += 1;
      setPackaging(rows);
      setPackagingError(null);
    },
    []
  );

  const reportError = useCallback((message: string) => {
    setFeedback(null);
    setErrorMessage(message);
  }, []);

  const selectedSupplier = useMemo(
    () => bootstrap.suppliers.find((s) => s.id === supplierId) ?? null,
    [bootstrap.suppliers, supplierId]
  );

  const excludedIds = useMemo(
    () => new Set(exclusions.map((e) => e.subiektTwId)),
    [exclusions]
  );

  const exclusionById = useMemo(() => {
    const map = new Map<number, ZdEstimateExclusionRow>();
    for (const e of exclusions) map.set(e.subiektTwId, e);
    return map;
  }, [exclusions]);

  const packagingMap = useMemo(
    () => packagingByTwId(packaging),
    [packaging]
  );

  const packagingLookup = useMemo(() => {
    const map = new Map<number, PackagingLookup>();
    for (const row of packaging) {
      map.set(row.subiektTwId, {
        unitsPerPackage: row.unitsPerPackage,
        packageLabel: row.packageLabel,
      });
    }
    return map;
  }, [packaging]);

  const orderSummary = useMemo(() => {
    if (!lines || !settingsTrusted) {
      return {
        doZamowieniaCount: 0,
        piecesNeededSuma: 0,
        zdUnitsSuma: 0,
        piecesArrivingSuma: 0,
      };
    }
    return summarizePackOrderQty(lines, packagingLookup, excludedIds);
  }, [lines, packagingLookup, excludedIds, settingsTrusted]);

  const orderableLines = useMemo(() => {
    if (!lines || !settingsTrusted) return [];
    return filterOrderableLinesWithPackaging(
      lines,
      packagingLookup,
      excludedIds
    );
  }, [lines, packagingLookup, excludedIds, settingsTrusted]);

  const excludedInGroupCount = useMemo(() => {
    if (!lines || !exclusionsTrusted) return 0;
    return lines.filter((l) => excludedIds.has(l.tw_Id)).length;
  }, [lines, excludedIds, exclusionsTrusted]);

  const packagingInGroupCount = useMemo(() => {
    if (!lines || !packagingTrusted) return 0;
    return lines.filter((l) => packagingMap.has(l.tw_Id)).length;
  }, [lines, packagingMap, packagingTrusted]);

  const stockLabel =
    selectedSupplier?.stockLabel ?? selectedGroup?.stockLabel ?? null;
  const supplierLabel =
    selectedSupplier?.name ?? selectedGroup?.supplierName ?? null;

  const selectGroup = (group: ZdEstimateGroupOption) => {
    setSelectedGroup(group);
    setGroupQuery(group.grt_Nazwa);
    setGroupHits([]);
    setFeedback(null);
    setErrorMessage(null);
    setCopyOk(false);

    const applied = resolveWindowForGroup(
      group,
      bootstrap.suppliers,
      bootstrap.salesEndKey
    );
    setSupplierId(applied.supplierId);
    setDniZapasu(String(applied.dniZapasu));
    setDataOd(applied.dataOd);
    setDataDo(applied.dataDo);
  };

  const onDniZapasuChange = (raw: string) => {
    setDniZapasu(raw);
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 1) return;
    const end = dataDo || bootstrap.salesEndKey;
    setDataOd(salesWindowFromDniZapasu(n, end).dataOd);
  };

  const onSupplierOverride = (id: string) => {
    if (!id) {
      setSupplierId(null);
      return;
    }
    const s = bootstrap.suppliers.find((x) => x.id === id);
    setSupplierId(id);
    if (!s?.dniZapasu) return;
    setDniZapasu(String(s.dniZapasu));
    setDataOd(
      salesWindowFromDniZapasu(s.dniZapasu, dataDo || bootstrap.salesEndKey).dataOd
    );
  };

  const searchGroups = () => {
    setFeedback(null);
    setErrorMessage(null);
    startSearch(async () => {
      const res = await actionSearchZdEstimateGroups(groupQuery);
      if (!res.ok) {
        setGroupHits([]);
        setFeedback(res.feedback ?? null);
        setErrorMessage(res.message);
        return;
      }
      setGroupHits(res.groups);
      if (res.groups.length === 1) {
        selectGroup(res.groups[0]!);
        return;
      }
      if (res.groups.length === 0) {
        setErrorMessage("Brak grup dla tej frazy.");
      }
    });
  };

  const runEstimate = () => {
    setFeedback(null);
    setErrorMessage(null);
    setCopyOk(false);
    const grupaId = selectedGroup?.grt_Id;
    if (!grupaId) {
      setErrorMessage("Wybierz grupę (np. Falcon).");
      return;
    }
    if (!settingsTrusted) {
      setErrorMessage(
        "Najpierw wczytaj wykluczenia i opakowania — inaczej qty ZD może być niepoprawne."
      );
      return;
    }
    startEstimate(async () => {
      const res = await actionRunZdEstimateManual({
        grupaId,
        dniZapasu: Number(dniZapasu),
        dataOd,
        dataDo,
        zapasMin: Number(zapasMin) || 0,
      });
      if (!res.ok) {
        setLines(null);
        setParamInfo(null);
        setMeta(null);
        setSelected({});
        setFeedback(res.feedback);
        setErrorMessage(res.message);
        return;
      }
      setLines(res.result.pozycje);
      setSelected({});
      setParamInfo(res.result.parametry as Record<string, unknown>);
      setMeta({
        pagesFetched: res.meta.pagesFetched,
        totalCountApi: res.meta.totalCountApi,
        truncated: res.meta.truncated,
        ordersBaseUrl: res.meta.ordersBaseUrl,
        durationMs: res.meta.durationMs,
        totalFromSubiekt: res.meta.totalFromSubiekt,
      });
      setListFilter("order");

      const genExBefore = exclusionsGenRef.current;
      const genPackBefore = packagingGenRef.current;
      const [freshEx, freshPack] = await Promise.all([
        actionListZdEstimateExclusions(),
        actionListZdEstimatePackaging(),
      ]);
      if (genExBefore === exclusionsGenRef.current) {
        if (freshEx.ok) {
          setExclusions(freshEx.exclusions);
          setExclusionsError(null);
        } else {
          setExclusions(res.exclusions);
          setExclusionsError(null);
          reportError(
            `Odświeżenie wykluczeń nie powiodło się (${freshEx.message}). Użyto listy z momentu szacunku.`
          );
        }
      }
      if (genPackBefore === packagingGenRef.current) {
        if (freshPack.ok) {
          setPackaging(freshPack.packaging);
          setPackagingError(null);
        } else {
          setPackaging(res.packaging);
          setPackagingError(null);
          reportError(
            `Odświeżenie opakowań nie powiodło się (${freshPack.message}). Użyto listy z momentu szacunku.`
          );
        }
      }
    });
  };

  const visibleLines = useMemo(() => {
    if (!lines) return [];
    if (!settingsTrusted) {
      if (listFilter === "order") return [];
      if (listFilter === "excluded") return [];
      return lines;
    }
    if (listFilter === "excluded") {
      return lines.filter((l) => excludedIds.has(l.tw_Id));
    }
    if (listFilter === "all") return lines;
    return filterOrderableLinesWithPackaging(
      lines,
      packagingLookup,
      excludedIds
    );
  }, [lines, listFilter, excludedIds, packagingLookup, settingsTrusted]);

  const selectedLines = useMemo(() => {
    if (!lines) return [];
    return lines.filter((l) => selected[l.tw_Id]);
  }, [lines, selected]);

  const selectedCount = selectedLines.length;

  const visibleSelectedCount = useMemo(
    () => visibleLines.filter((l) => selected[l.tw_Id]).length,
    [visibleLines, selected]
  );
  const allVisibleSelected =
    visibleLines.length > 0 && visibleSelectedCount === visibleLines.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && !allVisibleSelected;

  const excludeEligibleLines = useMemo(
    () =>
      selectedLines.filter(
        (l) => !exclusionsTrusted || !excludedIds.has(l.tw_Id)
      ),
    [selectedLines, exclusionsTrusted, excludedIds]
  );
  const restoreEligibleLines = useMemo(
    () =>
      selectedLines.filter(
        (l) => exclusionsTrusted && excludedIds.has(l.tw_Id)
      ),
    [selectedLines, exclusionsTrusted, excludedIds]
  );
  const packagingClearEligibleLines = useMemo(
    () =>
      selectedLines.filter(
        (l) => packagingTrusted && packagingMap.has(l.tw_Id)
      ),
    [selectedLines, packagingTrusted, packagingMap]
  );

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const toggleRowSelected = (twId: number) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[twId]) delete next[twId];
      else next[twId] = true;
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const row of visibleLines) next[row.tw_Id] = true;
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = { ...prev };
        for (const row of visibleLines) delete next[row.tw_Id];
        return next;
      });
      return;
    }
    selectAllVisible();
  };

  const toBulkProducts = (rows: ManualZdEstimateLine[]) =>
    rows.map((l) => ({
      subiektTwId: l.tw_Id,
      twSymbol: l.tw_Symbol,
      twNazwa: l.tw_Nazwa,
      grtId: selectedGroup?.grt_Id ?? l.tw_IdGrupa,
      grtNazwa: selectedGroup?.grt_Nazwa ?? l.grt_Nazwa,
    }));

  const reportBulkPartial = (
    succeeded: number,
    failed: Array<{ twSymbol?: string | null; error: string }>,
    truncated: boolean,
    noun: string
  ) => {
    const parts: string[] = [];
    if (succeeded > 0) parts.push(`Zapisano ${succeeded} ${noun}.`);
    if (failed.length) {
      const sample = failed
        .slice(0, 3)
        .map((f) => f.twSymbol ?? f.error)
        .join(", ");
      parts.push(
        `Nie udało się: ${failed.length}${sample ? ` (${sample})` : ""}.`
      );
    }
    if (truncated) {
      parts.push(
        `Limit ${ZD_ESTIMATE_BULK_MAX} na jedną akcję — pozostałe zaznaczenie zostawione; uruchom ponownie dla reszty.`
      );
    }
    if (failed.length || truncated) {
      reportError(parts.join(" "));
    }
  };

  const confirmBulkExclude = (note: string) => {
    const products = toBulkProducts(excludeEligibleLines);
    if (!products.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionExcludeZdEstimateProducts({
        products,
        note: note || undefined,
      });
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyExclusionsMutation(res.exclusions);
      clearSucceededFromSelection(res.succeededTwIds);
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "wykluczeń"
      );
      setBulkExcludeOpen(false);
    });
  };

  const confirmBulkRestore = () => {
    const ids = restoreEligibleLines.map((l) => l.tw_Id);
    if (!ids.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionRestoreZdEstimateProducts(ids);
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyExclusionsMutation(res.exclusions);
      clearSucceededFromSelection(res.succeededTwIds);
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "przywróceń"
      );
      setBulkRestoreOpen(false);
    });
  };

  const confirmBulkPackaging = (input: {
    unitsPerPackage: number;
    packageLabel: string;
    note: string;
  }) => {
    const products = toBulkProducts(selectedLines);
    if (!products.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionUpsertZdEstimatePackagingBulk({
        products,
        unitsPerPackage: input.unitsPerPackage,
        packageLabel: input.packageLabel,
        note: input.note.trim() || undefined,
      });
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyPackagingMutation(res.packaging);
      clearSucceededFromSelection(res.succeededTwIds);
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "opakowań"
      );
      setBulkPackagingOpen(false);
    });
  };

  const confirmBulkClearPackaging = () => {
    const ids = packagingClearEligibleLines.map((l) => l.tw_Id);
    if (!ids.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionDeleteZdEstimatePackagingBulk(ids);
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyPackagingMutation(res.packaging);
      clearSucceededFromSelection(res.succeededTwIds);
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "usunięć opakowań"
      );
      setBulkPackagingOpen(false);
    });
  };

  const confirmExclude = (note: string) => {
    const line = excludeCandidate;
    if (!line) return;
    setErrorMessage(null);
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionExcludeZdEstimateProduct({
          subiektTwId: line.tw_Id,
          twSymbol: line.tw_Symbol,
          twNazwa: line.tw_Nazwa,
          grtId: selectedGroup?.grt_Id ?? line.tw_IdGrupa,
          grtNazwa: selectedGroup?.grt_Nazwa ?? line.grt_Nazwa,
          note: note || undefined,
        });
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyExclusionsMutation(res.exclusions);
        setExcludeCandidate(null);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const restoreLine = (twId: number) => {
    setErrorMessage(null);
    setMutatingTwId(twId);
    startMutate(async () => {
      try {
        const res = await actionRestoreZdEstimateProduct(twId);
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyExclusionsMutation(res.exclusions);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const retryLoadExclusions = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdEstimateExclusions();
      if (!res.ok) {
        setExclusionsError(res.message);
        reportError(res.message);
        return;
      }
      applyExclusionsMutation(res.exclusions);
    });
  };

  const retryLoadPackaging = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdEstimatePackaging();
      if (!res.ok) {
        setPackagingError(res.message);
        reportError(res.message);
        return;
      }
      applyPackagingMutation(res.packaging);
    });
  };

  const openExclusionsPanel = () => {
    setExclusionsOpen(true);
    retryLoadExclusions();
  };

  const openPackagingPanel = () => {
    setPackagingOpen(true);
    retryLoadPackaging();
  };

  const savePackaging = (input: {
    unitsPerPackage: number;
    packageLabel: string;
    note: string;
  }) => {
    const line = packagingCandidate;
    if (!line) return;
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionUpsertZdEstimatePackaging({
          subiektTwId: line.tw_Id,
          twSymbol: line.tw_Symbol,
          twNazwa: line.tw_Nazwa,
          grtId: selectedGroup?.grt_Id ?? line.tw_IdGrupa,
          grtNazwa: selectedGroup?.grt_Nazwa ?? line.grt_Nazwa,
          unitsPerPackage: input.unitsPerPackage,
          packageLabel: input.packageLabel,
          note: input.note,
        });
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyPackagingMutation(res.packaging);
        setPackagingCandidate(null);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const clearPackaging = () => {
    const line = packagingCandidate;
    if (!line) return;
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionDeleteZdEstimatePackaging(line.tw_Id);
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyPackagingMutation(res.packaging);
        setPackagingCandidate(null);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const copyTsv = async () => {
    if (!settingsTrusted) {
      reportError(
        "Nie można kopiować TSV bez wczytanych wykluczeń i opakowań."
      );
      return;
    }
    if (!orderableLines.length) return;
    try {
      await navigator.clipboard.writeText(
        orderableLinesToTsv(orderableLines, packagingLookup)
      );
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      reportError("Nie udało się skopiować do schowka.");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Status środowiska — kompaktowy, bez hałasu */}
      {bootstrap.configured ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950">
          <Badge variant="success">Test :{bootstrap.testPort}</Badge>
          <span className="min-w-0 truncate font-medium text-emerald-900/85">
            {bootstrap.ordersBaseUrl}
          </span>
          {bootstrap.salesEndFromFs ? (
            <span className="text-emerald-800/70">
              · FS do {formatPlDate(bootstrap.salesEndKey)}
            </span>
          ) : null}
        </div>
      ) : (
        <Alert tone="error" title="Szacunek zablokowany — tylko test :5082">
          {bootstrap.ordersMessage ??
            "Brak bezpiecznej konfiguracji testowego API."}
          <span className="mt-2 block text-sm">
            <code className="text-xs">
              SUBIEKT_API_ORDERS_BASE_URL=http://192.168.0.140:{bootstrap.testPort}
              /api/v1
            </code>
          </span>
        </Alert>
      )}

      <Card padding={false}>
        <CardHeader
          inset
          density="default"
          title="Przygotowanie listy"
          description="Wybierz grupę Subiekta — zapas OnTime i okno sprzedaży ustawią się same. Do ZD to jednostki dokumentu (z opakowań)."
          hint="Wykluczenia i opakowania są trwałe i wspólne dla działu zakupów. Sandbox tylko na :5082."
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconPackage size={18} strokeWidth={1.75} />
            </SectionHeadingIcon>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openExclusionsPanel}
              >
                Wykluczenia
                {exclusions.length > 0 ? ` (${exclusions.length})` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openPackagingPanel}
              >
                Opakowania
                {packaging.length > 0 ? ` (${packaging.length})` : ""}
              </Button>
            </div>
          }
        />

        <div className={cn(estimateSectionInsetClass, "space-y-6")}>
          <section className="space-y-3.5">
            <p className={panelTypography.sectionLabel}>Grupa towarowa</p>
            <div className="flex flex-wrap gap-2.5">
              {bootstrap.quickGroups.map((g) => {
                const active = selectedGroup?.grt_Id === g.grt_Id;
                return (
                  <button
                    key={g.grt_Id}
                    type="button"
                    disabled={!bootstrap.configured}
                    onClick={() => selectGroup(g)}
                    title={
                      g.dniZapasu != null
                        ? `${g.supplierName ?? "dostawca"} · zapas ${g.stockLabel} (${g.dniZapasu} d)`
                        : "Brak zapasu na karcie — 30 dni"
                    }
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2.5 rounded-lg border px-4 py-2.5 text-left text-sm transition",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      active
                        ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-900/5"
                        : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <span className="font-medium">{g.grt_Nazwa}</span>
                    {g.dniZapasu != null ? (
                      <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                        {g.dniZapasu}d
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
              <div className="relative min-w-0 flex-1">
                <IconSearch
                  size={16}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchGroups();
                    }
                  }}
                  placeholder="Szukaj innej grupy…"
                  disabled={!bootstrap.configured}
                  className="h-11 pl-10"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={searchGroups}
                disabled={busy || !bootstrap.configured || !groupQuery.trim()}
                className="h-11 shrink-0 sm:min-w-[7.5rem]"
              >
                {searching ? "Szukam…" : "Szukaj"}
              </Button>
            </div>

            {groupHits.length > 1 ? (
              <ul className="max-h-52 overflow-y-auto rounded-lg border border-slate-200/90 bg-white divide-y divide-slate-100 shadow-sm shadow-slate-900/[0.02]">
                {groupHits.map((g) => (
                  <li key={g.grt_Id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition hover:bg-slate-50",
                        selectedGroup?.grt_Id === g.grt_Id && "bg-indigo-50/70"
                      )}
                      onClick={() => selectGroup(g)}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">
                          {g.grt_Nazwa}
                        </span>
                        {g.supplierName ? (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {g.supplierName}
                            {g.stockLabel ? ` · ${g.stockLabel}` : ""}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">
                        #{g.grt_Id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {selectedGroup ? (
            <section className="space-y-3.5">
              <p className={panelTypography.sectionLabel}>Parametry z wyboru</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetaPill label="Grupa" value={selectedGroup.grt_Nazwa} />
                <MetaPill
                  label="Zapas"
                  value={
                    stockLabel
                      ? `${stockLabel} · ${dniZapasu} dni`
                      : `${dniZapasu} dni`
                  }
                />
                <MetaPill
                  label="Dostawca"
                  value={supplierLabel ?? "Brak karty OnTime"}
                />
                <MetaPill
                  label="Okno sprzedaży"
                  value={`${formatPlDate(dataOd)} – ${formatPlDate(dataDo)}`}
                />
              </div>
            </section>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 py-5 text-sm leading-relaxed text-slate-600">
              Wybierz grupę (Falcon, Ivoclar…) — zapas i daty ustawią się
              automatycznie.
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-slate-600 transition hover:text-slate-900"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <IconChevronDown
                size={16}
                strokeWidth={1.75}
                className={cn(
                  "transition-transform",
                  showAdvanced && "rotate-180"
                )}
              />
              {showAdvanced ? "Ukryj zaawansowane" : "Zaawansowane"}
            </button>
            <Button
              type="button"
              onClick={runEstimate}
              disabled={
                estimating ||
                !bootstrap.configured ||
                !selectedGroup ||
                !settingsTrusted
              }
              className="h-11 w-full sm:w-auto sm:min-w-[12.5rem]"
            >
              {estimating ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4" /> Liczę…
                </span>
              ) : (
                "Policz listę"
              )}
            </Button>
          </div>

          {showAdvanced ? (
            <div className="space-y-4 rounded-lg border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Dostawca (override)">
                  <Select
                    value={supplierId ?? ""}
                    onChange={(e) => onSupplierOverride(e.target.value)}
                  >
                    <option value="">— z grupy —</option>
                    {bootstrap.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.dniZapasu != null
                          ? ` · ${s.stockLabel} (${s.dniZapasu} d)`
                          : s.stockLabel !== "—"
                            ? ` · ${s.stockLabel}`
                            : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Dni zapasu">
                  <Input
                    type="number"
                    min={1}
                    max={730}
                    value={dniZapasu}
                    onChange={(e) => onDniZapasuChange(e.target.value)}
                  />
                </Field>
                <Field label="Data od">
                  <Input
                    type="date"
                    value={dataOd}
                    onChange={(e) => setDataOd(e.target.value)}
                  />
                </Field>
                <Field label="Data do">
                  <Input
                    type="date"
                    value={dataDo}
                    onChange={(e) => {
                      setDataDo(e.target.value);
                      const n = Math.round(Number(dniZapasu));
                      if (Number.isFinite(n) && n >= 1 && e.target.value) {
                        setDataOd(
                          salesWindowFromDniZapasu(n, e.target.value).dataOd
                        );
                      }
                    }}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Bufor szt. (zapasMin)">
                  <Input
                    type="number"
                    min={0}
                    value={zapasMin}
                    onChange={(e) => setZapasMin(e.target.value)}
                  />
                </Field>
                <label className="flex items-center gap-2.5 self-end pb-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300"
                    checked={showZkColumn}
                    onChange={(e) => setShowZkColumn(e.target.checked)}
                  />
                  Kolumny ZK / API
                </label>
              </div>
              {selectedSupplier && selectedSupplier.dniZapasu == null ? (
                <Alert tone="warning" title="Dostawca bez liczbowego zapasu">
                  „{selectedSupplier.name}”: {selectedSupplier.stockLabel}. Ustaw
                  dni zapasu ręcznie.
                </Alert>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {feedback ? <SubiektFeedbackAlert feedback={feedback} /> : null}
      {exclusionsError ? (
        <Alert tone="error" title="Wykluczenia niedostępne">
          {exclusionsError}
          <span className="mt-2 block">
            Bez wczytanej listy nie liczymy bezpiecznej listy do zamówienia ani
            nie kopiujemy TSV.
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={mutating}
            onClick={retryLoadExclusions}
          >
            {mutating ? "Wczytuję…" : "Wczytaj wykluczenia ponownie"}
          </Button>
        </Alert>
      ) : null}
      {packagingError ? (
        <Alert tone="error" title="Opakowania niedostępne">
          {packagingError}
          <span className="mt-2 block">
            Bez opakowań qty w ZD może być w sztukach zamiast paczek (np. Falcon
            10 szt).
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={mutating}
            onClick={retryLoadPackaging}
          >
            {mutating ? "Wczytuję…" : "Wczytaj opakowania ponownie"}
          </Button>
        </Alert>
      ) : null}
      {errorMessage ? (
        <Alert tone="error" title="Błąd">
          {errorMessage}
        </Alert>
      ) : null}

      {!lines && !estimating ? (
        <Card padding={false}>
          <EmptyState
            brandAccent
            icon={<IconClipboardList size={28} strokeWidth={1.75} />}
            title="Brak listy"
            description="Wybierz grupę i kliknij „Policz listę”. Wynik pochodzi z testowego Subiekta — pełna grupa towarowa."
          />
        </Card>
      ) : null}

      {estimating && !lines ? (
        <Card padding={false}>
          <div className="flex items-center justify-center gap-3 px-6 py-14 text-sm text-slate-600">
            <Spinner className="size-5" />
            Pobieram pełną grupę z Subiekta…
          </div>
        </Card>
      ) : null}

      {lines ? (
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="default"
            title="Lista produktów"
            description={
              selectedGroup
                ? `${selectedGroup.grt_Nazwa} · dane z Subiekta :${bootstrap.testPort}`
                : `Dane z Subiekta :${bootstrap.testPort}`
            }
            leading={
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconClipboardList size={18} strokeWidth={1.75} />
              </SectionHeadingIcon>
            }
          />

          <div className={cn(estimateSectionInsetClass, "space-y-5")}>
            <div className="flex flex-col gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <SegmentedControl
                ariaLabel="Filtr listy"
                value={listFilter}
                onChange={setListFilter}
                className="w-full justify-stretch sm:w-auto"
                touchFriendly
                options={[
                  {
                    value: "order",
                    label: "Do zamówienia",
                    title: "Qty > 0, bez wykluczonych",
                  },
                  {
                    value: "all",
                    label: "Wszystkie",
                    title: "Pełna grupa — wykluczone oznaczone",
                  },
                  {
                    value: "excluded",
                    label: `Wykluczone${
                      excludedInGroupCount > 0
                        ? ` (${excludedInGroupCount})`
                        : ""
                    }`,
                    title: "Wykluczone w tej grupie",
                  },
                ]}
              />
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openExclusionsPanel}
                  >
                    Wykluczenia
                    {exclusions.length > 0 ? ` (${exclusions.length})` : ""}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openPackagingPanel}
                  >
                    Opakowania
                    {packaging.length > 0 ? ` (${packaging.length})` : ""}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={copyTsv}
                    disabled={!orderableLines.length || !settingsTrusted}
                    title={
                      settingsTrusted
                        ? "Kopiuje do_zd (jednostki ZD) z uwzględnieniem opakowań"
                        : "Wymaga wczytanych wykluczeń i opakowań"
                    }
                  >
                    {copyOk ? "Skopiowano" : "Kopiuj TSV"}
                  </Button>
                </div>
                {selectedCount === 0 && visibleLines.length > 0 ? (
                  <p className="text-[11px] leading-snug text-slate-500">
                    Zaznacz checkboxy w tabeli, żeby wykluczyć lub ustawić
                    opakowanie grupowo.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <PanelSummaryMetric
                label="W grupie"
                value={String(meta?.totalFromSubiekt ?? lines.length)}
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Do zamówienia"
                value={String(orderSummary.doZamowieniaCount)}
                tone="success"
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Suma do ZD"
                value={formatQty(orderSummary.zdUnitsSuma)}
                hint="Jednostki do wpisania w Subiekcie"
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Szt. przyjdzie"
                value={formatQty(orderSummary.piecesArrivingSuma)}
                hint={
                  orderSummary.piecesArrivingSuma >
                  orderSummary.piecesNeededSuma
                    ? `potrzeba ${formatQty(orderSummary.piecesNeededSuma)} szt`
                    : undefined
                }
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Wykluczone"
                value={String(excludedInGroupCount)}
                hint={
                  exclusions.length > 0
                    ? `łącznie ${exclusions.length} w bazie`
                    : undefined
                }
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Z opakowaniem"
                value={String(packagingInGroupCount)}
                hint={
                  packaging.length > 0
                    ? `łącznie ${packaging.length} w bazie`
                    : undefined
                }
                className="px-3.5 py-3.5"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {meta?.truncated ? (
                <Badge variant="warning">Lista ucięta limitem stron API</Badge>
              ) : (
                <span />
              )}
              <p className="text-xs tabular-nums text-slate-400">
                Widoczne {visibleLines.length} / {lines.length}
                {meta
                  ? ` · ${meta.durationMs} ms · ${meta.pagesFetched} str.`
                  : ""}
                {paramInfo
                  ? ` · dniOkresu ${String(paramInfo.dniOkresu ?? "—")} · dniZapasu ${String(paramInfo.dniZapasu ?? "—")}`
                  : ""}
              </p>
            </div>

            {visibleLines.length === 0 ? (
              <EmptyState
                title={
                  !settingsTrusted && listFilter === "order"
                    ? "Ustawienia niewczytane"
                    : listFilter === "order"
                      ? "Nic do zamówienia"
                      : listFilter === "excluded"
                        ? "Brak wykluczeń w tej grupie"
                        : "Brak pozycji"
                }
                description={
                  !settingsTrusted && listFilter === "order"
                    ? "Wczytaj wykluczenia i opakowania, żeby zobaczyć bezpieczną listę do ZD."
                    : listFilter === "order"
                      ? "Przy tych parametrach qty = 0 albo wszystkie braki są na liście wykluczeń. Przełącz filtr, żeby zobaczyć pełną grupę."
                      : listFilter === "excluded"
                        ? "Żaden produkt z tej grupy nie jest na trwałej liście wykluczeń."
                        : "Subiekt nie zwrócił pozycji dla tej grupy."
                }
                action={
                  !settingsTrusted && listFilter === "order" ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {!exclusionsTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutating}
                          onClick={retryLoadExclusions}
                        >
                          Wczytaj wykluczenia
                        </Button>
                      ) : null}
                      {!packagingTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutating}
                          onClick={retryLoadPackaging}
                        >
                          Wczytaj opakowania
                        </Button>
                      ) : null}
                    </div>
                  ) : listFilter === "order" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setListFilter("all")}
                    >
                      Pokaż wszystkie
                    </Button>
                  ) : listFilter === "excluded" && exclusions.length > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={openExclusionsPanel}
                    >
                      Otwórz listę wykluczeń
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="space-y-3">
                <ZdEstimateBulkBar
                  selectedCount={selectedCount}
                  visibleCount={visibleLines.length}
                  allVisibleSelected={allVisibleSelected}
                  excludeEligibleCount={excludeEligibleLines.length}
                  restoreEligibleCount={restoreEligibleLines.length}
                  packagingClearEligibleCount={
                    packagingClearEligibleLines.length
                  }
                  truncatedHint={selectedCount > ZD_ESTIMATE_BULK_MAX}
                  disabled={mutating || estimating}
                  onSelectAllVisible={selectAllVisible}
                  onClearSelection={clearSelection}
                  onBulkExclude={() => setBulkExcludeOpen(true)}
                  onBulkRestore={() => setBulkRestoreOpen(true)}
                  onBulkPackaging={() => {
                    setBulkPackagingMode("set");
                    setBulkPackagingOpen(true);
                  }}
                  onBulkClearPackaging={() => {
                    setBulkPackagingMode("clear");
                    setBulkPackagingOpen(true);
                  }}
                />

                <TableScroll className="max-h-[min(72vh,48rem)] overflow-auto rounded-xl border border-slate-200/90 bg-white px-0 pb-0 shadow-sm shadow-slate-900/[0.02] sm:px-0 sm:pb-0">
                <DataTable className="zd-estimate-table">
                  <thead>
                    <tr>
                      <th className="zd-estimate-check-col" scope="col">
                        <span className="sr-only">Zaznacz</span>
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          className={cn("size-4", checkboxBrandClass)}
                          checked={allVisibleSelected}
                          disabled={
                            visibleLines.length === 0 || mutating || estimating
                          }
                          onChange={toggleSelectAllVisible}
                          aria-label={
                            allVisibleSelected
                              ? "Odznacz widoczne"
                              : "Zaznacz widoczne"
                          }
                        />
                      </th>
                      <th className="zd-estimate-symbol-col">Symbol</th>
                      <th>Nazwa</th>
                      <th className="text-right">Do ZD</th>
                      <th className="text-right">Opakowanie</th>
                      <th className="text-right">Stan</th>
                      <th className="text-right">Rez.</th>
                      <th className="text-right">Dostępne</th>
                      <th className="text-right">Sprzedaż</th>
                      <th className="text-right">Cel</th>
                      <th className="text-right">Otwarte ZD</th>
                      {showZkColumn ? (
                        <>
                          <th className="text-right">ZK</th>
                          <th className="text-right">API</th>
                        </>
                      ) : null}
                      <th className="text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLines.map((l) => {
                      const excluded =
                        exclusionsTrusted && excludedIds.has(l.tw_Id);
                      const packRow = packagingMap.get(l.tw_Id) ?? null;
                      const qty = resolveOrderQtyForLine(
                        l,
                        packRow
                          ? {
                              unitsPerPackage: packRow.unitsPerPackage,
                              packageLabel: packRow.packageLabel,
                            }
                          : null
                      );
                      const order = !excluded && qty.zdUnits > 0;
                      const note = exclusionById.get(l.tw_Id)?.note;
                      const isSelected = Boolean(selected[l.tw_Id]);
                      return (
                        <tr
                          key={l.tw_Id}
                          className={cn(
                            excluded && "bg-slate-50/80",
                            isSelected && !excluded && "bg-indigo-50/40"
                          )}
                        >
                          <td className="zd-estimate-check-col">
                            <input
                              type="checkbox"
                              className={cn("size-4", checkboxBrandClass)}
                              checked={isSelected}
                              disabled={mutating || estimating}
                              onChange={() => toggleRowSelected(l.tw_Id)}
                              aria-label={`Zaznacz ${l.tw_Symbol}`}
                            />
                          </td>
                          <td
                            className={cn(
                              "zd-estimate-symbol-col whitespace-nowrap font-semibold tabular-nums",
                              excluded
                                ? "text-slate-400 line-through"
                                : "text-slate-900"
                            )}
                          >
                            {l.tw_Symbol}
                          </td>
                          <td
                            className={cn(
                              "min-w-[16rem] max-w-[28rem]",
                              excluded ? "text-slate-400" : "text-slate-700"
                            )}
                            title={
                              note
                                ? `${l.tw_Nazwa} — ${note}`
                                : l.tw_Nazwa
                            }
                          >
                            <span className="line-clamp-2 leading-snug">
                              {l.tw_Nazwa}
                            </span>
                            {excluded ? (
                              <span className="mt-1.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100">
                                wykluczone
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={cn(
                              "whitespace-nowrap text-right tabular-nums",
                              order
                                ? "font-semibold text-emerald-800"
                                : "text-slate-300"
                            )}
                            title={
                              excluded ? undefined : formatZdPackHint(qty)
                            }
                          >
                            {excluded ? (
                              "—"
                            ) : (
                              <span className="inline-flex flex-col items-end gap-0.5">
                                <span className="text-base leading-none">
                                  {qty.zdUnits}
                                </span>
                                {qty.hasPackaging && qty.zdUnits > 0 ? (
                                  <span className="max-w-[9rem] text-right text-[11px] font-medium leading-snug text-indigo-700/90">
                                    {qty.packageLabel}×{qty.unitsPerPackage}
                                    <span className="text-slate-400">
                                      {" "}
                                      = {qty.piecesArriving} szt
                                    </span>
                                    {qty.roundedUp ? (
                                      <span className="block text-amber-700/80">
                                        potrzeba {qty.piecesNeeded}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : qty.zdUnits > 0 ? (
                                  <span className="text-[11px] font-normal text-slate-400">
                                    szt
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums text-slate-600">
                            {qty.hasPackaging ? (
                              <span className="inline-flex flex-col items-end gap-0.5">
                                <span className="font-semibold text-indigo-900">
                                  {qty.unitsPerPackage} szt
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  / 1 {qty.packageLabel}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-300">1 : 1</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums text-slate-700">
                            {formatQty(l.tw_Stan)}
                          </td>
                          <td
                            className={cn(
                              "whitespace-nowrap text-right tabular-nums",
                              l.tw_StanRez > 0
                                ? "font-medium text-amber-800"
                                : "text-slate-400"
                            )}
                          >
                            {formatQty(l.tw_StanRez)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums text-slate-700">
                            {formatQty(l.dostepne)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums text-slate-700">
                            {formatQty(l.sprzedazOkres)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums text-slate-600">
                            {formatQty(l.celZapasu)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums text-slate-700">
                            <span className="inline-flex flex-col items-end gap-0.5">
                              <span>{formatQty(l.otwarteZd)}</span>
                              {qty.hasPackaging && l.otwarteZd > 0 ? (
                                <span className="text-[11px] text-slate-400">
                                  ={formatQty(l.otwarteZd * qty.unitsPerPackage)}{" "}
                                  szt
                                </span>
                              ) : null}
                            </span>
                          </td>
                          {showZkColumn ? (
                            <>
                              <td className="whitespace-nowrap text-right tabular-nums text-slate-400">
                                {formatQty(l.otwarteZkBezRez)}
                              </td>
                              <td className="whitespace-nowrap text-right tabular-nums text-slate-400">
                                {formatQty(l.doZamowieniaApi)}
                              </td>
                            </>
                          ) : null}
                          <td className="text-right">
                            <div className="inline-flex justify-end py-0.5 pl-1">
                              <ZdEstimateRowActions
                                symbol={l.tw_Symbol}
                                excluded={Boolean(excluded)}
                                packagingHint={
                                  qty.hasPackaging
                                    ? `${qty.unitsPerPackage} szt / 1 ${qty.packageLabel}`
                                    : null
                                }
                                disabled={mutating || estimating}
                                pending={mutatingTwId === l.tw_Id}
                                onPackaging={() => setPackagingCandidate(l)}
                                onExclude={() => setExcludeCandidate(l)}
                                onRestore={() => restoreLine(l.tw_Id)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableScroll>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={bulkRestoreOpen && restoreEligibleLines.length > 0}
        title={`Przywróć ${Math.min(restoreEligibleLines.length, ZD_ESTIMATE_BULK_MAX)}${restoreEligibleLines.length > ZD_ESTIMATE_BULK_MAX ? ` z ${restoreEligibleLines.length}` : ""}?`}
        message={
          restoreEligibleLines.length > ZD_ESTIMATE_BULK_MAX
            ? `Zaznaczone wrócą na listę „Do zamówienia”. Limit ${ZD_ESTIMATE_BULK_MAX} na akcję — pierwsze ${ZD_ESTIMATE_BULK_MAX} zostaną przywrócone, reszta zostanie zaznaczona.`
            : `Przywrócić ${restoreEligibleLines.length} ${restoreEligibleLines.length === 1 ? "produkt" : "produktów"} na listę „Do zamówienia”?`
        }
        confirmLabel={
          restoreEligibleLines.length > ZD_ESTIMATE_BULK_MAX
            ? `Przywróć ${ZD_ESTIMATE_BULK_MAX}`
            : `Przywróć ${restoreEligibleLines.length}`
        }
        cancelLabel="Anuluj"
        pending={mutating && bulkRestoreOpen}
        onCancel={() => {
          if (!mutating) setBulkRestoreOpen(false);
        }}
        onConfirm={confirmBulkRestore}
      />

      <ZdEstimateBulkExcludeDialog
        key={
          bulkExcludeOpen
            ? `ex-${excludeEligibleLines.map((l) => l.tw_Id).join("-")}`
            : "ex-closed"
        }
        open={bulkExcludeOpen && excludeEligibleLines.length > 0}
        lines={excludeEligibleLines}
        pending={mutating && bulkExcludeOpen}
        onCancel={() => {
          if (!mutating) setBulkExcludeOpen(false);
        }}
        onConfirm={confirmBulkExclude}
      />

      <ZdEstimateBulkPackagingDialog
        key={
          bulkPackagingOpen
            ? `pk-${bulkPackagingMode}-${(bulkPackagingMode === "clear"
                ? packagingClearEligibleLines
                : selectedLines
              )
                .map((l) => l.tw_Id)
                .join("-")}`
            : "pk-closed"
        }
        open={
          bulkPackagingOpen &&
          (bulkPackagingMode === "clear"
            ? packagingClearEligibleLines.length > 0
            : selectedLines.length > 0)
        }
        lines={
          bulkPackagingMode === "clear"
            ? packagingClearEligibleLines
            : selectedLines
        }
        mode={bulkPackagingMode}
        pending={mutating && bulkPackagingOpen}
        onCancel={() => {
          if (!mutating) setBulkPackagingOpen(false);
        }}
        onSave={confirmBulkPackaging}
        onClear={confirmBulkClearPackaging}
      />

      <ZdEstimatePackagingDialog
        open={packagingCandidate != null}
        line={packagingCandidate}
        existing={
          packagingCandidate
            ? packagingMap.get(packagingCandidate.tw_Id) ?? null
            : null
        }
        pending={mutating && packagingCandidate != null}
        onCancel={() => {
          if (!mutating) setPackagingCandidate(null);
        }}
        onSave={savePackaging}
        onClear={clearPackaging}
      />

      <ZdEstimatePackagingModal
        open={packagingOpen}
        onClose={() => setPackagingOpen(false)}
        packaging={packaging}
        onPackagingChange={applyPackagingMutation}
        onError={reportError}
      />

      <ZdEstimateExcludeDialog
        open={excludeCandidate != null}
        line={excludeCandidate}
        pending={mutating && excludeCandidate != null}
        onCancel={() => {
          if (!mutating) setExcludeCandidate(null);
        }}
        onConfirm={confirmExclude}
      />

      <ZdEstimateExclusionsModal
        open={exclusionsOpen}
        onClose={() => setExclusionsOpen(false)}
        exclusions={exclusions}
        onExclusionsChange={applyExclusionsMutation}
        onError={reportError}
      />
    </div>
  );
}
