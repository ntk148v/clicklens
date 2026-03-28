import { useState } from "react";

export interface UseSqlUIReturn {
  historyOpen: boolean;
  savedQueriesOpen: boolean;
  saveDialogOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  setSavedQueriesOpen: (open: boolean) => void;
  setSaveDialogOpen: (open: boolean) => void;
}

export function useSqlUI(): UseSqlUIReturn {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedQueriesOpen, setSavedQueriesOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  return {
    historyOpen,
    savedQueriesOpen,
    saveDialogOpen,
    setHistoryOpen,
    setSavedQueriesOpen,
    setSaveDialogOpen,
  };
}