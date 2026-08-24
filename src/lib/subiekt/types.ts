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
  /** Filtr towarów po cesze (`ctw_Id`) — host ORDERS. */
  cechaId?: number;
  grupaId?: number;
};

/** Query GET /products/remanent — stan magazynowy na dzień (nie bieżący tw_Stan). */
export type SubiektRemanentParams = {
  page?: number;
  pageSize?: number;
  /** Data remanentu (włącznie); domyślnie dziś po stronie API. */
  naDzien?: string;
  magazynId?: number;
  grupaId?: number;
  cechaId?: number;
  towarId?: number;
  /** Osobny wiersz na towar + cenę partii. */
  grupujPoCenie?: boolean;
  /** Osobny wiersz na partię (mr_Id); wygrywa z grupujPoCenie. */
  rozbicieDostaw?: boolean;
  /** Domyślnie true w API — tylko ilosc > 0. */
  tylkoZIloscia?: boolean;
};

export type SubiektRemanentPozycja = {
  tw_Id: number;
  tw_Symbol?: string | null;
  tw_Nazwa?: string | null;
  tw_IdGrupa?: number | null;
  grt_Nazwa?: string | null;
  /** Pozostałość na magazynie na dzień remanentu. */
  ilosc?: number | null;
  cenaMag?: number | null;
  wartosc?: number | null;
  mr_Id?: number | null;
  mr_Data?: string | null;
  [key: string]: unknown;
};

export type SubiektRemanentData = {
  parametry?: {
    naDzien?: string | null;
    magazynId?: number | null;
    cechaId?: number | null;
    grupaId?: number | null;
    towarId?: number | null;
    rozbicieDostaw?: boolean | null;
    grupujPoCenie?: boolean | null;
    tylkoZIloscia?: boolean | null;
    [key: string]: unknown;
  } | null;
  sumaIlosc?: number | null;
  sumaWartosc?: number | null;
  pozycje?: SubiektRemanentPozycja[] | null;
};

/** Envelope remanentu — `data` to obiekt (nie tablica), paginacja dotyczy `pozycje`. */
export type SubiektRemanentEnvelope = {
  data: SubiektRemanentData;
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

/** Cecha towaru — GET /cechy/towarow */
export type SubiektProductCecha = {
  ctw_Id: number;
  ctw_Nazwa?: string | null;
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
  cechaId?: number | null;
  towarId?: number | null;
  tylkoBraki?: boolean | null;
  [key: string]: unknown;
};

/**
 * Pozycja kreatora ZD — GET /orders/zd/estimate.
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
  /**
   * Sprzedaż w oknie (jednostki karty SKU). API: FS + PA + WZ niepowiązane z FS/PA.
   * Breakdown WZ: `wzNiepowiazaneOkres` (te same jednostki).
   */
  sprzedazOkres?: number | null;
  /**
   * Udział WZ niepowiązanych w `sprzedazOkres` — te same jednostki co sprzedaż na linii.
   * OnTime nie dolicza ponownie do `sprzedazOkres`.
   */
  wzNiepowiazaneOkres?: number | null;
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

/**
 * Wiersz rozbicia ZK dla towaru — GET /orders/zd/estimate/zk.
 * Status 5/6 = bez rezerwacji; 7 = zarezerwowany (wchodzi w tw_StanRez).
 */
export type SubiektZdEstimateZkLine = {
  dok_Id: number;
  dok_Nr?: number | null;
  dok_NrPelny?: string | null;
  dok_Status?: number | null;
  dok_StatusNazwa?: string | null;
  dok_StatusOpis?: string | null;
  dok_DataWyst?: string | null;
  dok_OdbiorcaId?: number | null;
  kh_Symbol?: string | null;
  adr_Nazwa?: string | null;
  ob_Id?: number | null;
  ob_Ilosc?: number | null;
  bezRezerwacji?: boolean | null;
  [key: string]: unknown;
};

export type SubiektZdEstimateZkData = {
  podsumowanie: SubiektZdEstimateLine;
  pozycje: SubiektZdEstimateZkLine[];
};

export type SubiektZdEstimateZkParamsInput = {
  towarId: number;
  /** true (domyślnie w API) = tylko status 5/6; false = też 7 (zarezerwowane). */
  tylkoBezRez?: boolean;
  dataOd?: string;
  dataDo?: string;
  okres?: string;
  dniZapasu?: number;
  zapasMin?: number;
  zdDataOd?: string;
  zdDataDo?: string;
  zdOkres?: string;
  page?: number;
  pageSize?: number;
};

export type SubiektZdEstimateParamsInput = {
  dataOd?: string;
  dataDo?: string;
  dniZapasu?: number;
  zapasMin?: number;
  grupaId?: number;
  /** Filtr po cesze (`ctw_Id`) — XOR z grupaId po stronie OnTime. */
  cechaId?: number;
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
  adr_Kod?: string | null;
  adr_Poczta?: string | null;
  adr_Ulica?: string | null;
  /** Id państwa z kartoteki adresu (sl_Panstwo) — opcjonalne; do raportów preferuj ISO. */
  adr_IdPanstwo?: number | null;
  /** Nazwa państwa z JOIN na sl_Panstwo. */
  adr_Panstwo?: string | null;
  /** ISO 3166-1 alpha-2 z JOIN na sl_Panstwo (Sellout Ivoclar) — gdy API je zwraca. */
  pa_KodPanstwaISO?: string | null;
  [key: string]: unknown;
};

/** Państwo — GET /kraje */
export type SubiektPanstwo = {
  pa_Id: number;
  pa_Nazwa?: string | null;
  pa_KodPanstwaUE?: string | null;
  pa_CzlonekUE?: boolean | null;
  pa_KodPanstwaISO?: string | null;
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

/** Pozycja body POST /documents/zd/create (i ZK/WZ create). */
export type SubiektCreateDocumentLineInput = {
  towarId?: number;
  symbol?: string;
  ilosc: number;
  cenaNetto?: number | null;
};

/** Body POST /documents/zd/create — kontrahentId = dostawca (kh_Id). */
export type SubiektCreateZdInput = {
  kontrahentId: number;
  uwagi?: string | null;
  pozycje: SubiektCreateDocumentLineInput[];
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
  dok_StatusNazwa?: string | null;
  dok_Pozycja?: SubiektDocumentLine[];
  kh__Kontrahent_Odbiorca?: SubiektKontrahent | null;
  kh__Kontrahent_Platnik?: SubiektKontrahent | null;
  [key: string]: unknown;
};
