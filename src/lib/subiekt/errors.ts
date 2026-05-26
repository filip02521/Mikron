export class SubiektNotConfiguredError extends Error {
  constructor() {
    super("Subiekt API nie jest skonfigurowane (brak SUBIEKT_API_BASE_URL).");
    this.name = "SubiektNotConfiguredError";
  }
}

export class SubiektTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Przekroczono limit czasu (${timeoutMs} ms)`);
    this.name = "SubiektTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class SubiektNetworkError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SubiektNetworkError";
    this.cause = cause;
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
