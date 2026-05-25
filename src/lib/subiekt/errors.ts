export class SubiektNotConfiguredError extends Error {
  constructor() {
    super("Subiekt API nie jest skonfigurowane (brak SUBIEKT_API_BASE_URL).");
    this.name = "SubiektNotConfiguredError";
  }
}

export class SubiektRequestError extends Error {
  readonly status: number;
  readonly bodySnippet: string;

  constructor(status: number, bodySnippet: string) {
    super(`Subiekt API zwróciło ${status}`);
    this.name = "SubiektRequestError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}
