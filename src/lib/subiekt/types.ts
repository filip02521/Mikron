/** Typy zgodne z Subiekt REST API v1 (odczyt SELECT z MSSQL). */

export type SubiektPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type SubiektListEnvelope<T> = {
  data: T[];
  pagination?: SubiektPagination;
};

export type SubiektSingleEnvelope<T> = {
  data: T;
};

export type SubiektHealthStatus = "ok" | "degraded";

export type SubiektHealthData = {
  status: SubiektHealthStatus;
  timestamp: string;
  sqlConfigured: boolean;
};

/** towar — GET /products */
export type SubiektProduct = {
  tw_Id: number;
  tw_Symbol?: string | null;
  tw_Nazwa?: string | null;
  tw_PodstKodKresk?: string | null;
  tw_PLU?: string | null;
  tw_Rodzaj?: number | null;
  tw_Zablokowany?: number | null;
  [key: string]: unknown;
};

/** kontrahent + adres (adr_TypAdresu = 1) */
export type SubiektKontrahent = {
  kh_Id: number;
  kh_Symbol?: string | null;
  kh_EMail?: string | null;
  kh_Typ?: number | null;
  adr_Nazwa?: string | null;
  adr_NazwaPelna?: string | null;
  adr_NIP?: string | null;
  adr_Miejscowosc?: string | null;
  [key: string]: unknown;
};

export type SubiektDocumentLine = {
  ob_Id?: number;
  ob_TowId?: number;
  tw_Symbol?: string | null;
  tw_Nazwa?: string | null;
  ob_Ilosc?: number | null;
  ob_CenaNetto?: number | null;
  ob_CenaBrutto?: number | null;
  [key: string]: unknown;
};

/** dokument — GET /documents, /documents/zk, /documents/zd */
export type SubiektDocument = {
  dok_Id: number;
  dok_NrPelny?: string | null;
  /** Uwaga własna / opis w Subiekcie (np. „czeka”, „wz trasa”). */
  dok_NrPelnyOryg?: string | null;
  dok_Typ?: number;
  dok_OdbiorcaId?: number | null;
  dok_PlatnikId?: number | null;
  dok_DataWyst?: string | null;
  /** Termin / data realizacji (nazwy pól zależą od wersji API — pierwsze dostępne wygrywa). */
  dok_DataRealizacji?: string | null;
  dok_TerminRealizacji?: string | null;
  dok_Termin?: string | null;
  dok_DataOdbioru?: string | null;
  dok_DataMag?: string | null;
  dok_WartNetto?: number | null;
  dok_WartBrutto?: number | null;
  dok_Status?: number | null;
  dok_Pozycja?: SubiektDocumentLine[];
  kh__Kontrahent_Odbiorca?: SubiektKontrahent | null;
  kh__Kontrahent_Platnik?: SubiektKontrahent | null;
  [key: string]: unknown;
};
