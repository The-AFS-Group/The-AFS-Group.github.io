// src/components/DataTable.tsx
import { useState } from "react";

type Align = "left" | "right" | "center";

interface Column<T extends Record<string, unknown>> {
  key: keyof T & string;
  label: string;
  format?: (value: T[keyof T & string]) => string;
  align?: Align;
  /** Mark this column as the primary name/label column — bolder, darker text */
  isName?: boolean;
  /** Hover definition shown on the column header (native title tooltip) */
  tooltip?: string;
  /** Secondary muted line under the cell value (e.g. "BROAD · Campaign name") */
  sub?: (row: T) => string;
  /** When set and truthy for a row, the cell value renders as a link (new tab) */
  href?: (row: T) => string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  sortable?: boolean;
}

type SortDir = "asc" | "desc" | null;

function alignClass(align?: Align): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  sortable = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  function handleHeaderClick(key: string) {
    if (!sortable) return;

    if (sortKey === key) {
      // desc → asc → off (metrics tables: biggest-first is the useful default)
      const next: SortDir = sortDir === "desc" ? "asc" : sortDir === "asc" ? null : "desc";
      setSortDir(next);
      if (next === null) setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedRows = [...rows];
  if (sortable && sortKey && sortDir) {
    sortedRows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Numbers sort numerically (null/undefined treated as smallest);
      // everything else falls back to string compare.
      const an = typeof av === "number" ? av : av == null ? null : Number.NaN;
      const bn = typeof bv === "number" ? bv : bv == null ? null : Number.NaN;
      if ((an !== null && !Number.isNaN(an)) || (bn !== null && !Number.isNaN(bn))) {
        const x = an ?? Number.NEGATIVE_INFINITY;
        const y = bn ?? Number.NEGATIVE_INFINITY;
        const xs = Number.isNaN(x) ? Number.NEGATIVE_INFINITY : x;
        const ys = Number.isNaN(y) ? Number.NEGATIVE_INFINITY : y;
        return sortDir === "asc" ? xs - ys : ys - xs;
      }
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  return (
    <div
      className="dash-card overflow-hidden"
      style={{ padding: 0 }}
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse" style={{ fontFamily: "var(--font-body)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              {columns.map(col => {
                const isActiveSort = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    title={col.tooltip}
                    className={[
                      "py-2.5 px-3 text-[11px] uppercase tracking-wide font-semibold whitespace-nowrap select-none",
                      alignClass(col.align),
                      sortable ? "cursor-pointer" : "",
                    ].join(" ")}
                    style={{
                      color: isActiveSort ? "var(--gaf-primary)" : "var(--gaf-text-muted)",
                      cursor: col.tooltip && !sortable ? "help" : undefined,
                    }}
                    onClick={() => handleHeaderClick(col.key)}
                    onMouseEnter={e => {
                      if (sortable && !isActiveSort) {
                        (e.currentTarget as HTMLElement).style.color = "#374151";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActiveSort) {
                        (e.currentTarget as HTMLElement).style.color = "var(--gaf-text-muted)";
                      }
                    }}
                  >
                    {col.label}
                    {isActiveSort && sortDir === "asc" && (
                      <span className="ml-1" aria-hidden="true">&#9650;</span>
                    )}
                    {isActiveSort && sortDir === "desc" && (
                      <span className="ml-1" aria-hidden="true">&#9660;</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="transition-colors last:border-0"
                style={{ borderBottom: "1px solid var(--gaf-row-border)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                {columns.map((col, colIdx) => {
                  const raw = row[col.key];
                  const cell = col.format ? col.format(raw) : String(raw ?? "");
                  const isName = col.isName ?? colIdx === 0;
                  const sub = col.sub ? col.sub(row) : "";
                  const link = col.href ? col.href(row) : "";
                  return (
                    <td
                      key={col.key}
                      className={["py-2.5 px-3 text-sm", alignClass(col.align)].join(" ")}
                      style={{
                        color: isName ? "#111827" : "var(--gaf-text-secondary)",
                        fontWeight: isName ? 500 : 400,
                        fontVariantNumeric: col.align === "right" ? "tabular-nums" : undefined,
                      }}
                    >
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                          style={{ color: "inherit" }}
                        >
                          {cell}
                        </a>
                      ) : cell}
                      {sub && (
                        <div
                          className="text-[11px] font-normal truncate max-w-[280px]"
                          style={{ color: "var(--gaf-text-muted)" }}
                          title={sub}
                        >
                          {sub}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-sm"
                  style={{ color: "var(--gaf-text-muted)" }}
                >
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
