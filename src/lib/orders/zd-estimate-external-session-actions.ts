import { actionDeleteZdEstimateUiSession } from "@/app/actions/zd-estimate";

export async function deleteZdEstimateExternalSessionRecord(
  sessionId: string
): Promise<void> {
  const res = await actionDeleteZdEstimateUiSession({ sessionId });
  if (!res.ok) {
    console.warn("Sesja UI kreatora: błąd delete.", res.message);
  }
}
