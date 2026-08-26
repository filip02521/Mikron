"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type {
  ZdEstimateCechaOption,
  ZdEstimateGroupOption,
} from "@/app/actions/zd-estimate";
import {
  actionListZdEstimateCechy,
  actionListZdEstimateGroups,
} from "@/app/actions/zd-estimate";
import { IconSearch } from "@/components/icons/StrokeIcons";
import {
  ZdEstimateFavoriteCechaChip,
  ZdEstimateFavoriteGroupChip,
  ZdEstimateFavoriteStarButton,
} from "@/components/zakupy/ZdEstimateFavoriteScopeControls";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { ZdEstimateFavoriteRef } from "@/lib/orders/zd-estimate-prefs";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import {
  resolveZdEstimateFavoriteCechaChips,
  resolveZdEstimateFavoriteGroupChips,
} from "@/lib/orders/zd-estimate-scope-favorites";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: ZdEstimateRunMode;
  configured: boolean;
  favoriteGroups: ZdEstimateFavoriteRef[];
  favoriteCechy: ZdEstimateFavoriteRef[];
  groupEnrichById: ReadonlyMap<number, ZdEstimateGroupOption>;
  cechaEnrichById: ReadonlyMap<number, ZdEstimateCechaOption>;
  isGroupFavorite: (id: number) => boolean;
  isCechaFavorite: (id: number) => boolean;
  onToggleGroupFavorite: (group: ZdEstimateGroupOption) => void;
  onToggleCechaFavorite: (cecha: ZdEstimateCechaOption) => void;
  onSelectGroup: (group: ZdEstimateGroupOption) => void;
  onSelectCecha: (cecha: ZdEstimateCechaOption) => void;
  onRememberGroup: (group: ZdEstimateGroupOption) => void;
  onRememberCecha: (cecha: ZdEstimateCechaOption) => void;
};

