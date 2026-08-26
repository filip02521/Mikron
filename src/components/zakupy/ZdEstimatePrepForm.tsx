"use client";

import { useState } from "react";
import type {
  ZdEstimateCechaOption,
  ZdEstimateGroupOption,
  ZdEstimateSupplierOption,
} from "@/app/actions/zd-estimate";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconChevronDown,
  IconSearch,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  ZD_BOOST_PRESET_DEFS,
  type ZdBoostPowerPreset,
} from "@/lib/orders/zd-estimate-boost-presets";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import {
  ZD_ESTIMATE_UI,
  zdEstimateCechaScopeCaption,
  zdEstimateCountingButtonLabel,
  zdEstimateNeedsSettingsHint,
  zdEstimatePrepCardHint,
  zdEstimateScopeChangedHint,
  zdEstimateScopeModeCechaHint,
  zdEstimateScopeModeGrupaHint,
} from "@/lib/orders/zd-estimate-ui-copy";
import { ZD_ESTIMATE_POLICZ_CTA_ID } from "@/lib/orders/zd-estimate-launch-scroll";
import {
  panelTypography,
  zdEstimateCardSurfaceClass,
  zdEstimateNestedWellClass,
  zdEstimatePrepControlClass,
  zdEstimatePrepFormInsetXClass,
  zdEstimatePrepIdleBodyClass,
  zdEstimatePrepIdleFooterClass,
  zdEstimatePrepParamsStripClass,
  zdEstimatePrepPrimaryButtonClass,
  zdEstimateRadiusNestedClass,
  zdEstimateShadowControlClass,
} from "@/lib/ui/ontime-theme";

export type ZdEstimatePrepFormProps = {
  configured: boolean;
  busy: boolean;
  searching: boolean;
  mutating: boolean;
  estimating: boolean;
  scopeMode: ZdEstimateRunMode;
  onScopeModeChange: (mode: ZdEstimateRunMode) => void;
  quickGroups: ZdEstimateGroupOption[];
  selectedGroup: ZdEstimateGroupOption | null;
  onSelectGroup: (group: ZdEstimateGroupOption) => void;
  groupQuery: string;
  onGroupQueryChange: (value: string) => void;
  onSearchGroups: () => void;
  groupHits: ZdEstimateGroupOption[];
  selectedCecha: ZdEstimateCechaOption | null;
  onSelectCecha: (cecha: ZdEstimateCechaOption) => void;
  cechaQuery: string;
  onCechaQueryChange: (value: string) => void;
  onSearchCechy: () => void;
  cechaHits: ZdEstimateCechaOption[];
  scopeSelected: boolean;
  settingsTrusted: boolean;
  scopeNeedsRecount: boolean;
  canPolicz: boolean;
  boostPreset: ZdBoostPowerPreset;
  onBoostPresetChange: (preset: ZdBoostPowerPreset) => void;
  extrasPolicy: ZdEstimateExtrasPolicy;
  onExtrasPolicyChange: (policy: ZdEstimateExtrasPolicy) => void;
  dniZapasu: string;
  onDniZapasuChange: (value: string) => void;
  dataOd: string;
  dataDo: string;
  onManualDataOdChange: (value: string) => void;
  onManualDataDoChange: (value: string) => void;
  salesWindowSource: "stock" | "manual";
  onRestoreSalesWindowFromStock: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  supplierId: string | null;
  onSupplierOverride: (value: string) => void;
  suppliers: ZdEstimateSupplierOption[];
  selectedSupplier: ZdEstimateSupplierOption | null;
  /** Komunikat po auto-przypisaniu dostawcy z mapowania zakresów. */
  supplierFromMappingNotice?: string | null;
  zapasMin: string;
  onZapasMinChange: (value: string) => void;
  onPolicz: () => void;
  showAssignAndRun: boolean;
  showRemapAndRun: boolean;
  onAssignAndRun: () => void;
};

function formatWindowShort(dataOd: string, dataDo: string): string {
  return `${formatPlDate(dataOd)} → ${formatPlDate(dataDo)}`;
}

const stripLabelClass =
  "text-[11px] font-medium uppercase tracking-wide text-slate-500";

/**
 * Karta przygotowania Kreatora ZD: zakres → parametry biegu → nadpisania → Policz.
 */
