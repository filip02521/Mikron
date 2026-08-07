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

export type SubiektListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  symbol?: string;
  email?: string;
  id?: number | string;
  /** Towar — tw_PLU (Kod Mikran). */
  plu?: string;
  /** Kontrahent (kh_Id) — w query nie filtruje listy ZD; używaj {@link zdListItemMatchesSupplierKhIds}. */
  khId?: number;
  /** Status dokumentu ZD — filtr API nieskuteczny; ETA filtruje 5/6/7 po stronie aplikacji. */
  status?: number;
  name?: string;
  limit?: number;
  typ?: number;
  dataOd?: string;
  dataDo?: string;
  includeBlocked?: boolean;
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
  tw_IdGrupa?: number | null;
  grt_Nazwa?: string | null;
  tw_Stan?: number | null;
  tw_StanRez?: number | null;
  [key: string]: unknown;
};

/** grupa towarowa — GET /groups */
export type SubiektProductGroup = {
  grt_Id: number;
  grt_Nazwa?: string | null;
  [key: string]: unknown;
};

/** Parametry wywołania GET /orders/zd/estimate (echo z API). */
export type SubiektZdEstimateParams = {
  dataOd?: string | null;
  dataDo?: string | null;
  dniOkresu?: number | null;
  dniZapasu?: number | null;
  zapasMin?: number | null;
  grupaId?: number | null;
  towarId?: number | null;
  tylkoBraki?: boolean | null;
  [key: string]: unknown;
};

/**
 * Pozycja szacunku ZD — GET /orders/zd/estimate.
 * Wzór API: doZamowienia = max(0, celZapasu + otwarteZkBezRez − dostepne − otwarteZd).
 */
export type SubiektZdEstimateLine = {
  tw_Id: number;
  tw_Symbol?: string | null;
  tw_Nazwa?: string | null;
  tw_IdGrupa?: number | null;
  grt_Nazwa?: string | null;
  tw_Stan?: number | null;
  tw_StanRez?: number | null;
  dostepne?: number | null;
  sprzedazOkres?: number | null;
  sprzedazDziennie?: number | null;
  celZapasu?: number | null;
  otwarteZkBezRez?: number | null;
  otwarteZkZarezerwowane?: number | null;
  otwarteZd?: number | null;
  doZamowienia?: number | null;
  [key: string]: unknown;
};

export type SubiektZdEstimateData = {
  parametry: SubiektZdEstimateParams;
  pozycje: SubiektZdEstimateLine[];
};

export type SubiektZdEstimateParamsInput = {
  dataOd?: string;
  dataDo?: string;
  dniZapasu?: number;
  zapasMin?: number;
  grupaId?: number;
  towarId?: number;
  tylkoBraki?: boolean;
  page?: number;
  pageSize?: number;
};

/** kontrahent + adres (adr_TypAdresu = 1) */
export type SubiektKontrahent = {
  kh_Id: number;
  kh_Symbol?: string | null;
  kh_EMail?: string | null;
  adr_Telefon?: string | null;
  kh_Telefon?: string | null;
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