export function ZdEstimateScopeCatalogDialog({
  open,
  onClose,
  mode,
  configured,
  favoriteGroups,
  favoriteCechy,
  groupEnrichById,
  cechaEnrichById,
  isGroupFavorite,
  isCechaFavorite,
  onToggleGroupFavorite,
  onToggleCechaFavorite,
  onSelectGroup,
  onSelectCecha,
  onRememberGroup,
  onRememberCecha,
}: Props) {
  const [filter, setFilter] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<ZdEstimateGroupOption[]>([]);
  const [cechy, setCechy] = useState<ZdEstimateCechaOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [requiresSearch, setRequiresSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const loadGenRef = useRef(0);
  const requiresSearchRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requiresSearchRef.current = requiresSearch;
  }, [requiresSearch]);

  useEffect(() => {
    if (!open) return;
    loadGenRef.current += 1;
    setFilter("");
    setDebounced("");
    setPage(1);
    setGroups([]);
    setCechy([]);
    setHasMore(false);
    setRequiresSearch(false);
    requiresSearchRef.current = false;
    setError(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setDebounced(filter.trim()), 280);
    return () => window.clearTimeout(t);
  }, [filter, open]);

  const loadPage = useCallback(
    (nextPage: number, append: boolean) => {
      if (!configured) return;
      const search = debounced.trim();
      if (requiresSearchRef.current && !search) {
        setError(null);
        if (!append) {
          setGroups([]);
          setCechy([]);
          setHasMore(false);
        }
        return;
      }
      const gen = ++loadGenRef.current;
      startTransition(async () => {
        setError(null);
        try {
          if (mode === "grupa") {
            const res = await actionListZdEstimateGroups({
              page: nextPage,
              search: search || null,
            });
            if (gen !== loadGenRef.current) return;
            if (!res.ok) {
              setError(res.message);
              return;
            }
            if (
              nextPage === 1 &&
              !search &&
              res.groups.length === 0 &&
              !requiresSearchRef.current
            ) {
              setRequiresSearch(true);
              requiresSearchRef.current = true;
              setGroups([]);
              setHasMore(false);
              return;
            }
            setGroups((prev) =>
              append ? [...prev, ...res.groups] : res.groups
            );
            for (const g of res.groups) onRememberGroup(g);
            setHasMore(res.meta.hasMore);
            setPage(nextPage);
            return;
          }
          const res = await actionListZdEstimateCechy({
            page: nextPage,
            search: search || null,
          });
          if (gen !== loadGenRef.current) return;
          if (!res.ok) {
            setError(res.message);
            return;
          }
          if (
            nextPage === 1 &&
            !search &&
            res.cechy.length === 0 &&
            !requiresSearchRef.current
          ) {
            setRequiresSearch(true);
            requiresSearchRef.current = true;
            setCechy([]);
            setHasMore(false);
            return;
          }
          setCechy((prev) => (append ? [...prev, ...res.cechy] : res.cechy));
          for (const c of res.cechy) onRememberCecha(c);
          setHasMore(res.meta.hasMore);
          setPage(nextPage);
        } catch (e) {
          if (gen !== loadGenRef.current) return;
          setError(
            e instanceof Error ? e.message : "Nie udało się wczytać katalogu."
          );
        }
      });
    },
    [configured, debounced, mode, onRememberCecha, onRememberGroup]
  );

  // Jedno ładowanie przy open / zmianie frazy (bez osobnego „clear” effect — mniej migotania).
  useEffect(() => {
    if (!open || !configured) return;
    setPage(1);
    setGroups([]);
    setCechy([]);
    loadPage(1, false);
  }, [open, configured, debounced, mode, loadPage]);

  const favoriteChips = useMemo(() => {
    if (mode === "grupa") {
      return resolveZdEstimateFavoriteGroupChips(
        favoriteGroups,
        groupEnrichById
      );
    }
    return resolveZdEstimateFavoriteCechaChips(favoriteCechy, cechaEnrichById);
  }, [
    mode,
    favoriteGroups,
    favoriteCechy,
    groupEnrichById,
    cechaEnrichById,
  ]);

  const title =
    mode === "grupa"
      ? ZD_ESTIMATE_UI.scopeCatalogTitleGroups
      : ZD_ESTIMATE_UI.scopeCatalogTitleCechy;
  const placeholder =
    mode === "grupa"
      ? ZD_ESTIMATE_UI.scopeCatalogSearchPlaceholderGroups
      : ZD_ESTIMATE_UI.scopeCatalogSearchPlaceholderCechy;

  const rowsEmpty =
    mode === "grupa" ? groups.length === 0 : cechy.length === 0;
  const showEmptyHint =
    !pending && !(requiresSearch && !debounced) && !error && rowsEmpty;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      titleHint={ZD_ESTIMATE_UI.scopeCatalogHint}
      titleId="zd-estimate-scope-catalog-title"
      size="lg"
      tier="raised"
      bodyClassName="space-y-4 px-5 py-5 sm:px-6"
      footer={
        <div className="flex w-full justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            {ZD_ESTIMATE_UI.scopeCatalogClose}
          </Button>
        </div>
      }
    >
      {favoriteChips.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {ZD_ESTIMATE_UI.scopeCatalogFavoritesHeading}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mode === "grupa"
              ? (favoriteChips as ZdEstimateGroupOption[]).map((g) => (
                  <ZdEstimateFavoriteGroupChip
                    key={g.grt_Id}
                    group={g}
                    active={false}
                    onSelect={() => {
                      onSelectGroup(g);
                      onClose();
                    }}
                    onRemoveFavorite={() => onToggleGroupFavorite(g)}
                  />
                ))
              : (favoriteChips as ZdEstimateCechaOption[]).map((c) => (
                  <ZdEstimateFavoriteCechaChip
                    key={c.ctw_Id}
                    cecha={c}
                    active={false}
                    onSelect={() => {
                      onSelectCecha(c);
                      onClose();
                    }}
                    onRemoveFavorite={() => onToggleCechaFavorite(c)}
                  />
                ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {ZD_ESTIMATE_UI.scopeCatalogResultsHeading}
        </p>
        <div className="relative">
          <IconSearch
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            ref={inputRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setDebounced(filter.trim());
              }
            }}
            placeholder={placeholder}
            disabled={!configured}
            className={cn("h-11 pl-9", controlFocusClass)}
            autoComplete="off"
          />
        </div>
      </div>

      {requiresSearch && !debounced ? (
        <p className="text-sm text-slate-600">
          {ZD_ESTIMATE_UI.scopeCatalogSearchRequired}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {pending && rowsEmpty ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-600">
          <Spinner className="size-4" /> {ZD_ESTIMATE_UI.scopeCatalogLoading}
        </p>
      ) : null}

      {mode === "grupa" ? (
        groups.length > 0 ? (
          <ul
            className="max-h-[min(50dvh,22rem)] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200/90 bg-white"
            role="listbox"
            aria-label={title}
          >
            {groups.map((g) => {
              const fav = isGroupFavorite(g.grt_Id);
              return (
                <li key={g.grt_Id} className="flex items-stretch">
                  <button
                    type="button"
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      onSelectGroup(g);
                      onClose();
                    }}
                  >
                    <span className="min-w-0 truncate font-medium text-slate-900">
                      {g.grt_Nazwa}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                      #{g.grt_Id}
                    </span>
                  </button>
                  <ZdEstimateFavoriteStarButton
                    favorited={fav}
                    label={g.grt_Nazwa}
                    onToggle={() => onToggleGroupFavorite(g)}
                  />
                </li>
              );
            })}
          </ul>
        ) : showEmptyHint ? (
          <p className="text-sm text-slate-500">
            {ZD_ESTIMATE_UI.scopeCatalogEmpty}
          </p>
        ) : null
      ) : cechy.length > 0 ? (
        <ul
          className="max-h-[min(50dvh,22rem)] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200/90 bg-white"
          role="listbox"
          aria-label={title}
        >
          {cechy.map((c) => {
            const fav = isCechaFavorite(c.ctw_Id);
            return (
              <li key={c.ctw_Id} className="flex items-stretch">
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    onSelectCecha(c);
                    onClose();
                  }}
                >
                  <span className="min-w-0 truncate font-medium text-slate-900">
                    {c.ctw_Nazwa}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    #{c.ctw_Id}
                  </span>
                </button>
                <ZdEstimateFavoriteStarButton
                  favorited={fav}
                  label={c.ctw_Nazwa}
                  onToggle={() => onToggleCechaFavorite(c)}
                />
              </li>
            );
          })}
        </ul>
      ) : showEmptyHint ? (
        <p className="text-sm text-slate-500">
          {ZD_ESTIMATE_UI.scopeCatalogEmpty}
        </p>
      ) : null}

      {hasMore ? (
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !configured}
          onClick={() => loadPage(page + 1, true)}
          className="min-h-11 w-full"
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" /> …
            </span>
          ) : (
            ZD_ESTIMATE_UI.scopeCatalogLoadMore
          )}
        </Button>
      ) : null}
    </ModalShell>
  );
}
