import type { ComponentType } from "react";
import type { StrokeIconProps } from "@/components/icons/StrokeIcons";
import {
  IconCalendar,
  IconClipboardList,
  IconClipboardPen,
  IconHelpCircle,
  IconKeyboard,
  IconMessageSquare,
  IconUserGroup,
} from "@/components/icons/StrokeIcons";

export type ProsbaOptionalSectionKind =
  | "line-note"
  | "request-note"
  | "client"
  | "readiness"
  | "keyboard"
  | "zk-status"
  | "today-tasks";

type ProsbaOptionalSectionMeta = {
  Icon: ComponentType<StrokeIconProps>;
  tileClassName: string;
};

const OPTIONAL_SECTION_META: Record<ProsbaOptionalSectionKind, ProsbaOptionalSectionMeta> = {
  "line-note": {
    Icon: IconClipboardPen,
    tileClassName: "bg-violet-50 text-violet-700",
  },
  "request-note": {
    Icon: IconMessageSquare,
    tileClassName: "bg-sky-50 text-sky-700",
  },
  client: {
    Icon: IconUserGroup,
    tileClassName: "bg-indigo-50 text-indigo-700",
  },
  readiness: {
    Icon: IconClipboardList,
    tileClassName: "bg-amber-50 text-amber-800",
  },
  keyboard: {
    Icon: IconKeyboard,
    tileClassName: "bg-slate-100 text-slate-600",
  },
  "zk-status": {
    Icon: IconHelpCircle,
    tileClassName: "bg-indigo-100 text-indigo-800",
  },
  "today-tasks": {
    Icon: IconCalendar,
    tileClassName: "bg-violet-100 text-violet-800",
  },
};

export function prosbaOptionalSectionMeta(kind: ProsbaOptionalSectionKind): ProsbaOptionalSectionMeta {
  return OPTIONAL_SECTION_META[kind];
}
