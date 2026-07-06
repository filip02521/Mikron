/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  MyOrderShipmentOverflowMenu,
  type MyOrderShipmentOverflowMenuProps,
} from "@/components/moje/MyOrderShipmentOverflowMenu";
import { mojeActionBarShellClass } from "@/lib/ui/surfaces";
import {
  mojeActionOverflowSegmentClass,
  panelSegmentLastClass,
} from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

function ShellToolbar({
  overflowMenuProps,
  useActionShell,
}: {
  overflowMenuProps: Omit<
    MyOrderShipmentOverflowMenuProps,
    "variant" | "className" | "triggerClassName"
  >;
  useActionShell: boolean;
}) {
  const overflowMenu = (
    <MyOrderShipmentOverflowMenu
      {...overflowMenuProps}
      variant={useActionShell ? "segment" : "standalone"}
      className={
        useActionShell
          ? cn(mojeActionOverflowSegmentClass, panelSegmentLastClass)
          : undefined
      }
      triggerClassName={useActionShell ? undefined : "h-10 w-10 sm:h-8 sm:w-8"}
    />
  );

  return useActionShell ? (
    <div className={cn(mojeActionBarShellClass, "w-full justify-end sm:w-auto")}>
      <button type="button">Potwierdź</button>
      {overflowMenu}
    </div>
  ) : (
    overflowMenu
  );
}

describe("MyOrderShipment overflow shell", () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    supplierName: "Test Supplier",
    listKind: "zamowienie" as const,
    hasClient: false,
    canAssignClient: true,
    canEdit: false,
    canCancel: false,
    onAssignClient: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
  };

  it("standalone overflow opens on click", () => {
    render(<ShellToolbar overflowMenuProps={baseProps} useActionShell={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Opcje — Test Supplier/i }));
    expect(screen.getByRole("menuitem", { name: "Przypisz klienta" })).toBeTruthy();
  });

  it("segment overflow in action shell opens on click", () => {
    render(<ShellToolbar overflowMenuProps={baseProps} useActionShell={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Opcje — Test Supplier/i }));
    expect(screen.getByRole("menuitem", { name: "Przypisz klienta" })).toBeTruthy();
  });

  it("segment overflow survives mousedown sequence with stopPropagation parent", () => {
    render(
      <div
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ShellToolbar overflowMenuProps={baseProps} useActionShell={true} />
      </div>
    );
    const trigger = screen.getByRole("button", { name: /Opcje — Test Supplier/i });
    fireEvent.mouseDown(trigger);
    fireEvent.mouseUp(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Przypisz klienta" })).toBeTruthy();
  });
});
