import { Alert } from "@/components/ui/Alert";
import {
  ManagerPreviewBanner,
  type ManagerPreviewScope,
} from "@/components/sales/ManagerPreviewBanner";

export type SalesTeamPreview = {
  salesPersonId: string;
  salesPersonName: string;
  readOnly?: boolean;
  scope: ManagerPreviewScope;
  bannerClassName?: string;
  isDelegate?: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

export function resolveSalesLinkErrorTone(linkError: string): "warning" | "error" {
  return linkError.includes("zignorowany") ? "warning" : "error";
}

/** Wspólne alerty stron handlowca — podgląd kierownika i błędy linku ?dla=. */
export function SalesPageAlerts({
  teamPreview,
  linkError,
  showLinkError = true,
  linkErrorClassName,
  linkErrorWarningOnIgnored = true,
}: {
  teamPreview?: SalesTeamPreview | null;
  linkError?: string | null;
  showLinkError?: boolean;
  linkErrorClassName?: string;
  /** Gdy false — zawsze tone error (jak na /plan i /tablica). */
  linkErrorWarningOnIgnored?: boolean;
}) {
  const banner = teamPreview ? (
    <ManagerPreviewBanner
      salesPersonId={teamPreview.salesPersonId}
      salesPersonName={teamPreview.salesPersonName}
      scope={teamPreview.scope}
      readOnly={teamPreview.readOnly}
      isDelegate={teamPreview.isDelegate}
      startDate={teamPreview.startDate}
      endDate={teamPreview.endDate}
      className={teamPreview.bannerClassName}
    />
  ) : null;

  const errorAlert =
    showLinkError && linkError ? (
      <Alert
        tone={
          linkErrorWarningOnIgnored ? resolveSalesLinkErrorTone(linkError) : "error"
        }
        className={linkErrorClassName}
      >
        {linkError}
      </Alert>
    ) : null;

  if (!banner && !errorAlert) {
    return null;
  }

  return (
    <>
      {banner}
      {errorAlert}
    </>
  );
}
