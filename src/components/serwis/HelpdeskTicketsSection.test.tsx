/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HelpdeskTicketsSection } from "./HelpdeskTicketsSection";
import { HELPDESK_TEST_TICKETS } from "@/lib/mikran-shop/helpdesk-parse";

const tickets = HELPDESK_TEST_TICKETS;
const data = { mode: "test" as const, tickets, linked: { [tickets[0]!.id]: [{ id: "o1", number: "ZS/26/11/001", status: "przyjete" as const, deviceName: "Mikrosilnik TEST", serialNo: null }] }, error: null };

describe("HelpdeskTicketsSection", () => {
  afterEach(cleanup);

  it("serwisant: przycisk przyjęcia przy każdym zgłoszeniu i dopisek o kolejnym sprzęcie", () => {
    render(<HelpdeskTicketsSection data={data} tickets={tickets} onAccept={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Przyjmij sprzęt" })).toHaveLength(tickets.length - 1);
    expect(screen.getByText(/już przyjęty sprzęt/)).toBeTruthy();
  });

  it("podgląd tylko do odczytu (bez onAccept): te same zgłoszenia, bez przycisków i dopisku", () => {
    render(<HelpdeskTicketsSection data={data} tickets={tickets} />);
    expect(screen.getByText(`#${tickets[1]!.id}`)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/już przyjęty sprzęt/)).toBeNull();
  });
});
