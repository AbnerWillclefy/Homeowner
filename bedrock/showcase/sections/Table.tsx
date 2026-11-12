import { SearchX } from "lucide-react";
import { useState } from "react";
import { EmptyState, Skeleton, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    name: "Table", caption: "Transações de novembro", date: "Data", desc: "Descrição", amount: "Valor",
    loaded: "Carregada", loading: "Carregando", empty: "Vazia", clickable: "Linha clicável",
    emptyTitle: "Nada encontrado", emptyMessage: "Nenhuma transação combina com esses filtros.", clear: "Limpar filtros",
    rows: [["24/11", "Mercado", "R$ 189,90"], ["23/11", "Aluguel", "R$ 2.500,00"], ["20/11", "Transferência recebida", "R$ 1.200,00"]],
  },
  en: {
    name: "Table", caption: "November transactions", date: "Date", desc: "Description", amount: "Amount",
    loaded: "Loaded", loading: "Loading", empty: "Empty", clickable: "Clickable row",
    emptyTitle: "Nothing found", emptyMessage: "No transaction matches these filters.", clear: "Clear filters",
    rows: [["11/24", "Groceries", "$189.90"], ["11/23", "Rent", "$2,500.00"], ["11/20", "Transfer received", "$1,200.00"]],
  },
};

export default function TableSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [desc, setDesc] = useState(true);
  const [opened, setOpened] = useState<string | null>(null);
  const rows = desc ? t.rows : [...t.rows].reverse();
  const head = (
    <TableHeader>
      <TableRow>
        <TableHead sort={desc ? "descending" : "ascending"} onSort={() => setDesc(!desc)}>{t.date}</TableHead>
        <TableHead>{t.desc}</TableHead>
        <TableHead align="end">{t.amount}</TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <Section name={t.name}>
      <p className="label text-text-muted">{t.loaded}</p>
      <Table>
        <TableCaption className="sr-only">{t.caption}</TableCaption>
        {head}
        <TableBody>
          {rows.map(([d, n, v]) => (
            <TableRow key={n}>
              <TableCell>{d}</TableCell>
              <TableCell>{n}</TableCell>
              <TableCell align="end">{v}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="label text-text-muted">{t.clickable}</p>
      <Table>
        <TableCaption className="sr-only">{t.caption}</TableCaption>
        {head}
        <TableBody>
          {rows.map(([d, n, v]) => (
            <TableRow key={n}>
              <TableCell>
                <button type="button" onClick={() => setOpened(n)} className="outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus">
                  {d}
                </button>
              </TableCell>
              <TableCell>{n}</TableCell>
              <TableCell align="end">{v}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {opened && <p className="body text-text-muted" role="status">{opened}</p>}

      <p className="label text-text-muted">{t.loading}</p>
      <Table aria-busy>
        <TableCaption className="sr-only">{t.caption}</TableCaption>
        {head}
        <TableBody>
          {[0, 1, 2].map((i) => (
            <TableRow key={i}>
              {[0, 1, 2].map((j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-2/3" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="label text-text-muted">{t.empty}</p>
      <Table>
        <TableCaption className="sr-only">{t.caption}</TableCaption>
        {head}
      </Table>
      <EmptyState kind="no-results" icon={SearchX} title={t.emptyTitle} message={t.emptyMessage} action={{ label: t.clear, onClick: () => {} }} />
    </Section>
  );
}
