import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Window } from "../lib/data";

interface DateRangeContextValue {
  window: Window;
  setWindow: (w: Window) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [window, setWindow] = useState<Window>("30d");
  return (
    <DateRangeContext.Provider value={{ window, setWindow }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) {
    throw new Error("useDateRange must be used inside DateRangeProvider");
  }
  return ctx;
}
