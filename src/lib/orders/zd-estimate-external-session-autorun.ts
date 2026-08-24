/**
 * Decyzja: autorun „Przygotuj ZD” vs istniejąca sesja zewnętrzna kreatora.
 */

export type ZdEstimateAutorunSessionDecision =
  | { action: "none" }
  | { action: "restore" }
  | { action: "conflict_dialog" }
  | {
      action: "replace_and_autorun";
      reason: "daily_prepare_zd";
      previousSupplierId: string | null;
      nextSupplierId: string | null;
      supplierChanged: boolean;
    };

/**
 * Czy launch z panelu dziennego (`from=daily` + supplier + autorun) ma
 * pierwszeństwo przed istniejącą sesją (zamknij starą → Policz dla nowego).
 */
export function isDailyPrepareZdAutorunLaunch(input: {
  fromDaily: boolean;
  autorun: boolean;
  needsAssign?: boolean;
  supplierId: string | null | undefined;
  hasRunnableScope: boolean;
  hasLaunchKey: boolean;
  bootstrapConfigured: boolean;
}): boolean {
  return Boolean(
    input.fromDaily &&
      input.autorun &&
      !input.needsAssign &&
      input.bootstrapConfigured &&
      input.hasRunnableScope &&
      input.hasLaunchKey &&
      Boolean(input.supplierId?.trim())
  );
}

function wantsRunnableAutorun(input: {
  autorun: boolean;
  needsAssign: boolean;
  hasRunnableScope: boolean;
  hasLaunchKey: boolean;
  bootstrapConfigured: boolean;
}): boolean {
  return Boolean(
    input.autorun &&
      !input.needsAssign &&
      input.bootstrapConfigured &&
      input.hasRunnableScope &&
      input.hasLaunchKey
  );
}

export function decideZdEstimateAutorunVsExternalSession(input: {
  hasActiveToken: boolean;
  tokenSupplierId: string | null | undefined;
  fromDaily: boolean;
  autorun: boolean;
  needsAssign: boolean;
  supplierId: string | null | undefined;
  hasRunnableScope: boolean;
  hasLaunchKey: boolean;
  bootstrapConfigured: boolean;
}): ZdEstimateAutorunSessionDecision {
  if (!input.hasActiveToken) {
    return { action: "none" };
  }

  if (
    isDailyPrepareZdAutorunLaunch({
      fromDaily: input.fromDaily,
      autorun: input.autorun,
      needsAssign: input.needsAssign,
      supplierId: input.supplierId,
      hasRunnableScope: input.hasRunnableScope,
      hasLaunchKey: input.hasLaunchKey,
      bootstrapConfigured: input.bootstrapConfigured,
    })
  ) {
    const previousSupplierId = input.tokenSupplierId?.trim() || null;
    const nextSupplierId = input.supplierId?.trim() || null;
    return {
      action: "replace_and_autorun",
      reason: "daily_prepare_zd",
      previousSupplierId,
      nextSupplierId,
      supplierChanged: Boolean(
        previousSupplierId &&
          nextSupplierId &&
          previousSupplierId !== nextSupplierId
      ),
    };
  }

  if (wantsRunnableAutorun(input)) {
    return { action: "conflict_dialog" };
  }

  return { action: "restore" };
}
