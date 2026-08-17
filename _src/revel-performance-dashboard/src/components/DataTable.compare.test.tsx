// src/components/DataTable.compare.test.tsx
// Period-on-period comparison rendering inside table cells.
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DataTable } from "./DataTable";

type Row = Record<string, unknown>;

const COLUMNS = [
  { key: "name", label: "Campaign", align: "left" as const },
  { key: "spend", label: "Spend", align: "right" as const, format: (v: unknown) => `$${v}` },
  { key: "cpa", label: "CPA", align: "right" as const, format: (v: unknown) => `$${v}`, invert: true },
];

const ROWS: Row[] = [
  { name: "Grew", spend: 150, cpa: 20, d: { spend: 50, cpa: -12.5 } },
  { name: "Fresh", spend: 40, cpa: 10, isNew: true },
  { name: "Unknown", spend: 10, cpa: 5 },
];

/** Cells of the row whose name column reads `name`, in column order. */
function cells(name: string): HTMLTableCellElement[] {
  const row = screen.getByText(name).closest("tr") as HTMLElement;
  return Array.from(row.querySelectorAll("td"));
}

/** The colour the Delta component painted inside a cell. */
function deltaColour(cell: HTMLElement): string {
  const span = cell.querySelector("span[style*='color']") as HTMLElement | null;
  return span?.style.color ?? "";
}

describe("DataTable comparison mode", () => {
  it("renders no deltas when compare is off", () => {
    render(<DataTable<Row> columns={COLUMNS} rows={ROWS} />);
    expect(screen.queryByText(/\+50\.0%/)).toBeNull();
    expect(screen.queryByText("New")).toBeNull();
  });

  it("shows the delta beneath each metric value when compare is on", () => {
    render(<DataTable<Row> columns={COLUMNS} rows={ROWS} compare />);
    const [, spendCell, cpaCell] = cells("Grew");
    expect(spendCell.textContent).toContain("$150");
    expect(spendCell.textContent).toContain("+50.0%");
    expect(cpaCell.textContent).toContain("$20");
    expect(cpaCell.textContent).toContain("-12.5%");
  });

  it("colours a falling cost metric as good and a rising spend as good", () => {
    render(<DataTable<Row> columns={COLUMNS} rows={ROWS} compare />);
    const [, spendCell, cpaCell] = cells("Grew");
    // CPA fell 12.5% — invert:true makes that an improvement.
    expect(deltaColour(cpaCell)).toBe("var(--gaf-delta-pos)");
    expect(deltaColour(spendCell)).toBe("var(--gaf-delta-pos)");
  });

  it("keeps the arrow pointing at the real direction of movement", () => {
    render(<DataTable<Row> columns={COLUMNS} rows={ROWS} compare />);
    const [, , cpaCell] = cells("Grew");
    // Green, but still a downward arrow: CPA genuinely fell.
    expect(cpaCell.textContent).toContain("▼");
  });

  it("marks rows that had no prior-period counterpart as New", () => {
    render(<DataTable<Row> columns={COLUMNS} rows={ROWS} compare />);
    expect(within(cells("Fresh")[0]).getByText("New")).toBeInTheDocument();
    expect(cells("Fresh")[1].textContent).toBe("$40");
  });

  it("shows neither delta nor New when the prior period is simply unknown", () => {
    render(<DataTable<Row> columns={COLUMNS} rows={ROWS} compare />);
    const [nameCell, spendCell] = cells("Unknown");
    expect(within(nameCell).queryByText("New")).toBeNull();
    expect(spendCell.textContent).toBe("$10");
  });

  it("does not put a delta on the name column", () => {
    render(
      <DataTable<Row>
        columns={COLUMNS}
        rows={[{ name: "Grew", spend: 150, cpa: 1, d: { name: 99, spend: 50 } }]}
        compare
      />
    );
    expect(cells("Grew")[0].textContent).toBe("Grew");
  });
});
