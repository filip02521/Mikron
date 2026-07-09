"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useSeenChangelogVersion,
  setSeenChangelogVersion,
} from "@/lib/changelog/changelog-version-store";
import { CHANGELOG_LATEST_VERSION } from "@/lib/changelog/changelog-entries";
import { ChangelogModal } from "@/components/changelog/ChangelogModal";
import type { UserRole } from "@/types/database";

type ChangelogContextValue = {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  hasUnseen: boolean;
};

const ChangelogContext = createContext<ChangelogContextValue | null>(null);

export function useChangelog(): ChangelogContextValue {
  const ctx = useContext(ChangelogContext);
  if (!ctx) {
    throw new Error("useChangelog must be used within ChangelogProvider");
  }
  return ctx;
}

export function ChangelogProvider({
  role,
  children,
}: {
  role: UserRole | null;
  children: ReactNode;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const seenVersion = useSeenChangelogVersion();
  const hasUnseen = seenVersion !== CHANGELOG_LATEST_VERSION;

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSeenChangelogVersion(CHANGELOG_LATEST_VERSION);
  }, []);

  const value = useMemo<ChangelogContextValue>(
    () => ({ isModalOpen, openModal, closeModal, hasUnseen }),
    [isModalOpen, openModal, closeModal, hasUnseen],
  );

  return (
    <ChangelogContext.Provider value={value}>
      {children}
      <ChangelogModal
        open={isModalOpen}
        onClose={closeModal}
        role={role}
      />
    </ChangelogContext.Provider>
  );
}
