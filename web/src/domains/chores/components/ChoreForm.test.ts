// @vitest-environment jsdom
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountWithI18n } from "../../../shared/ui/testing";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { I18nContext } from "../../../shared/i18n/context";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Resident } from "../../residents/api/api";
import { chore } from "../testing/fixtures";
import { emptyForm } from "../logic/form";

const api = vi.hoisted(() => ({ setResponsible: vi.fn(), clearResponsible: vi.fn(), updateChore: vi.fn() }));
vi.mock("../api/api", async (original) => ({ ...(await original<typeof import("../api/api")>()), ...api }));

import { ChoreForm } from "./ChoreForm";

const RESIDENTS = [
  { id: "r1", you: true, name: "Ana" },
  { id: "r2", you: false, name: "Bia" },
] as Resident[];

const base = { mode: "create" as const, idKey: "t", categories: ["kitchen"], demands: ["lifting"], onCancel: () => {} };

function props(over: Record<string, unknown> = {}) {
  return {
    ...base,
    initial: { ...emptyForm(), name: "Lavar a louça", category: "kitchen" },
    save: vi.fn(() => Promise.resolve({ kind: "ok" as const, chore: chore("c1", "Lavar a louça") })),
    onSaved: vi.fn(),
    responsible: { residents: RESIDENTS, reloadResidents: vi.fn(), onStored: vi.fn(), existing: null },
    ...over,
  };
}

beforeEach(() => vi.resetAllMocks());