export function ZdEstimatePrepForm({
  configured,
  busy,
  searching,
  mutating,
  estimating,
  scopeMode,
  onScopeModeChange,
  quickGroups,
  selectedGroup,
  onSelectGroup,
  groupQuery,
  onGroupQueryChange,
  onSearchGroups,
  groupHits,
  selectedCecha,
  onSelectCecha,
  cechaQuery,
  onCechaQueryChange,
  onSearchCechy,
  cechaHits,
  scopeSelected,
  settingsTrusted,
  scopeNeedsRecount,
  canPolicz,
  boostPreset,
  onBoostPresetChange,
  extrasPolicy,
  onExtrasPolicyChange,
  dniZapasu,
  onDniZapasuChange,
  dataOd,
  dataDo,
  onManualDataOdChange,
  onManualDataDoChange,
  salesWindowSource,
  onRestoreSalesWindowFromStock,
  showAdvanced,
  onToggleAdvanced,
  supplierId,
  onSupplierOverride,
  suppliers,
  selectedSupplier,
  supplierFromMappingNotice = null,
  zapasMin,
  onZapasMinChange,
  onPolicz,
  showAssignAndRun,
  showRemapAndRun,
  onAssignAndRun,
}: ZdEstimatePrepFormProps) {
  const [datesEditorScopeKey, setDatesEditorScopeKey] = useState<string | null>(
    null
  );
  const scopeKey =
    scopeMode === "cecha"
      ? `c-${selectedCecha?.ctw_Id ?? "none"}`
      : `g-${selectedGroup?.grt_Id ?? "none"}`;
  const datesEditorOpen = datesEditorScopeKey === scopeKey;
  const showDatesEditor =
    datesEditorOpen || salesWindowSource === "manual";
  const paramsDisabled = !scopeSelected || !configured;

  const showScopePlaceholder = !scopeSelected;

  const footerStatus = !scopeSelected
    ? null
    : !settingsTrusted
      ? {
          text: zdEstimateNeedsSettingsHint(),
          className: "text-amber-800",
        }
      : scopeNeedsRecount
        ? {
            text: zdEstimateScopeChangedHint(),
            className: "text-amber-800",
          }
        : null;

  return (
    <Card
      padding={false}
      className={cn(
        "relative flex shrink-0 flex-col overflow-visible",
        zdEstimateCardSurfaceClass
      )}
    >
      <CardHeader
        inset
        density="compact"
        className={zdEstimatePrepFormInsetXClass}
        title={ZD_ESTIMATE_UI.prepFormTitle}
        hint={zdEstimatePrepCardHint()}
      />

      <div className={zdEstimatePrepIdleBodyClass}>
        {/* Strefa 1 — wybór zakresu */}
        <section className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={cn(
                panelTypography.sectionLabel,
                "text-xs tracking-wide text-slate-700"
              )}
            >
              Zakres
            </p>
            <SegmentedControl
              ariaLabel="Tryb zakresu szacunku"
              value={scopeMode}
              onChange={onScopeModeChange}
              density="dock"
              options={[
                {
                  value: "grupa",
                  label: "Grupa",
                  title: zdEstimateScopeModeGrupaHint(),
                },
                {
                  value: "cecha",
                  label: "Cecha",
                  title: zdEstimateScopeModeCechaHint(),
                },
              ]}
            />
          </div>

          {showScopePlaceholder ? (
            <p className="text-sm leading-snug text-slate-600">
              {ZD_ESTIMATE_UI.prepScopePlaceholder}
            </p>
          ) : null}

          {scopeMode === "grupa" ? (
            <>
              <div className="flex flex-wrap content-start gap-1.5">
                {quickGroups.map((g) => {
                  const active = selectedGroup?.grt_Id === g.grt_Id;
                  return (
                    <button
                      key={g.grt_Id}
                      type="button"
                      disabled={!configured}
                      onClick={() => onSelectGroup(g)}
                      title={
                        g.dniZapasu != null
                          ? `${g.supplierName ?? "dostawca"} · zapas ${g.stockLabel} (${g.dniZapasu} d)`
                          : "Brak zapasu na karcie — 30 dni"
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border text-left transition",
                        zdEstimatePrepControlClass,
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        active
                          ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-900/5"
                          : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className="max-w-[16rem] truncate font-medium">
                        {g.grt_Nazwa}
                      </span>
                      {g.dniZapasu != null ? (
                        <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                          {g.dniZapasu}d
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div className="relative min-w-0 flex-1">
                  <IconSearch
                    size={16}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    value={groupQuery}
                    onChange={(e) => onGroupQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSearchGroups();
                      }
                    }}
                    placeholder="Szukaj innej grupy…"
                    disabled={!configured}
                    className={cn(zdEstimatePrepControlClass, "pl-9")}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onSearchGroups}
                  disabled={busy || !configured || !groupQuery.trim()}
                  className={cn(zdEstimatePrepControlClass, "w-full shrink-0 sm:w-auto sm:min-w-[6.5rem]")}
                >
                  {searching ? "Szukam…" : "Szukaj"}
                </Button>
              </div>

              {groupHits.length > 1 ? (
                <ul
                  className={cn(
                    "max-h-44 divide-y divide-slate-100 overflow-y-auto border border-slate-200/90 bg-white",
                    zdEstimateRadiusNestedClass,
                    zdEstimateShadowControlClass
                  )}
                >
                  {groupHits.map((g) => (
                    <li key={g.grt_Id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm transition hover:bg-slate-50",
                          selectedGroup?.grt_Id === g.grt_Id && "bg-indigo-50/70"
                        )}
                        onClick={() => onSelectGroup(g)}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-900">
                            {g.grt_Nazwa}
                          </span>
                          {g.supplierName ? (
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {g.supplierName}
                              {g.supplierMatchSource === "mapping"
                                ? ` · ${ZD_ESTIMATE_UI.supplierFromMappingHitSuffix}`
                                : ""}
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
            </>
          ) : (
            <>
              <p className="text-sm leading-snug text-slate-600">
                {zdEstimateCechaScopeCaption()}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div className="relative min-w-0 flex-1">
                  <IconSearch
                    size={16}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    value={cechaQuery}
                    onChange={(e) => onCechaQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSearchCechy();
                      }
                    }}
                    placeholder="Szukaj cechy (np. Ivoclar)…"
                    disabled={!configured}
                    className={cn(zdEstimatePrepControlClass, "pl-9")}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onSearchCechy}
                  disabled={busy || !configured || !cechaQuery.trim()}
                  className={cn(zdEstimatePrepControlClass, "w-full shrink-0 sm:w-auto sm:min-w-[6.5rem]")}
                >
                  {searching ? "Szukam…" : "Szukaj"}
                </Button>
              </div>

              {cechaHits.length > 1 ? (
                <ul
                  className={cn(
                    "max-h-44 divide-y divide-slate-100 overflow-y-auto border border-slate-200/90 bg-white",
                    zdEstimateRadiusNestedClass,
                    zdEstimateShadowControlClass
                  )}
                >
                  {cechaHits.map((c) => (
                    <li key={c.ctw_Id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm transition hover:bg-slate-50",
                          selectedCecha?.ctw_Id === c.ctw_Id && "bg-indigo-50/70"
                        )}
                        onClick={() => onSelectCecha(c)}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-900">
                            {c.ctw_Nazwa}
                          </span>
                          {c.supplierName ? (
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {c.supplierName}
                              {c.supplierMatchSource === "mapping"
                                ? ` · ${ZD_ESTIMATE_UI.supplierFromMappingHitSuffix}`
                                : ""}
                              {c.stockLabel ? ` · ${c.stockLabel}` : ""}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">
                          #{c.ctw_Id}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>

        {scopeSelected ? (
          selectedSupplier ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-1.5 border px-3 py-2.5",
                supplierFromMappingNotice
                  ? "border-indigo-200/80 bg-indigo-50/70"
                  : "border-emerald-200/80 bg-emerald-50/60",
                zdEstimateRadiusNestedClass
              )}
              role="status"
              aria-live="polite"
            >
              <span
                className={cn(
                  "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide",
                  supplierFromMappingNotice
                    ? "bg-indigo-100 text-indigo-800"
                    : "bg-emerald-100 text-emerald-900"
                )}
              >
                {ZD_ESTIMATE_UI.supplierLinkedLabel}
              </span>
              <p
                className={cn(
                  "min-w-0 flex-1 text-sm font-medium leading-snug",
                  supplierFromMappingNotice
                    ? "text-indigo-950"
                    : "text-emerald-950"
                )}
              >
                {selectedSupplier.name}
                {supplierFromMappingNotice ? (
                  <span className="ml-1.5 font-normal text-indigo-800/80">
                    · {ZD_ESTIMATE_UI.supplierLinkedFromMappingBadge}
                  </span>
                ) : null}
              </p>
              {selectedSupplier.stockLabel &&
              selectedSupplier.stockLabel !== "—" ? (
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    supplierFromMappingNotice
                      ? "text-indigo-700/80"
                      : "text-emerald-800/80"
                  )}
                >
                  zapas {selectedSupplier.stockLabel}
                  {selectedSupplier.dniZapasu != null
                    ? ` (${selectedSupplier.dniZapasu} d)`
                    : ""}
                </span>
              ) : null}
            </div>
          ) : (
            <div
              className={cn(
                "border border-amber-200/90 bg-amber-50/70 px-3 py-2.5 text-sm leading-snug text-amber-950",
                zdEstimateRadiusNestedClass
              )}
              role="status"
            >
              {(selectedGroup?.supplierMappingUnresolved ||
                selectedCecha?.supplierMappingUnresolved)
                ? ZD_ESTIMATE_UI.supplierMappingUnresolvedHint
                : ZD_ESTIMATE_UI.supplierUnlinkedHint}
            </div>
          )
        ) : null}

        {/* Strefa 2 — parametry biegu */}
        <section
          className={zdEstimatePrepParamsStripClass}
          aria-label="Parametry biegu"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <label className={stripLabelClass} htmlFor="zd-prep-dni-zapasu">
              Zapas
            </label>
            <Input
              id="zd-prep-dni-zapasu"
              type="number"
              min={1}
              max={730}
              value={dniZapasu}
              onChange={(e) => onDniZapasuChange(e.target.value)}
              disabled={paramsDisabled}
              className={cn(zdEstimatePrepControlClass, "w-[5.5rem]")}
              title={ZD_ESTIMATE_UI.advancedDniZapasuHint}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1 sm:min-w-[11rem]">
            <span className={stripLabelClass}>Okno</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border border-slate-200/90 bg-white tabular-nums text-slate-800",
                  zdEstimatePrepControlClass,
                  paramsDisabled && "opacity-50"
                )}
                title={ZD_ESTIMATE_UI.advancedDataOdHint}
              >
                {formatWindowShort(dataOd, dataDo)}
              </span>
              {salesWindowSource !== "manual" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={paramsDisabled}
                  aria-expanded={datesEditorOpen}
                  onClick={() =>
                    setDatesEditorScopeKey((prev) =>
                      prev === scopeKey ? null : scopeKey
                    )
                  }
                  className={zdEstimatePrepControlClass}
                >
                  {datesEditorOpen ? "Ukryj" : "Zmień"}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1">
            <span className={stripLabelClass}>
              {ZD_ESTIMATE_UI.prepParamBoostLabel}
            </span>
            <SegmentedControl
              ariaLabel={ZD_ESTIMATE_UI.boostPowerAriaLabel}
              value={boostPreset}
              onChange={onBoostPresetChange}
              disabled={mutating || estimating || paramsDisabled}
              density="dock"
              className="w-full max-w-full"
              options={ZD_BOOST_PRESET_DEFS.map((def) => ({
                value: def.id,
                label: def.shortLabel,
                title: def.hint,
              }))}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <span className={stripLabelClass}>
              {ZD_ESTIMATE_UI.prepParamExtrasLabel}
            </span>
            <SegmentedControl
              ariaLabel={ZD_ESTIMATE_UI.extrasPolicyAriaLabel}
              value={extrasPolicy}
              onChange={onExtrasPolicyChange}
              disabled={mutating || estimating || paramsDisabled}
              density="dock"
              className="w-full sm:w-auto"
              options={[
                {
                  value: "sum" as const,
                  label: ZD_ESTIMATE_UI.extrasPolicySumShort,
                  title: ZD_ESTIMATE_UI.extrasPolicySumHint,
                },
                {
                  value: "max" as const,
                  label: ZD_ESTIMATE_UI.extrasPolicyMaxShort,
                  title: ZD_ESTIMATE_UI.extrasPolicyMaxHint,
                },
              ]}
            />
          </div>
        </section>

        {selectedSupplier && selectedSupplier.dniZapasu == null ? (
          <Alert tone="warning" title="Dostawca bez liczbowego zapasu">
            „{selectedSupplier.name}”: {selectedSupplier.stockLabel}. Ustaw dni
            zapasu ręcznie w polu Zapas.
          </Alert>
        ) : null}

        {showDatesEditor ? (
          <div className={cn("space-y-2 p-3", zdEstimateNestedWellClass)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Data od" hint={ZD_ESTIMATE_UI.advancedDataOdHint}>
                <Input
                  type="date"
                  value={dataOd}
                  onChange={(e) => onManualDataOdChange(e.target.value)}
                  disabled={paramsDisabled}
                  className={zdEstimatePrepControlClass}
                />
              </Field>
              <Field label="Data do" hint={ZD_ESTIMATE_UI.advancedDataDoHint}>
                <Input
                  type="date"
                  value={dataDo}
                  onChange={(e) => onManualDataDoChange(e.target.value)}
                  disabled={paramsDisabled}
                  className={zdEstimatePrepControlClass}
                />
              </Field>
            </div>
            {salesWindowSource === "manual" ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
                <span className="font-medium">
                  {ZD_ESTIMATE_UI.advancedSalesWindowManualNote}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  className={zdEstimatePrepControlClass}
                  onClick={() => {
                    onRestoreSalesWindowFromStock();
                    setDatesEditorScopeKey(null);
                  }}
                >
                  Przywróć z zapasu
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Strefa 3 — nadpisania */}
        {showAdvanced ? (
          <div
            id="zd-estimate-prep-advanced"
            className={cn("space-y-3 p-3", zdEstimateNestedWellClass)}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                label="Dostawca (nadpisanie)"
                hint={ZD_ESTIMATE_UI.advancedSupplierOverrideHint}
              >
                <Select
                  value={supplierId ?? ""}
                  onChange={(e) => onSupplierOverride(e.target.value)}
                  disabled={!configured}
                  className={zdEstimatePrepControlClass}
                >
                  <option value="">
                    {scopeMode === "cecha" ? "— z cechy —" : "— z grupy —"}
                  </option>
                  {suppliers.map((s) => (
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
              <Field label={ZD_ESTIMATE_UI.advancedZapasMinLabel}>
                <Input
                  type="number"
                  min={0}
                  value={zapasMin}
                  onChange={(e) => onZapasMinChange(e.target.value)}
                  title={ZD_ESTIMATE_UI.advancedZapasMinHint}
                  disabled={!configured}
                  className={zdEstimatePrepControlClass}
                />
              </Field>
            </div>
          </div>
        ) : null}
      </div>

      <div
        id={ZD_ESTIMATE_POLICZ_CTA_ID}
        className={zdEstimatePrepIdleFooterClass}
      >
        <button
          type="button"
          className="inline-flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100/80 hover:text-slate-900"
          onClick={onToggleAdvanced}
          aria-expanded={showAdvanced}
          aria-controls={
            showAdvanced ? "zd-estimate-prep-advanced" : undefined
          }
        >
          <IconChevronDown
            size={15}
            strokeWidth={2}
            className={cn(
              "transition-transform duration-150",
              showAdvanced && "rotate-180"
            )}
          />
          {showAdvanced
            ? ZD_ESTIMATE_UI.prepOverridesHide
            : ZD_ESTIMATE_UI.prepOverridesShow}
        </button>
        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
          {footerStatus ? (
            <p
              className={cn(
                "max-w-sm text-sm leading-snug sm:text-right",
                footerStatus.className
              )}
            >
              {footerStatus.text}
            </p>
          ) : null}
          <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              onClick={onPolicz}
              disabled={
                estimating || !configured || !scopeSelected || !settingsTrusted
              }
              title={
                !settingsTrusted
                  ? ZD_ESTIMATE_UI.policzNeedsSettingsTitle
                  : !configured
                    ? "Brak połączenia z Subiektem"
                    : !scopeSelected
                      ? "Wybierz grupę lub cechę"
                      : estimating
                        ? zdEstimateCountingButtonLabel()
                        : "Policz listę do ZD z Subiekta"
              }
              className={cn(
                zdEstimatePrepPrimaryButtonClass,
                canPolicz &&
                  !estimating &&
                  "shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/25"
              )}
            >
              {estimating ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3.5" />{" "}
                  {zdEstimateCountingButtonLabel()}
                </span>
              ) : (
                "Policz listę"
              )}
            </Button>
            {showAssignAndRun || showRemapAndRun ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onAssignAndRun}
                disabled={
                  mutating ||
                  estimating ||
                  !configured ||
                  !scopeSelected ||
                  !settingsTrusted
                }
                className={zdEstimatePrepPrimaryButtonClass}
              >
                {mutating ? "Zapisuję…" : "Zapisz zakres i policz"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
