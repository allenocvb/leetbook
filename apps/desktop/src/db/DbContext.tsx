import type { SqlExecutor } from "@leetbook/core";
import { createContext, type ReactNode, useContext } from "react";

const DbContext = createContext<SqlExecutor | null>(null);

export function DbProvider({ db, children }: { db: SqlExecutor; children: ReactNode }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): SqlExecutor {
  const db = useContext(DbContext);
  if (!db) throw new Error("useDb must be used inside <DbProvider>");
  return db;
}
