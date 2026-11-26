import { CookingPot, Shirt } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../src";
import { TaskCard } from "../../src/home";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    kitchen: "Cozinha", laundry: "Roupas", dishes: "Lavar a louça", clothes: "Estender a roupa", why: "Leve, para um dia de energia baixa. Ninguém lava desde ontem.",
    effort: ["Leve", "Esforço: leve"], medium: ["Médio", "Esforço: médio"], accept: "Aceitar Lavar a louça", decline: "Recusar Lavar a louça", finish: "Concluir Estender a roupa",
    take: "Pegar Lavar a louça", undo: "Desfazer", taken: "Assumida", doneAt: "Concluída às 9:02", menu: "Opções da tarefa", close: "Fechar", swap: "Trocar", details: "Ver detalhes",
    opened: "Aberta:", none: "nenhuma", ana: "Ana", longName: "Passar o aspirador na sala, nos quartos e no corredor de cima",
  },
  en: {
    kitchen: "Kitchen", laundry: "Laundry", dishes: "Wash the dishes", clothes: "Hang the washing", why: "Light, for a low-energy day. Nobody has washed since yesterday.",
    effort: ["Light", "Effort: light"], medium: ["Medium", "Effort: medium"], accept: "Accept Wash the dishes", decline: "Decline Wash the dishes", finish: "Finish Hang the washing",
    take: "Take Wash the dishes", undo: "Undo", taken: "Taken", doneAt: "Done at 9:02", menu: "Task options", close: "Close", swap: "Swap", details: "See details",
    opened: "Opened:", none: "none", ana: "Ana", longName: "Vacuum the living room, the bedrooms and the upstairs hall",
  },
};

export default function TaskCardSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [opened, setOpened] = useState<string>();
  const kitchen = { tone: "kitchen", icon: CookingPot } as const;
  const laundry = { tone: "laundry", icon: Shirt } as const;
  const light = { level: 2, name: t.effort[0]!, label: t.effort[1]! } as const;
  const menu = { label: t.menu, closeLabel: t.close, items: [{ label: t.swap, onSelect() {} }, { label: t.details, onSelect() {} }] };
  const none = () => {};
  return (
    <Section name="TaskCard">
      <p className="body text-text-muted">
        {t.opened} {opened ?? t.none}
      </p>
      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
        <TaskCard
          category={kitchen} categoryLabel={t.kitchen} name={t.dishes} effort={light} why={t.why} menu={menu}
          onOpen={() => setOpened(t.dishes)}
          actions={[{ label: t.decline, onClick: none, variant: "secondary" }, { label: t.accept, onClick: none }]}
        />
        <TaskCard
          category={laundry} categoryLabel={t.laundry} name={t.clothes} effort={{ level: 3, name: t.medium[0]!, label: t.medium[1]! }}
          why={t.why} menu={menu} status={t.taken} onOpen={() => setOpened(t.clothes)}
          actions={[{ label: t.finish, onClick: none }]}
        />
        <TaskCard category={kitchen} categoryLabel={t.kitchen} name={t.dishes} effort={light} caption={t.doneAt} why={t.why} done
          actions={[{ label: t.undo, onClick: none, variant: "ghost" }]} />
        <TaskCard category={laundry} categoryLabel={t.laundry} name={t.longName} effort={light} why={t.why} trailing={<Avatar size="sm" initials="AN" />} />
        <TaskCard category={kitchen} categoryLabel={t.kitchen} name={t.dishes} effort={light} why={t.why} actions={[{ label: t.take, onClick: none, variant: "secondary" }]} />
      </div>
    </Section>
  );
}
