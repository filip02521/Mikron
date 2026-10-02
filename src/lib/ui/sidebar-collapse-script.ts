/** Wspólne dla serwera i klienta (bez "use client" — stała musi być zwykłym stringiem). */

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "appSidebarCollapsed";

/** Inline w <head>: `<html data-sidebar="collapsed">` z localStorage przed pierwszym malowaniem. */
export const SIDEBAR_COLLAPSE_SCRIPT = `(function(){try{if(localStorage.getItem("${SIDEBAR_COLLAPSED_STORAGE_KEY}")==="1"){document.documentElement.setAttribute("data-sidebar","collapsed");}}catch(e){}})();`;
