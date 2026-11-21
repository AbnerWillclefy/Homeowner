import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./table";

afterEach(cleanup);

it("puts aria-sort on the columnheader and calls onSort from its button", async () => {
  const onSort = vi.fn();
  render(
    <Table>
      <TableCaption>Transactions</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead sort="descending" onSort={onSort}>Date</TableHead>
          <TableHead align="end">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>11/24</TableCell>
          <TableCell align="end">10</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
  const header = screen.getByRole("columnheader", { name: "Date" });
  expect(header.getAttribute("aria-sort")).toBe("descending");
  expect(header.getAttribute("scope")).toBe("col");
  expect(screen.getByRole("columnheader", { name: "Amount" }).hasAttribute("aria-sort")).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Date" }));
  expect(onSort).toHaveBeenCalledOnce();
  expect(screen.getByRole("table", { name: "Transactions" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "10" }).className).toContain("tabular-nums");
});
