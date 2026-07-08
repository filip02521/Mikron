"use client";

import { FormStatusAlert } from "@/components/orders/FormStatusAlert";
import type { FormMessage } from "@/lib/ui/notice-content";
import { resolveFormMessage } from "@/lib/ui/notice-content";

/** FormMessage → FormStatusAlert z podziałem nagłówek / treść. */
export function FormNoticeMessage({
  message,
  className,
}: {
  message: FormMessage;
  className?: string;
}) {
  const { title, description } = resolveFormMessage(message);

  if (description) {
    return (
      <FormStatusAlert tone={message.tone} title={title} className={className}>
        {description}
      </FormStatusAlert>
    );
  }

  return (
    <FormStatusAlert tone={message.tone} className={className}>
      {title}
    </FormStatusAlert>
  );
}
