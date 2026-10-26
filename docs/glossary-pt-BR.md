# pt-BR glossary

Agreed Brazilian Portuguese equivalents for the terms in [CONTEXT.md](../CONTEXT.md) that appear in the UI. Later tickets reuse and extend this table. The wording was drafted by an engineer and is awaiting native-speaker review ([ADR 0006](adr/0006-localize-with-a-small-typed-module.md)).

## Conventions

- Informal "você", not "tu".
- Domain terms are lower case in running pt-BR text, because Portuguese does not capitalise common nouns. The table keeps the English capitalised term as the key.
- The "avoid" lists in CONTEXT.md are English words. Their closest pt-BR calques are avoided too, for example "residência" and "domicílio" for Home. "Casa" is the literal sibling of the avoided English "House".
- Keep "Homeowner" as is: it is the product's name.

## Terms

| CONTEXT.md term | pt-BR | pt-BR words to avoid | Note |
|---|---|---|---|
| Home | lar | residência, domicílio (and "casa" unless the native speaker chooses it) | Covers houses and apartments, as CONTEXT.md requires. "Casa" is the colloquial fallback if the native speaker prefers it. Used in: "Divida os afazeres domésticos do seu lar de forma justa." and the `home.*` Home screen strings ("Crie o seu lar", "Seu lar"). |
| Check-in | check-in | verificação de humor, pesquisa, enquete | The English word is common in Brazilian apps. The native speaker may prefer "registro do dia". Used in `checkin.*` and `dayplan.energy.*`. |
| User | login (in running text); "usuário" only if a noun is unavoidable | conta, perfil, pessoa | CONTEXT.md avoids Account, Profile and Person, so the pt-BR avoids their calques "conta", "perfil" and "pessoa" for a User. The sign-in copy says "login" the way the English says "login" ("um login só seu"). Used in `signUp.*`, `signIn.*`, `signedIn.*`. No catalog value says "perfil": the page is "Eu" (see Me below) and the loading and error texts say "seus dados". |
| Me | Eu (the tab and in sentences: "na aba Eu") | perfil, minha conta | The English "Me" tab (`nav.me`). "Eu" is unverified as a title and in "na aba Eu"; the native speaker should confirm. `noProfileWord.test.ts` fails if "perfil" returns to any value. |
| Resident | morador | membro, proprietário, dono | Plural "moradores". A User who lives in a Home; all Residents have equal say. Used in `home.leave.*` and `invite.*`. |
| Invite | convite | código de convite, link de entrada | A single-use link a Resident shares; valid for seven days ("sete dias"). Used in `invite.*`. |
| Allocation | alocação | agendamento, distribuição | The daily run that proposes Tasks. "Allocation time" is "horário da alocação" (the time of day it runs). Used in `home.allocationTime.label`. |
| Streak | sequência | combo, corrente | Used in `streak.*`. CONTEXT.md avoids Combo and Chain, so their calques are avoided too. The header button's name is "Sequência: 3 dias"; the dialog title "Your Streak" is "Sua sequência"; the rule lines say "assumir" for Committing to a Task ("Assumir tarefas e não concluir nenhuma quebra a sequência.") and "esgotado" for a Drained day. Awaiting native-speaker review. |
| Task | tarefa | atribuição, ocorrência, instância | Plural "tarefas" in running text. Used in `dayplan.*`. |
| Day Plan | plano do dia | agenda, cronograma, programação, lista diária | Used in `home.leave.removes`. |
| Committed | assumida | confirmada, comprometida | A Task the Resident accepted. Feminine, agreeing with "tarefa". Shown as text on the card. Draft for the native speaker to confirm. Used in `dayplan.task.committed`. |
| Accept / Accept all | aceitar / aceitar todas | confirmar | Button on a Proposed Task, and the one above "Suas tarefas" ("Aceitar todas as {count} tarefas"). Used in `dayplan.action.accept*`, `dayplan.action.acceptAll`. |
| Refuse | recusar | rejeitar, negar | Sends a Proposed Task back to the open Tasks. Used in `dayplan.action.refuse*` and `dayplan.pool.reason.refused`. |
| Take | pegar | assumir, tomar | Takes an open Task for yourself. Used in `dayplan.action.take*` and `dayplan.assigned.reason.taken`. |
| Completion | conclusão; the button is "Concluir {task}" | marcação, check, marcar como feito | Recording that a Task was done. CONTEXT.md avoids "Done flag" and "Checkmark", so the pt-BR avoids "marcação" and "check". Used in `dayplan.action.done*`. |
| Swap | troca (the verb: "trocar") | permuta, intercâmbio, escambo | An offer to exchange one of your Tasks for another Resident's; it happens only when they accept. "Oferecer uma troca", "aceitar a troca", "recusar a troca". Draft for the native speaker to confirm. |
| Done today | Concluídas hoje | Feitas hoje, Marcadas | Heading of the list of Tasks the Resident completed today. Used in `dayplan.done.heading`. |
| Baseline | energia base | padrão, energia padrão | A User's usual Energy per weekday. Used in `profile.baseline.*`. |
| Baseline level | baixa, normal, alta | fraca, forte, média | The three choices per weekday (Low, Normal, High); they describe the Energy ("energia"), so they agree with it in the feminine, like the Check-in "baixa". Used in `profile.baseline.level.*`. |
| Energy | energia | humor, disposição, fôlego | Used in `checkin.level.legend`. |
| Effort | esforço | dificuldade, custo, duração | In points from 1 to 5, shown to the person as five named levels (`effort.level.*`: Muito leve, Leve, Médio, Pesado, Muito pesado). Used in `chores.form.baseEffort.*` (a Chore's base Effort). |
| Chore | afazer | atividade, trabalho, tarefa (a Task is "tarefa") | Plural "afazeres". Used in `profile.*` and the `chores.*` Chores screen. |
| Preference | preferência | gosto | Like, neutral, dislike are "Gosto", "Neutro", "Não gosto". |
| Restriction | restrição | limitação, requisito | Used in `profile.restrictions.*`. |
| Catalog | catálogo | modelos, biblioteca, padrões, predefinições | The fixed list of common Chores built into the app. Capitalised ("Catálogo") when it names the feature, as in "Adicionar do Catálogo". Used in `chores.catalog.*`, `chores.addFromCatalog` and `catalog.*`. The Catalog's Chore names are `catalog.<id>` and follow the Chore wording ("afazer", "cômodo" for a room). |
| Category | categoria | tipo, área, etiqueta | The ten names are `category.*`; the Chore form label is `chores.form.category.label`. |
| Demand | exigência | requisito, etiqueta, dificuldade | The four names are `demand.*`; the section heading is "Restrições" and the items name the Demand. On the Chore form the group is "Exigências" (`chores.form.demands.legend`). |
| Check-in level | esgotado, baixa, normal, energizado | exausto, cansado, animado | The four answers to the Check-in (Drained, Low, Normal, Energized), scaling the Baseline to 0, 50%, 100% and 130% for the day. They describe the Energy ("energia"), so "baixa" agrees with it, while "esgotado" and "energizado" describe the person. Draft wording for the native speaker to confirm. Used in `checkin.level.*`. |
| Importance | importância | prioridade, urgência | Essential, normal and nice to have are "Essencial", "Normal" and "Desejável" (`importance.*`). Used in `chores.form.importance.*`. |

"Housework" in running copy is "afazeres domésticos". It is not a term in CONTEXT.md; a **Task** (later "tarefa") is a specific thing, so "tarefa" is not used for housework in general.

## Product and platform terms

Not domain terms, but kept consistent across the copy. CONTEXT.md has no **Reminder** entry yet; the product manager may add one.

| English | pt-BR | Note |
|---|---|---|
| Email | e-mail | Hyphenated, as Brazilian Portuguese writes it. Used across `signUp.*`, `signIn.*`, `confirm.*`. |
| Password | senha | Not "palavra-passe" (European). Rules are "regras" and a met rule is "cumprida". Used in `signUp.*`, `auth.rule.*`. |
| Sign in / Sign up / Sign out | entrar / cadastrar-se / sair | "Signed in" is "conectado". Used in `signIn.*`, `signUp.*`, `signedIn.*`. |
| Code (from the email) | código | Keep the same word on the confirm screen and in the failure texts. |
| Room | cômodo | Bedroom "quarto", bathroom "banheiro", kitchen "cozinha", living room "sala", laundry area "área de serviço". Used in `catalog.rooms.*`. |
| Suggested Chores | afazeres sugeridos | What the questionnaire's answers produce and the Resident reviews. Used in `catalog.review.*`. |
| Pet | animal de estimação | Not "bicho". Used in `catalog.pets.*`. |
| Outdoor space | área externa | Balcony "varanda", yard "quintal", garden "jardim". Used in `catalog.outdoor.*`. |
| Timezone | fuso horário | Used in `home.timezone.label`. |
| Reminders | lembretes | |
| test notification | notificação de teste | |
| Home Screen (iOS) | Tela de Início | Apple's own label. Not the domain **Home**: never "lar" here. |
| home screen (Android) | tela inicial | Android's own label, used in `reminders.unsupported`. |
| Share (iOS Safari) | Compartilhar | Apple label. |
| Add to Home Screen, Add (iOS Safari) | Adicionar à Tela de Início, Adicionar | Apple labels. |
| Settings | Ajustes (iOS), Configurações (Android) | `reminders.problem.denied` shows on both, so it says "Ajustes (ou Configurações)". |
| Language (setting) | idioma | Not "língua". Used in `settings.language.label`. The option names "English" and "Português" are not translated: each language is named in itself. |
| Replan (staging test button) | replanejar / "Replanejar agora" | refazer, recalcular | Asks for a new Day Plan on demand. Staging only. Used in `dayplan.replan.*`. |
| AI (the model that plans) | IA | inteligência artificial (too long), robô | Used in `dayplan.replan.*`. |
| Baseline allocator (the plan made without the AI) | alocador padrão; its plan is "plano padrão" | alocador básico, alocador base | Not "base": "energia base" is the User's Baseline, a different thing. Used in `dayplan.replan.*`. |
| for others (the combined count of other Residents' Tasks on the Today summary card) | dos outros | para outros moradores (longer) | Matches "Tarefas dos outros moradores". Used in `dayplan.summary.others`. Pending native-speaker review. |
| still to do (the pool) | por fazer | pendente, em aberto | Matches the pool heading "Ainda por fazer". Used in `dayplan.summary.pool`. Pending native-speaker review. |
| written by the assistant (the explanation came from the model) | Escrito pelo assistente | Escrito pela IA (shorter; the glossary uses "IA" in `dayplan.replan.*`) | Used in `dayplan.summary.source.llm`. Pending native-speaker review. |
| standard summary of today's reasons (the explanation built from the Allocation's recorded reasons) | Resumo padrão dos motivos de hoje | resumo básico, resumo automático | "padrão" matches "plano padrão" for the baseline allocator. Used in `dayplan.summary.source.template`. Pending native-speaker review. |

Apple and Android labels must match what the device shows in pt-BR. They are not yet verified on a pt-BR device.
