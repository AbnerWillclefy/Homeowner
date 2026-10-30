import type { ReactNode } from "react";

export interface DataColumn<T> {
  key: string;
  label: string;
  /** The number this column shows for a row's data. */
  value(data: T): number;
  /** What the cell shows instead of the number (a formatted figure). */
  display?(data: T): ReactNode;
}

export interface DataRow<T> {
  id: string;
  /** The row header, for example a date. */
  label: ReactNode;
  data: T;
}

interface Props<T> {
  caption: string;
  /** The header of the row-header column. */
  rowHeader: string;
  columns: DataColumn<T>[];
  rows: DataRow<T>[];
  /** Shown in place of the rows when there are none. */
  empty?: string;
}

// Swiss-style table: small uppercase headers, hairline rows, numbers right-aligned in the mono face.
const HEAD = "border-b border-border px-3 py-2 align-bottom text-xs font-semibold uppercase tracking-wide text-muted";
const CELL = "border-b border-border/40 px-3 py-1.5";
const CAPTION = "pb-2 text-left text-sm font-semibold";

function Head<T>({ rowHeader, columns }: Pick<Props<T>, "rowHeader" | "columns">) {
  return (
    <thead>
      <tr>
        <th scope="col" className={HEAD}>
          {rowHeader}
        </th>
        {columns.map((column) => (
          <th key={column.key} scope="col" className={`${HEAD} text-right`}>
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** A semantic table of numbers: a caption, a header row, and a row header per row. */
export function DataTable<T>({ caption, rowHeader, columns, rows, empty }: Props<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className={CAPTION}>{caption}</caption>
        <Head rowHeader={rowHeader} columns={columns} />
        <tbody>
          {rows.length === 0 && empty !== undefined && (
            <tr>
              <td colSpan={columns.length + 1} className={`${CELL} text-muted`}>
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface">
              <th scope="row" className={`${CELL} whitespace-nowrap font-normal`}>
                {row.label}
              </th>
              {columns.map((column) => (
                <td key={column.key} className={`${CELL} text-right font-mono tabular-nums`}>
                  {column.display ? column.display(row.data) : column.value(row.data)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The table's shape before the data arrives: the right number of rows, so the layout does not jump. */
export function DataTableSkeleton<T>({ caption, rowHeader, columns, rowCount }: Omit<Props<T>, "rows" | "empty"> & { rowCount: number }) {
  const block = "inline-block h-4 rounded-control bg-border/40 motion-safe:animate-pulse";
  return (
    <div className="overflow-x-auto" aria-busy="true">
      <table className="w-full border-collapse text-left text-sm">
        <caption className={CAPTION}>{caption}</caption>
        <Head rowHeader={rowHeader} columns={columns} />
        <tbody>
          {Array.from({ length: rowCount }, (_, row) => (
            <tr key={row}>
              <td className={CELL}>
                <span aria-hidden="true" className={`${block} w-20`} />
              </td>
              {columns.map((column) => (
                <td key={column.key} className={`${CELL} text-right`}>
                  <span aria-hidden="true" className={`${block} w-8`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
