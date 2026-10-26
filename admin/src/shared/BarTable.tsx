import type { ReactNode } from "react";
import { barPercent } from "./range";

export interface BarColumn<T> {
  key: string;
  label: string;
  /** The number this column shows for a row's data. */
  value(data: T): number;
  /** What the cell shows instead of the number (a formatted figure); the bar still follows `value`. */
  display?(data: T): ReactNode;
}

export interface BarRow<T> {
  id: string;
  /** The row header, for example a date. */
  label: string;
  data: T;
}

interface Props<T> {
  caption: string;
  /** The header of the row-header column. */
  rowHeader: string;
  columns: BarColumn<T>[];
  rows: BarRow<T>[];
}

function Head<T>({ rowHeader, columns }: Pick<Props<T>, "rowHeader" | "columns">) {
  return (
    <thead>
      <tr>
        <th scope="col" className="border-b-2 border-border px-3 py-2 align-bottom">
          {rowHeader}
        </th>
        {columns.map((column) => (
          <th key={column.key} scope="col" className="border-b-2 border-border px-3 py-2 align-bottom">
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * A semantic table with a bar behind each number. The number is the cell's text, so a screen reader reads values
 * and never meets the bar (aria-hidden). Each column's bars scale to its own largest value; with a largest of 0
 * there is no bar, only the 0. The bar is a decorative extra: the number carries the meaning.
 */
export function BarTable<T>({ caption, rowHeader, columns, rows }: Props<T>) {
  const maxima = columns.map((column) => Math.max(0, ...rows.map((row) => column.value(row.data))));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left tabular-nums">
        <caption className="pb-2 text-left font-semibold">{caption}</caption>
        <Head rowHeader={rowHeader} columns={columns} />
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="whitespace-nowrap border-b border-border px-3 py-2 font-normal">
                {row.label}
              </th>
              {columns.map((column, i) => {
                const value = column.value(row.data);
                const percent = barPercent(value, maxima[i]);
                return (
                  <td key={column.key} className="relative min-w-20 border-b border-border px-3 py-2">
                    {percent > 0 && (
                      <div
                        aria-hidden="true"
                        data-bar=""
                        className="absolute inset-y-1 left-0 rounded-r-control border-r-2 border-accent bg-accent/25"
                        style={{ width: `${percent}%` }}
                      />
                    )}
                    <span className="relative">{column.display ? column.display(row.data) : value}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The table's shape before the data arrives: the right number of rows, so the layout does not jump. */
export function BarTableSkeleton<T>({ caption, rowHeader, columns, rowCount }: Omit<Props<T>, "rows"> & { rowCount: number }) {
  const block = "inline-block h-4 rounded-control bg-border/40 motion-safe:animate-pulse";
  return (
    <div className="overflow-x-auto" aria-busy="true">
      <table className="w-full border-collapse text-left">
        <caption className="pb-2 text-left font-semibold">{caption}</caption>
        <Head rowHeader={rowHeader} columns={columns} />
        <tbody>
          {Array.from({ length: rowCount }, (_, row) => (
            <tr key={row}>
              <td className="border-b border-border px-3 py-2">
                <span aria-hidden="true" className={`${block} w-20`} />
              </td>
              {columns.map((column) => (
                <td key={column.key} className="border-b border-border px-3 py-2">
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
