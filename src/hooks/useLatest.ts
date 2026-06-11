import { useEffect, useRef } from "react";

/** Aktualna wartość w ref — do zapisu w useTransition bez starego stanu formularza. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
