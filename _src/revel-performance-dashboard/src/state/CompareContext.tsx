import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface CompareContextValue {
  /** Show period-on-period movement under every table metric. */
  compare: boolean;
  setCompare: (on: boolean) => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

/**
 * Comparison is a global preference rather than per-table state: switching it
 * on to chase a movement and then losing it on every tab change would make it
 * useless for exactly the job it exists to do.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [compare, setCompare] = useState(true);
  return (
    <CompareContext.Provider value={{ compare, setCompare }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error("useCompare must be used inside CompareProvider");
  }
  return ctx;
}
