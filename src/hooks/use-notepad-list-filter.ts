import { useCallback, useReducer } from "react";

type ListFilterState = {
  value: string;
  clearedForFocusId: string | null;
};

type ListFilterAction =
  | { type: "set"; value: string }
  | { type: "syncFocus"; focusWatchId: string };

function listFilterReducer(state: ListFilterState, action: ListFilterAction): ListFilterState {
  switch (action.type) {
    case "set":
      return { ...state, value: action.value };
    case "syncFocus":
      if (state.clearedForFocusId === action.focusWatchId) return state;
      return { value: "", clearedForFocusId: action.focusWatchId };
    default:
      return state;
  }
}

/** Filtr listy ZK — czyści się przy wejściu z linku (#watch-…), bez setState w renderze. */
export function useNotepadListFilter(focusWatchId: string | null | undefined, focusInList: boolean) {
  const [state, dispatch] = useReducer(listFilterReducer, {
    value: "",
    clearedForFocusId: null,
  });

  if (focusInList && focusWatchId && state.clearedForFocusId !== focusWatchId) {
    dispatch({ type: "syncFocus", focusWatchId });
  }

  const setListFilter = useCallback((value: string) => {
    dispatch({ type: "set", value });
  }, []);

  return [state.value, setListFilter] as const;
}
