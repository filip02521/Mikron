"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  actionDeleteZdProductBom,
  actionUpsertZdProductBom,
} from "@/app/actions/zd-estimate";
import type { ZdProductBomRow } from "@/lib/data/zd-product-boms";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import { IconLayers, IconX } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import {
  formatZdBomCountLabel,
  formatZdBomVisibleCountLabel,
  zdBomPresetListLabel,
  ZD_BOM_UI,
} from "@/lib/orders/zd-estimate-bom-copy";
import {
  buildZdBomSeedQtyMap,
  formatZdBomComponentQtyLabel,
  normalizeZdBomComponentQty,
} from "@/lib/orders/zd-estimate-bom-qty";
import {
  presetFromBomPolicy,
  type BomPresetId,
} from "@/lib/orders/zd-estimate-bom-policy";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

export type ZdBomSeedProduct = {
  twId: number;
  symbol: string;
  nazwa: string;
};

type DraftComp = {
  twId: string;
  qty: string;
  symbol: string;
  nazwa: string;
};

function emptyDraftComp(): DraftComp {
  return { twId: "", qty: "1", symbol: "", nazwa: "" };
}

export function ZdEstimateBomsModal({
  open,
  onClose,
  boms,
  pairs,
  onBomsChange,
  onError,
  seed = null,
  onSeedConsumed,
}: {
  open: boolean;
  onClose: () => void;
  boms: ZdProductBomRow[];
  pairs: ZdProductPairRow[];
  onBomsChange: (rows: ZdProductBomRow[]) => void;
  onError: (message: string) => void;
  /** Zaznaczenie z listy: wybierz zestaw, reszta = składniki (z ilością sztuk). */
  seed?: readonly ZdBomSeedProduct[] | null;
  onSeedConsumed?: () => void;
}) {
  const searchId = useId();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [parentTw, setParentTw] = useState("");
  const [parentSym, setParentSym] = useState("");
  const [parentNazwa, setParentNazwa] = useState("");
  const [label, setLabel] = useState("");
  const [preset, setPreset] = useState<BomPresetId>("assemble");
  const [stockAsCover, setStockAsCover] = useState(true);
  const [comps, setComps] = useState<DraftComp[]>([emptyDraftComp()]);
  const [seedParentIndex, setSeedParentIndex] = useState(0);
  const [seedQtyByTwId, setSeedQtyByTwId] = useState<Record<number, string>>({});
  const wasOpenRef = useRef(false);
  const hadSeedRef = useRef(false);
  const seedKeyRef = useRef("");

  const fromSeed = seed != null && seed.length >= 2;
  const showStockAsCover = preset === "assemble";
  const pieceTwIds = useMemo(() => {
    const s = new Set<number>();
    for (const p of pairs) s.add(p.pieceTwId);
    return s;
  }, [pairs]);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    const seedActive = Boolean(seed && seed.length >= 2);
    const seedKey = seedActive && seed ? seed.map((p) => p.twId).join(",") : "";
    const seedJustAppeared = seedActive && !hadSeedRef.current;
    const seedProductsChanged =
      seedActive && seedKey !== "" && seedKey !== seedKeyRef.current;

    wasOpenRef.current = open;
    hadSeedRef.current = open ? seedActive : false;
    seedKeyRef.current = open ? seedKey : "";

    if (!open) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      // Seed: init przy otwarciu / nowym seedzie / zmianie produktów.
      // Clear seeda po „Edytuj” NIE wolno czyścić wczytanego formularza.
      if (seedActive && seed) {
        if (justOpened || seedJustAppeared || seedProductsChanged) {
          setSeedParentIndex(0);
          setPreset("assemble");
          setStockAsCover(true);
          setLabel("");
          setSeedQtyByTwId((prev) =>
            buildZdBomSeedQtyMap(
              seed.map((p) => p.twId),
              justOpened || seedJustAppeared ? undefined : prev
            )
          );
        }
        return;
      }
      if (justOpened) {
        setParentTw("");
        setParentSym("");
        setParentNazwa("");
        setLabel("");
        setPreset("assemble");
        setStockAsCover(true);
        setComps([emptyDraftComp()]);
        setSeedQtyByTwId({});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, seed]);

  const setPresetAndCover = (next: BomPresetId) => {
    setPreset(next);
    if (next !== "assemble") setStockAsCover(false);
    else setStockAsCover(true);
  };

  const loadBomIntoForm = (bom: ZdProductBomRow) => {
    const nextPreset = presetFromBomPolicy(
      bom.demandAllocation,
      bom.purchaseTarget
    );
    setPreset(nextPreset);
    setStockAsCover(nextPreset === "assemble" ? bom.stockAsCover !== false : false);
    setParentTw(String(bom.parentTwId));
    setParentSym(bom.parentSymbol ?? "");
    setParentNazwa(bom.parentNazwa === "—" ? "" : bom.parentNazwa);
    setLabel(bom.label ?? "");
    setComps(
      bom.components.length
        ? bom.components.map((c) => ({
            twId: String(c.componentTwId),
            qty: String(normalizeZdBomComponentQty(c.qtyPerParent)),
            symbol: c.componentSymbol ?? "",
            nazwa: c.componentNazwa === "—" ? "" : c.componentNazwa,
          }))
        : [emptyDraftComp()]
    );
    setQuery("");
    onSeedConsumed?.();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boms;
    return boms.filter((e) => {
      const hay = [
        e.parentSymbol ?? "",
        e.parentNazwa,
        e.label,
        String(e.parentTwId),
        ...e.components.flatMap((c) => [
          c.componentSymbol ?? "",
          c.componentNazwa,
          String(c.componentTwId),
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [boms, query]);

  const seedParent = fromSeed ? seed![seedParentIndex] : null;
  const seedComponents = useMemo(
    () => (fromSeed ? seed!.filter((_, i) => i !== seedParentIndex) : []),
    [fromSeed, seed, seedParentIndex]
  );

  const pieceWarning = useMemo(() => {
    const ids = fromSeed
      ? seedComponents.map((c) => c.twId)
      : comps
          .map((c) => Math.trunc(Number(c.twId)))
          .filter((id) => id > 0);
    return ids.filter((id) => pieceTwIds.has(id));
  }, [fromSeed, seedComponents, comps, pieceTwIds]);

  const canSubmit = fromSeed
    ? seedParent != null && seedComponents.length >= 1
    : Math.trunc(Number(parentTw)) > 0 &&
      comps.some((c) => Math.trunc(Number(c.twId)) > 0);

  const footerCount = query.trim()
    ? formatZdBomVisibleCountLabel(filtered.length, boms.length)
    : formatZdBomCountLabel(boms.length);

  const save = () => {
    if (!canSubmit || pending) return;

    const parentTwId = fromSeed
      ? seedParent!.twId
      : Math.trunc(Number(parentTw));
    const components = fromSeed
      ? seedComponents.map((c) => ({
          componentTwId: c.twId,
          qtyPerParent: normalizeZdBomComponentQty(seedQtyByTwId[c.twId]),
          componentSymbol: c.symbol || null,
          componentNazwa: c.nazwa || null,
        }))
      : comps
          .map((c) => ({
            componentTwId: Math.trunc(Number(c.twId)),
            qtyPerParent: normalizeZdBomComponentQty(c.qty),
            componentSymbol: c.symbol.trim() || null,
            componentNazwa: c.nazwa.trim() || null,
          }))
          .filter((c) => c.componentTwId > 0);

    if (components.length < 1) {
      onError(ZD_BOM_UI.needComponent);
      return;
    }

    const createdFromSeed = fromSeed;
    start(async () => {
      const res = await actionUpsertZdProductBom({
        parentTwId,
        label: label.trim() || null,
        preset,
        stockAsCover: showStockAsCover ? stockAsCover : false,
        parentSymbol: fromSeed
          ? seedParent!.symbol || null
          : parentSym.trim() || null,
        parentNazwa: fromSeed
          ? seedParent!.nazwa || null
          : parentNazwa.trim() || null,
        components,
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onBomsChange(res.boms);
      if (createdFromSeed) {
        onSeedConsumed?.();
        onClose();
      } else {
        setParentTw("");
        setParentSym("");
        setParentNazwa("");
        setLabel("");
        setPreset("assemble");
        setStockAsCover(true);
        setComps([emptyDraftComp()]);
        setSeedQtyByTwId({});
      }
    });
  };

  const remove = (id: string) => {
    start(async () => {
      const res = await actionDeleteZdProductBom({ id });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onBomsChange(res.boms);
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={ZD_BOM_UI.modalTitle}
      titleHint={ZD_BOM_UI.modalHint}
      size="xl"
      bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zapisuję…" : null}
      disableBackdropClose={pending}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">{footerCount}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={pending}
          >
            Zamknij
          </Button>
        </div>
      }
    >
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <div className="flex gap-3">
          <IconLayers
            size={18}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-slate-500"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {ZD_BOM_UI.introTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {ZD_BOM_UI.introBody}
            </p>
          </div>
        </div>
      </div>

      {fromSeed && seed && seedParent ? (
        <div className="space-y-3 rounded-xl border border-violet-200/80 bg-violet-50/40 p-3">
          <div>
            <p className="text-xs font-medium text-violet-950">
              {ZD_BOM_UI.seedHeading}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              {ZD_BOM_UI.seedQtyHint}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {seed.map((p, idx) => {
              const isParent = seedParentIndex === idx;
              const qtyValue = seedQtyByTwId[p.twId] ?? "1";
              return (
                <div
                  key={p.twId}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-xl border bg-white transition",
                    isParent
                      ? "border-violet-400 shadow-sm ring-2 ring-violet-200"
                      : "border-slate-200/80"
                  )}
                >
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setSeedParentIndex(idx)}
                    className={cn(
                      "flex-1 px-3 py-3 text-left transition",
                      !isParent && "hover:bg-slate-50/80"
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {isParent ? ZD_BOM_UI.roleZestaw : ZD_BOM_UI.roleSkladnik}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {p.symbol || `id. ${p.twId}`}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {p.nazwa || `Towar ${p.twId}`}
                    </p>
                  </button>
                  {isParent ? (
                    <p className="border-t border-violet-100 bg-violet-50/50 px-3 py-2 text-[11px] text-violet-900/80">
                      {ZD_BOM_UI.seedParentQtyHint}
                    </p>
                  ) : (
                    <label className="block border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-700">
                      {ZD_BOM_UI.fieldQtyPerZestawShort}
                      <Input
                        value={qtyValue}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, "");
                          setSeedQtyByTwId((prev) => ({
                            ...prev,
                            [p.twId]: raw,
                          }));
                        }}
                        onBlur={() => {
                          setSeedQtyByTwId((prev) => ({
                            ...prev,
                            [p.twId]: String(
                              normalizeZdBomComponentQty(prev[p.twId])
                            ),
                          }));
                        }}
                        className={cn("mt-1", controlFocusClass)}
                        inputMode="numeric"
                        min={1}
                        disabled={pending}
                        aria-label={`${ZD_BOM_UI.fieldQtyPerZestaw}: ${p.symbol || p.twId}`}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-violet-950">
              {ZD_BOM_UI.presetLegend}
            </legend>
            {(
              [
                ["assemble", ZD_BOM_UI.presetAssemble, ZD_BOM_UI.presetAssembleHint],
                [
                  "buy_separate",
                  ZD_BOM_UI.presetBuySeparate,
                  ZD_BOM_UI.presetBuySeparateHint,
                ],
                ["kit_only", ZD_BOM_UI.presetKitOnly, ZD_BOM_UI.presetKitOnlyHint],
              ] as const
            ).map(([id, title, hint]) => (
              <label
                key={id}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-violet-100/80 bg-white/80 px-2.5 py-2 text-xs text-slate-700"
              >
                <input
                  type="radio"
                  className="mt-0.5"
                  name="zd-bom-preset-seed"
                  checked={preset === id}
                  onChange={() => setPresetAndCover(id)}
                  disabled={pending}
                />
                <span>
                  <span className="font-medium text-slate-900">{title}</span>
                  <span className="mt-0.5 block text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {showStockAsCover ? (
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={stockAsCover}
                onChange={(e) => setStockAsCover(e.target.checked)}
                disabled={pending}
              />
              <span>
                <span className="font-medium">{ZD_BOM_UI.stockAsCoverLabel}</span>
                <span className="mt-0.5 block text-slate-500">
                  {ZD_BOM_UI.stockAsCoverHintSeed}
                </span>
              </span>
            </label>
          ) : null}
          {pieceWarning.length > 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-100">
              {ZD_BOM_UI.pieceWarningSeed(pieceWarning)}
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
              {ZD_BOM_UI.labelOptional}
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={cn("mt-1", controlFocusClass)}
                placeholder={ZD_BOM_UI.labelPlaceholder}
              />
            </label>
            <Button
              type="button"
              onClick={save}
              disabled={pending || !canSubmit}
            >
              {ZD_BOM_UI.saveButton}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              {ZD_BOM_UI.fieldZestawId}
              <Input
                value={parentTw}
                onChange={(e) => setParentTw(e.target.value)}
                className={cn("mt-1", controlFocusClass)}
                inputMode="numeric"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              {ZD_BOM_UI.fieldSymbol}
              <Input
                value={parentSym}
                onChange={(e) => setParentSym(e.target.value)}
                className={cn("mt-1", controlFocusClass)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              {ZD_BOM_UI.fieldLabel}
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={cn("mt-1", controlFocusClass)}
                placeholder={ZD_BOM_UI.labelPlaceholder}
              />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-700">
              {ZD_BOM_UI.presetLegend}
            </legend>
            {(
              [
                ["assemble", ZD_BOM_UI.presetAssemble, ZD_BOM_UI.presetAssembleHint],
                [
                  "buy_separate",
                  ZD_BOM_UI.presetBuySeparate,
                  ZD_BOM_UI.presetBuySeparateHint,
                ],
                ["kit_only", ZD_BOM_UI.presetKitOnly, ZD_BOM_UI.presetKitOnlyHint],
              ] as const
            ).map(([id, title, hint]) => (
              <label
                key={id}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2 text-xs text-slate-700"
              >
                <input
                  type="radio"
                  className="mt-0.5"
                  name="zd-bom-preset-manual"
                  checked={preset === id}
                  onChange={() => setPresetAndCover(id)}
                  disabled={pending}
                />
                <span>
                  <span className="font-medium text-slate-900">{title}</span>
                  <span className="mt-0.5 block text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {showStockAsCover ? (
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={stockAsCover}
              onChange={(e) => setStockAsCover(e.target.checked)}
              disabled={pending}
            />
            <span>
              <span className="font-medium">{ZD_BOM_UI.stockAsCoverLabel}</span>
              <span className="mt-0.5 block text-slate-500">
                {ZD_BOM_UI.stockAsCoverHintManual}
              </span>
            </span>
          </label>
          ) : null}
          {comps.map((c, idx) => (
            <div
              key={idx}
              className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 sm:grid-cols-4"
            >
              <label className="text-xs font-medium text-slate-600">
                {ZD_BOM_UI.fieldSkladnikId}
                <Input
                  value={c.twId}
                  onChange={(e) => {
                    const next = [...comps];
                    next[idx] = { ...c, twId: e.target.value };
                    setComps(next);
                  }}
                  className={cn("mt-1", controlFocusClass)}
                  inputMode="numeric"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                {ZD_BOM_UI.fieldQtyPerZestaw}
                <Input
                  value={c.qty}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setComps((prev) => {
                      const next = [...prev];
                      const cur = next[idx];
                      if (!cur) return prev;
                      next[idx] = { ...cur, qty: raw };
                      return next;
                    });
                  }}
                  onBlur={() => {
                    setComps((prev) => {
                      const next = [...prev];
                      const cur = next[idx];
                      if (!cur) return prev;
                      next[idx] = {
                        ...cur,
                        qty: String(normalizeZdBomComponentQty(cur.qty)),
                      };
                      return next;
                    });
                  }}
                  className={cn("mt-1", controlFocusClass)}
                  inputMode="numeric"
                  min={1}
                  placeholder="1"
                />
                <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                  {ZD_BOM_UI.fieldQtyPerZestawHint}
                </span>
              </label>
              <label className="text-xs font-medium text-slate-600">
                {ZD_BOM_UI.fieldSymbol}
                <Input
                  value={c.symbol}
                  onChange={(e) => {
                    const next = [...comps];
                    next[idx] = { ...c, symbol: e.target.value };
                    setComps(next);
                  }}
                  className={cn("mt-1", controlFocusClass)}
                />
              </label>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={pending || comps.length <= 1}
                  onClick={() => setComps(comps.filter((_, i) => i !== idx))}
                >
                  Usuń
                </Button>
              </div>
            </div>
          ))}
          {pieceWarning.length > 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-100">
              {ZD_BOM_UI.pieceWarningManual}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setComps([...comps, emptyDraftComp()])}
            >
              {ZD_BOM_UI.addComponent}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={pending || !canSubmit}
            >
              {ZD_BOM_UI.saveButton}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor={searchId}
          className="text-xs font-medium text-slate-600"
        >
          Szukaj
        </label>
        <Input
          id={searchId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={controlFocusClass}
          placeholder={ZD_BOM_UI.searchPlaceholder}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={ZD_BOM_UI.emptyTitle}
          description={ZD_BOM_UI.emptyDescription}
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80">
          {filtered.map((bom) => (
            <li
              key={bom.id}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {bom.parentSymbol || `id. ${bom.parentTwId}`}
                  {bom.label ? (
                    <span className="ml-2 text-xs font-medium text-violet-800">
                      {bom.label}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                  {bom.parentNazwa}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {zdBomPresetListLabel(
                    presetFromBomPolicy(
                      bom.demandAllocation,
                      bom.purchaseTarget
                    )
                  )}
                  {bom.demandAllocation === "explode"
                    ? ` · ${
                        bom.stockAsCover
                          ? ZD_BOM_UI.listCoverOn
                          : ZD_BOM_UI.listCoverOff
                      }`
                    : ""}{" "}
                  ·{" "}
                  {bom.components
                    .map((c) => {
                      const name =
                        c.componentSymbol ?? `id. ${c.componentTwId}`;
                      return `${name} ×${formatZdBomComponentQtyLabel(c.qtyPerParent)}`;
                    })
                    .join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1 self-start">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => loadBomIntoForm(bom)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-50"
                  title="Wczytaj do formularza (edycja)"
                >
                  Edytuj
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(bom.id)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  title={ZD_BOM_UI.removeBomTitle}
                >
                  <IconX size={14} strokeWidth={1.75} aria-hidden />
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
