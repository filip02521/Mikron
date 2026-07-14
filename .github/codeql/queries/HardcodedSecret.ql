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
predicate isSecretVarName(string varName) {
  varName.matches("%SECRET%") or
  varName.matches("%secret%") or
  varName.matches("%API_KEY%") or
  varName.matches("%apiKey%") or
  varName.matches("%APIKEY%") or
  varName.matches("%TOKEN%") or
  varName.matches("%token%") or
  varName.matches("%PASSWORD%") or
  varName.matches("%password%") or
  varName.matches("%PRIVATE_KEY%") or
  varName.matches("%privateKey%")
}

/** String literal wygląda jak klucz/token (długość > 16, zawiera alphanum). */
predicate looksLikeSecret(StringLiteral s) {
  s.getValue().length() > 16 and
  s.getValue().regexpMatch("[A-Za-z0-9_\\-]{16,}")
}

from VariableDeclarator v, StringLiteral s
where
  isSecretVarName(v.getBindingPattern().getName()) and
  v.getInit() = s and
  looksLikeSecret(s) and
  // Wyklucz pliki testowe i konfiguracyjne
  not v.getFile().getAbsolutePath().regexpMatch(".*\\.test\\..*") and
  not v.getFile().getAbsolutePath().regexpMatch(".*\\.spec\\..*") and
  not v.getFile().getAbsolutePath().regexpMatch(".*scripts/.*")
select v, "Potencjalnie hardcoded sekret w zmiennej '" + v.getBindingPattern().getName() + "' — użyj zmiennej środowiskowej."