describe("ChoreForm Responsible field", () => {
  const { render, container } = mountWithI18n();
  const select = () => container().querySelector<HTMLSelectElement>("select[id$=-responsible]")!;
  const submit = () => act(async () => void container().querySelector("form")!.requestSubmit());
  const choose = (value: string) =>
    act(() => {
      const el = select();
      el.value = value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

  it("defaults to Nobody and lists the Residents", () => {
    render(createElement(ChoreForm, props()));
    expect(select().value).toBe("");
    expect([...select().options].map((o) => o.textContent)).toEqual(["Nobody", "Ana", "Bia"]);
  });

  it("is absent where the form is given no field (onboarding)", () => {
    render(createElement(ChoreForm, props({ responsible: undefined })));
    expect(select()).toBeNull();
  });

  it("is disabled and shows only the current value while the Residents are not ready", () => {
    const withBia = { ...emptyForm(), responsible: "r2" };
    render(createElement(ChoreForm, props({ initial: withBia, responsible: { ...props().responsible, residents: null } })));
    expect(select().disabled).toBe(true);
    expect(select().options).toHaveLength(2);
    expect(select().value).toBe("r2");
  });

  it("saves the Chore, then the chosen Resident", async () => {
    api.setResponsible.mockResolvedValue({ kind: "ok" });
    const p = props();
    render(createElement(ChoreForm, p));
    await choose("r2");
    await submit();
    expect(p.save).toHaveBeenCalledTimes(1);
    expect(api.setResponsible).toHaveBeenCalledWith("c1", "r2");
    expect(p.onSaved.mock.calls[0]![0].responsibleResidentId).toBe("r2");
  });

  it("clears the Resident when Nobody is chosen on a Chore that had one", async () => {
    api.clearResponsible.mockResolvedValue({ kind: "ok" });
    const existing = { ...chore("c1", "Lavar a louça"), responsibleResidentId: "r2" };
    const p = props({
      mode: "edit",
      initial: { ...emptyForm(), name: "Lavar a louça", responsible: "r2" },
      save: vi.fn(() => Promise.resolve({ kind: "ok" as const, chore: existing })),
      responsible: { ...props().responsible, existing },
    });
    render(createElement(ChoreForm, p));
    await choose("");
    await submit();
    expect(api.clearResponsible).toHaveBeenCalledWith("c1");
    expect(p.onSaved.mock.calls[0]![0].responsibleResidentId).toBeNull();
  });

  it("leaves the Resident alone when an edit does not touch the field", async () => {
    const existing = { ...chore("c1", "Lavar a louça"), responsibleResidentId: "r2" };
    const p = props({
      mode: "edit",
      initial: { ...emptyForm(), name: "Lavar a louça", responsible: "r2" },
      save: vi.fn(() => Promise.resolve({ kind: "ok" as const, chore: existing })),
      responsible: { ...props().responsible, existing },
    });
    render(createElement(ChoreForm, p));
    await submit();
    expect(api.setResponsible).not.toHaveBeenCalled();
    expect(api.clearResponsible).not.toHaveBeenCalled();
    expect(p.onSaved.mock.calls[0]![0].responsibleResidentId).toBe("r2");
  });

  it("keeps a responsible Resident the stale list lacks when an edit does not touch the field", async () => {
    const existing = { ...chore("c1", "Lavar a louça"), responsibleResidentId: "r9" };
    const p = props({
      mode: "edit",
      initial: { ...emptyForm(), name: "Lavar a louça", responsible: "r9" },
      save: vi.fn(() => Promise.resolve({ kind: "ok" as const, chore: existing })),
      responsible: { ...props().responsible, existing },
    });
    render(createElement(ChoreForm, p));
    await submit();
    expect(api.clearResponsible).not.toHaveBeenCalled();
    expect(api.setResponsible).not.toHaveBeenCalled();
    expect(p.onSaved).toHaveBeenCalledTimes(1);
  });

  it("explains a refusal naming the Resident, ties it to the field and keeps what was typed", async () => {
    api.setResponsible.mockResolvedValue({ kind: "restricted", residentId: "r2", restrictedBy: ["heavy_lifting"], restrictedByChore: false });
    const p = props();
    render(createElement(ChoreForm, p));
    await choose("r2");
    await submit();
    const alert = container().querySelector<HTMLElement>("#chore-form-t-responsible-error")!;
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toContain("Bia");
    expect(alert.textContent).toContain("Heavy lifting");
    expect(select().getAttribute("aria-describedby")).toContain(alert.id);
    expect(select().value).toBe("r2");
    expect(container().querySelector<HTMLInputElement>("input[type=text]")!.value).toBe("Lavar a louça");
    expect(p.onSaved).not.toHaveBeenCalled();
    expect(p.responsible.onStored).toHaveBeenCalledTimes(1);
  });

  it("says a Resident is gone and reads the list again", async () => {
    api.setResponsible.mockResolvedValue({ kind: "unknown-resident" });
    const p = props();
    render(createElement(ChoreForm, p));
    await choose("r2");
    await submit();
    expect(container().querySelector("#chore-form-t-responsible-error")!.textContent).toContain("no longer in the Home");
    expect(p.responsible.reloadResidents).toHaveBeenCalledTimes(1);
  });

  it("submits Nobody once the reloaded list no longer holds the departed Resident", async () => {
    api.setResponsible.mockResolvedValue({ kind: "unknown-resident" });
    api.updateChore.mockResolvedValue({ kind: "ok", chore: chore("c1", "Lavar a louça") });
    const p = props();
    render(createElement(ChoreForm, p));
    await choose("r2");
    await submit();
    expect(api.setResponsible).toHaveBeenCalledTimes(1);
    await render(createElement(ChoreForm, { ...p, responsible: { ...p.responsible, residents: [RESIDENTS[0]!] } }));
    expect(select().value).toBe("");
    expect(container().querySelector("#chore-form-t-responsible-error")).not.toBeNull();
    await submit();
    expect(api.setResponsible).toHaveBeenCalledTimes(1);
    expect(p.onSaved).toHaveBeenCalledTimes(1);
  });

  it("drops the refusal when another Resident or Nobody is chosen", async () => {
    api.setResponsible.mockResolvedValue({ kind: "restricted", residentId: "r2", restrictedBy: ["heavy_lifting"], restrictedByChore: false });
    render(createElement(ChoreForm, props()));
    await choose("r2");
    await submit();
    expect(container().querySelector("#chore-form-t-responsible-error")).not.toBeNull();
    await choose("");
    expect(container().querySelector("#chore-form-t-responsible-error")).toBeNull();
    expect(select().getAttribute("aria-invalid")).not.toBe("true");
  });
});

describe("ChoreForm Responsible field in pt-BR", () => {
  it("is labelled Responsável and defaults to Ninguém", () => {
    const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
    const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate("pt-BR", key, params);
    const html = renderToStaticMarkup(
      createElement(I18nContext.Provider, { value: { locale: "pt-BR", setLocale: () => {}, t } }, createElement(ChoreForm, props())),
    );
    expect(html).toContain(">Responsável<");
    expect(html).toMatch(/<option value="" selected="">Ninguém<\/option>|<option value="">Ninguém<\/option>/);
  });
});
