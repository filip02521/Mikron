/**
 * @name Hardcoded secret or API key
 * @description Detects string literals that look like API keys, secrets, or
 *              tokens assigned to variables with suspicious names. Catches
 *              accidental commits of credentials that env-based patterns miss.
 * @kind problem
 * @id js/mikron/hardcoded-secret
 * @problem.severity error
 * @tags security
 */

import javascript

/** Nazwa zmiennej sugeruje sekret lub klucz. */
predicate isSecretVarName(string name) {
  name.matches("%SECRET%") or
  name.matches("%secret%") or
  name.matches("%API_KEY%") or
  name.matches("%apiKey%") or
  name.matches("%APIKEY%") or
  name.matches("%TOKEN%") or
  name.matches("%token%") or
  name.matches("%PASSWORD%") or
  name.matches("%password%") or
  name.matches("%PRIVATE_KEY%") or
  name.matches("%privateKey%")
}

/** String literal wygląda jak klucz/token (długość > 16, zawiera alphanum). */
predicate looksLikeSecret(StringLiteral s) {
  s.getValue().length() > 16 and
  s.getValue().regexpMatch("[A-Za-z0-9_\\-]{16,}")
}

from VarDecl v, StringLiteral s
where
  isSecretVarName(v.getName()) and
  v.getInit() = s and
  looksLikeSecret(s) and
  // Wyklucz pliki testowe i konfiguracyjne
  not v.getFile().getPath().regexpMatch(".*\\.test\\..*") and
  not v.getFile().getPath().regexpMatch(".*\\.spec\\..*") and
  not v.getFile().getPath().regexpMatch(".*scripts/.*")
select v, "Potencjalnie hardcoded sekret w zmiennej '" + v.getName() + "' — użyj zmiennej środowiskowej."
