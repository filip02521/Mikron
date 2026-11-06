import { BrandLoader } from "@/components/ui/BrandLoader";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export default function ZleceniaLoading() {
  return (
    <div className={adminPageShellClass}>
      <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <BrandLoader size="lg" />
        <p className="text-[0.9375rem] text-slate-600">Wczytuję zlecenia serwisowe…</p>
      </div>
    </div>
  );
}
