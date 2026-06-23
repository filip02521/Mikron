"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { DepartmentBoardTab } from "@/components/department-board/DepartmentBoardSalesChrome";

const TAB_TO_WIDOK: Record<DepartmentBoardTab, string> = {
  announcements: "ogloszenia",
  questions: "pytania",
};

export function departmentBoardTabWidok(tab: DepartmentBoardTab): string {
  return TAB_TO_WIDOK[tab];
}

export function applyDepartmentBoardTabToSearchParams(
  params: URLSearchParams,
  tab: DepartmentBoardTab
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.set("widok", TAB_TO_WIDOK[tab]);
  next.delete("watek");
  return next;
}

export function useDepartmentBoardTabUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (tab: DepartmentBoardTab) => {
      const params = applyDepartmentBoardTabToSearchParams(
        new URLSearchParams(searchParams.toString()),
        tab
      );
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );
}
