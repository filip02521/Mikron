import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Stabilna referencja funkcji, która zawsze woła najnowszą wersję `fn`.
 * Do handlerów zdarzeń przekazywanych do `memo` komponentów (np. wierszy tabeli) —
 * nie wolno wołać w trakcie renderu (ref aktualizowany w layout effect).
 */
export function useStableCallback<A extends unknown[], R>(
  fn: (...args: A) => R
): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
