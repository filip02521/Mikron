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
    expect(screen.getAllByRole("button", { name: /^Przyjmij sprzęt ze zgłoszenia #\d+$/ })).toHaveLength(tickets.length - 1);
    expect(screen.getByText(/już przyjęty sprzęt/)).toBeTruthy();
  });

  it("podgląd tylko do odczytu (bez onAccept): te same zgłoszenia, bez przycisków i dopisku", () => {
    render(<HelpdeskTicketsSection data={data} tickets={tickets} />);
    expect(screen.getAllByText(`#${tickets[1]!.id}`).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/już przyjęty sprzęt/)).toBeNull();
  });

  it("produkcja bez połączenia (off): serwisant dostaje „Połącz z helpdeskiem” do logowania na mikran.pl", () => {
    render(<HelpdeskTicketsSection data={{ ...data, mode: "off", tickets: [] }} tickets={[]} onAccept={vi.fn()} canConnect />);
    expect(screen.getByText("Helpdesk mikran.pl nie jest połączony")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Połącz z helpdeskiem" }).getAttribute("href")).toBe("/api/mcp/connect");
  });

  it("dane testowe (dev bez połączenia): ramka „nie jest połączony” z przyciskiem nad testową listą", () => {
    render(<HelpdeskTicketsSection data={data} tickets={tickets} onAccept={vi.fn()} canConnect />);
    expect(screen.getByText("Helpdesk mikran.pl nie jest połączony")).toBeTruthy();
    expect(screen.getByText(/Do tego czasu poniżej dane testowe/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Połącz z helpdeskiem" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Przyjmij sprzęt ze zgłoszenia/ }).length).toBeGreaterThan(0);
  });

  it("podgląd admina (bez canConnect): ten sam stan, bez przycisku, mówi kto łączy", () => {
    render(<HelpdeskTicketsSection data={{ ...data, mode: "off", tickets: [] }} tickets={[]} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/gdy serwisant połączy helpdesk swoim kontem/)).toBeTruthy();
  });

  it("wygasłe połączenie: „Połącz ponownie” zamiast porady o szukaniu w helpdesku", () => {
    const expired = { ...data, error: "Połączenie z helpdeskiem mikran.pl wygasło albo zostało cofnięte — połącz je ponownie.", needsReconnect: true };
    render(<HelpdeskTicketsSection data={expired} tickets={tickets} canConnect />);
    expect(screen.getByText("Połącz helpdesk mikran.pl ponownie")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Połącz ponownie" }).getAttribute("href")).toBe("/api/mcp/connect");
    expect(screen.queryByText(/szukaniem w całym helpdesku/)).toBeNull();
  });
});
