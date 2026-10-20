// Brazilian Portuguese. The compiler requires exactly the keys of en-US, with a
// plain string where en-US has a string and a plural object where it has one.
//
// - Informal "você". Domain terms follow docs/glossary-pt-BR.md.
// - Keep placeholders {name} exactly as in en-US (catalogs.test.ts checks).
// - One whole sentence per key.
import type { enUS, MessageKey } from "./en-US";

type Messages = {
  [K in MessageKey]: (typeof enUS)[K] extends string
    ? string
    : { one: string; other: string; many?: string };
};

export const ptBR: Messages = {
  "app.name": "Homeowner",
  "home.tagline": "Gerencie os afazeres domésticos do seu lar.",
  "health.unavailable":
    "Status do serviço: indisponível. O serviço está no ar, mas não consegue acessar o banco de dados.",
  "health.unreachable":
    "Status do serviço: inacessível. Verifique sua conexão e tente novamente.",
  "health.retry": "Tentar novamente",
  "auth.checking": "Verificando seu login...",

  // Navegação
  "nav.label": "Principal",
  "nav.today": "Hoje",
  "nav.chores": "Afazeres",
  "nav.home": "Lar",
  "nav.me": "Eu",
  "me.heading": "Sobre você",

  // Lar
  "home.loading": "Carregando o lar",
  "home.load.offline":
    "O Homeowner não consegue acessar o serviço, então não foi possível carregar o seu lar. Verifique sua conexão e tente novamente.",
  "home.load.error":
    "Algo deu errado ao carregar o seu lar. Tente novamente em instantes.",
  "home.notSignedIn": "Seu login terminou. Entre novamente para continuar.",
  "home.retry": "Tentar novamente",
  "home.create.heading": "Crie o seu lar",
  "home.create.submit": "Criar lar",
  "home.create.recovered":
    "Você já tem um lar, então o Homeowner o carregou. Confira os ajustes dele abaixo.",
  "home.settings.heading": "Seu lar",
  "home.settings.plan.hint": "Quando o plano de cada dia é feito, no fuso horário do seu lar.",
  "home.summary": "Os planos são feitos às {time}, horário de {zone}.",
  "home.settings.save": "Salvar alterações",
  "home.settings.saved": "Suas alterações foram salvas.",
  "home.settings.card.title": "Ajustes do lar",
  "home.settings.card.hint": "Horário do planejamento e fuso horário",
  "home.residents.heading": "Moradores",
  "home.residents.you": "Você",
  "home.residents.streak": { one: "{count} dia", other: "{count} dias" },
  "home.residents.doneToday": { one: "{count} concluída hoje", other: "{count} concluídas hoje" },
  "home.residents.error": "Algo deu errado ao carregar os moradores. Tente novamente em instantes.",
  "resident.loading": "Carregando o morador",
  "resident.back": "Seu lar",
  "resident.streak": { one: "dia de sequência", other: "dias de sequência" },
  "resident.done7": { one: "Tarefa concluída em 7 dias", other: "Tarefas concluídas em 7 dias" },
  "resident.recent.heading": "Concluídas há pouco",
  "resident.day.today": "Hoje",
  "resident.day.yesterday": "Ontem",
  "resident.completion.meta": "{category} · {time}",
  "resident.completion.metaWith": "{category} · {time}, com {name}",
  "resident.empty": "Nada concluído nos últimos 7 dias.",
  "resident.notFound": "Não encontramos este morador no seu lar.",
  "resident.error": "Algo deu errado ao carregar este morador. Tente novamente em instantes.",
  "resident.offline": "O Homeowner não consegue acessar o serviço. Verifique a sua conexão e tente de novo.",
  "home.timezone.label": "Fuso horário",
  "home.allocationTime.label": "Horário da alocação",
  "home.save.offline":
    "O Homeowner não consegue acessar o serviço. O que você digitou continua aqui; verifique sua conexão e tente novamente.",
  "home.save.error":
    "Algo deu errado e nada foi salvo. O que você digitou continua aqui; tente novamente em instantes.",
  "home.leave.heading": "Sair deste lar",
  "home.leave.open": "Sair deste lar",
  "home.leave.title": "Sair deste lar?",
  "home.leave.removes":
    "Suas preferências e restrições para os afazeres dele, e seus lugares no plano do dia, são apagados.",
  "home.leave.stays":
    "Sua energia base e suas preferências e restrições gerais vão com você.",
  "home.leave.last":
    "Se você for o último morador, o lar e seus afazeres são apagados de vez.",
  "home.leave.cancel": "Cancelar",
  "home.leave.confirm": "Sair do lar",
  "home.leave.offline":
    "O Homeowner não consegue acessar o serviço, então você ainda não saiu. Verifique sua conexão e tente novamente.",
  "home.leave.error":
    "Algo deu errado e você ainda não saiu. Tente novamente em instantes.",
  "home.invalid.summary":
    "Alguns dados precisam ser corrigidos. Confira os campos abaixo.",
  "home.field.timezone.required": "Escolha um fuso horário.",
  "home.field.timezone.unknown":
    "Esse fuso horário não foi reconhecido. Escolha um da lista.",
  "home.field.allocationTime.required": "Escolha um horário da alocação.",
  "home.field.allocationTime.invalid":
    "Esse horário não é válido. Escolha um da lista.",
  "home.field.allocationTime.not_quarter_hour":
    "O horário da alocação deve ser em um quarto de hora: :00, :15, :30 ou :45.",
  "home.field.unknown": "Este valor não é aceito. Confira e tente novamente.",

  // Reminders
  "reminders.on": "Os lembretes estão ativados neste dispositivo.",
  "reminders.enable": "Ativar lembretes",
  "reminders.problem.denied":
    "As notificações estão bloqueadas para o Homeowner. Permita-as nos Ajustes (ou Configurações) do celular, em Notificações.",
  "reminders.problem.dismissed":
    "Você fechou a pergunta de permissão. Toque no botão para tentar de novo.",
  "reminders.problem.notConfigured":
    "Os lembretes ainda não estão configurados no serviço. Tente novamente mais tarde.",
  "reminders.problem.notSignedIn":
    "Você não está mais conectado. Entre de novo e depois ative os lembretes.",
  "reminders.problem.error":
    "Algo deu errado ao ativar os lembretes. Verifique sua conexão e tente novamente.",
  "reminders.problem.browserRegister":
    "Este navegador não conseguiu se registrar no serviço de notificações. Use o Chrome e confirme que o Google Play Services está atualizado.",
  "reminders.problem.browserNotAllowed":
    "As notificações não estão permitidas para este app. Verifique Configurações, Apps, Homeowner, Notificações.",
  "reminders.problem.browserRefused":
    "Seu navegador se recusou a ativar os lembretes ({name}).",

  // iPhone install steps
  "install.heading": "Adicione o Homeowner à sua Tela de Início",
  "install.step1": "Abra esta página no Safari (não dentro de outro app).",
  "install.step2":
    "Toque no botão Compartilhar, o quadrado com uma seta, na parte inferior da tela.",
  "install.step3":
    "Role para baixo e toque em Adicionar à Tela de Início, depois toque em Adicionar.",
  "install.step4":
    "Feche o Safari e abra o Homeowner pelo novo ícone na sua Tela de Início.",

  // Profile
  "profile.loading": "Carregando seus dados",
  "profile.offline":
    "Não foi possível falar com o serviço, então seus dados não aparecem. Verifique sua conexão e tente de novo.",
  "profile.error":
    "Algo deu errado ao carregar seus dados. Tente de novo em instantes.",
  "profile.notSignedIn":
    "Você não está mais conectado. Entre de novo para ver seus dados.",
  "profile.retry": "Tentar de novo",
  "profile.saved": "Salvo.",
  "profile.saveFailed":
    "Não foi possível salvar sua alteração, então ela foi desfeita. Verifique sua conexão e tente de novo.",
  "profile.saveFailed.notSignedIn":
    "Você não está mais conectado, então sua alteração foi desfeita. Entre de novo.",
  "me.header.addLink": "Adicione seu nome e foto",
  "me.header.edit": "Editar nome e foto",
  "me.header.loadFailed": "Não foi possível carregar seu nome.",
  "me.header.retry": "Tentar de novo",
  "me.edit.heading": "Seu nome",
  "me.edit.back": "Voltar",
  "me.edit.nameLabel": "Nome",
  "me.edit.nameHint": "Quem mora com você vê este nome. Vazio, usamos o começo do e-mail.",
  "me.edit.counter": "{count}/{max}",
  "me.edit.save": "Salvar",
  "profile.name.tooLong": "O nome pode ter no máximo {max} caracteres. Encurte e salve de novo.",
  "profile.name.invalid": "O nome tem caracteres não permitidos. Remova e salve de novo.",
  "profile.name.offline": "Não foi possível falar com o serviço, então o nome não foi salvo. Verifique sua conexão e tente de novo.",
  "profile.name.error": "Algo deu errado ao salvar o nome. Tente de novo em instantes.",
  "profile.name.notSignedIn": "Você não está mais conectado. Entre de novo para salvar o nome.",
  "me.photo.label": "Foto",
  "me.photo.choose": "Escolher foto",
  "me.photo.another": "Escolher outra",
  "me.photo.save": "Salvar foto",
  "me.photo.retry": "Tentar de novo",
  "me.photo.remove": "Remover foto",
  "me.photo.preparing": "Preparando a foto...",
  "me.photo.previewCaption": "Assim ela vai ficar",
  "me.photo.hint": "Quem mora com você vê a foto. Cortamos em quadrado e nada é enviado até você salvar.",
  "profile.photo.unreadable": "Não foi possível ler este arquivo. Escolha uma foto JPEG, PNG ou WebP.",
  "profile.photo.unprepared": "Não foi possível preparar esta foto. Tente outra.",
  "profile.photo.off": "Fotos indisponíveis no momento. Tente mais tarde.",
  "profile.photo.offline": "Sem conexão com o serviço, a foto não foi salva. Verifique e tente de novo.",
  "profile.photo.error": "A foto não foi salva e a atual continua a mesma. Tente de novo.",
  "profile.photo.removeError": "Não foi possível remover a foto. Tente de novo.",
  "profile.photo.notSignedIn": "Você não está mais conectado. Entre de novo para mudar a foto.",
  "profile.baseline.heading": "Energia base",
  "profile.baseline.hint": "Sua energia de costume em cada dia da semana. O check-in ajusta para o dia.",
  "profile.baseline.level.low": "Baixa",
  "profile.baseline.level.normal": "Normal",
  "profile.baseline.level.high": "Alta",
  "profile.preferences.heading": "Preferências",
  "profile.preferences.hint": "Tarefas de que você gosta entram mais no seu plano. O essencial ainda vem primeiro.",
  "profile.preference.like": "Gosto",
  "profile.preference.neutral": "Neutro",
  "profile.preference.dislike": "Não gosto",
  "profile.restrictions.heading": "Restrições",
  "profile.restrictions.hint": "Trabalho que você não pode fazer. Ele nunca é dado a você.",
  "category.kitchen": "Cozinha",
  "category.bathroom": "Banheiro",
  "category.bedroom": "Quarto",
  "category.living_room": "Sala",
  "category.laundry": "Roupas",
  "category.floors": "Pisos",
  "category.trash": "Lixo",
  "category.outdoor": "Área externa",
  "category.pets": "Animais de estimação",
  "category.other": "Outros",
  "demand.heavy_lifting": "Carregar peso",
  "demand.bending": "Abaixar-se",
  "demand.heights": "Altura",
  "demand.strong_chemicals": "Produtos químicos fortes",

  "importance.essential": "Essencial",
  "importance.normal": "Normal",
  "importance.nice_to_have": "Desejável",

  // Chores
  "chores.heading": "Afazeres",
  "chores.count": {
    one: "{count} afazer no seu lar",
    other: "{count} afazeres no seu lar",
  },
  "chores.loading": "Carregando os afazeres",
  "chores.load.offline":
    "Não foi possível carregar os seus afazeres porque o Homeowner não consegue falar com o serviço. Confira a sua conexão e tente de novo.",
  "chores.load.error":
    "Algo deu errado ao carregar os seus afazeres. Tente de novo daqui a pouco.",
  "chores.notSignedIn": "Seu login terminou. Entre de novo para continuar.",
  "chores.retry": "Tentar de novo",
  "chores.empty": "Nenhum afazer ainda.",
  "chores.add": "Adicionar afazer",
  "effort.level.very_light": "Muito leve",
  "effort.level.light": "Leve",
  "effort.level.medium": "Médio",
  "effort.level.heavy": "Pesado",
  "effort.level.very_heavy": "Muito pesado",
  "chores.item.effort": "Esforço: {level}",
  "chores.item.people.one": "1 pessoa",
  "chores.item.people.two": "2 pessoas",
  "chores.item.once": "Uma vez só",
  "chores.item.daily": "Todo dia",
  "chores.item.every": "A cada {days} dias",
  "chores.interval.daily": "Diário",
  "chores.interval.weekly": "Semanal",
  "chores.interval.every_2_weeks": "A cada 2 semanas",
  "chores.interval.monthly": "Mensal",
  "chores.interval.custom": "Personalizado",
  "chores.item.weekdays": "Só em {days}",
  "chores.item.buildsUp": "Acumula enquanto não é feito",
  "chores.item.edit.label": "Editar {name}",
  "chores.item.delete.label": "Excluir {name}",
  "chores.delete.prompt": "Excluir {name}? Isso não pode ser desfeito.",
  "chores.delete.confirm": "Sim, excluir",
  "chores.delete.cancel": "Manter",
  "chores.delete.offline":
    "O afazer não foi excluído porque o Homeowner não consegue falar com o serviço. Confira a sua conexão e tente de novo.",
  "chores.delete.error":
    "Algo deu errado e o afazer não foi excluído. Tente de novo daqui a pouco.",
  "chores.delete.notSignedIn":
    "Seu login terminou, então o afazer não foi excluído. Entre de novo para continuar.",
  "chores.form.create.heading": "Adicionar afazer",
  "chores.form.edit.heading": "Editar afazer",
  "chores.form.name.label": "Nome",
  "chores.form.category.label": "Categoria",
  "chores.form.category.placeholder": "Escolha uma categoria",
  "chores.form.demands.legend": "Exigências",
  "chores.form.baseEffort.legend": "Esforço",
  "chores.form.importance.legend": "Importância",
  "chores.form.people.legend": "Pessoas necessárias",
  "chores.form.people.one": "Uma pessoa",
  "chores.form.people.two": "Duas pessoas",
  "chores.form.suggestion": "Um afazer tão cansativo fica mais leve em dupla.",
  "chores.form.suggestion.action": "Tornar para duas pessoas",
  "chores.form.interval.legend": "Com que frequência",
  "chores.form.intervalDays.label": "Repetir a cada (dias)",
  "chores.form.intervalDays.hint":
    "Deixe em branco para um afazer de uma vez só.",
  "chores.form.allowedWeekdays.legend": "Só nestes dias",
  "chores.form.buildsUp.label": "Acumula enquanto não é feito",
  "chores.form.submit.create": "Adicionar afazer",
  "chores.form.submit.save": "Salvar afazer",
  "chores.form.cancel": "Cancelar",
  "chores.form.saved": "O afazer foi salvo.",
  "chores.form.invalid.summary":
    "Alguns dados precisam de ajuste. Confira os campos abaixo.",
  "chores.form.save.offline":
    "O afazer não foi salvo porque o Homeowner não consegue falar com o serviço. O que você digitou continua aqui; confira a sua conexão e tente de novo.",
  "chores.form.save.error":
    "Algo deu errado e o afazer não foi salvo. O que você digitou continua aqui; tente de novo daqui a pouco.",
  "chores.form.save.notSignedIn":
    "Seu login terminou, então o afazer não foi salvo. Entre de novo para continuar.",
  "chores.form.save.gone":
    "Este afazer não existe mais, talvez porque outro morador o excluiu.",
  "chores.field.name.required": "Dê um nome ao afazer.",
  "chores.field.name.too_long":
    "Esse nome é longo demais. Use 100 caracteres ou menos.",
  "chores.field.category.required": "Escolha uma categoria.",
  "chores.field.category.unknown":
    "Essa categoria não é reconhecida. Escolha uma da lista.",
  "chores.field.importance.required": "Escolha uma importância.",
  "chores.field.importance.unknown":
    "Essa importância não é reconhecida. Escolha uma da lista.",
  "chores.field.demands.unknown":
    "Uma das exigências não é reconhecida. Desmarque-a e tente de novo.",
  "chores.field.baseEffort.required": "Escolha um nível de esforço.",
  "chores.field.baseEffort.invalid": "Escolha um dos níveis de esforço.",
  "chores.field.baseEffort.out_of_range": "Escolha um dos níveis de esforço.",
  "chores.field.people.required": "Escolha uma ou duas pessoas.",
  "chores.field.people.invalid": "O número de pessoas deve ser 1 ou 2.",
  "chores.field.people.out_of_range":
    "Um afazer precisa de uma ou duas pessoas.",
  "chores.field.intervalDays.required":
    "Digite quantos dias, ou deixe em branco para um afazer de uma vez só.",
  "chores.field.intervalDays.invalid":
    "Digite um número inteiro de dias, ou deixe em branco para um afazer de uma vez só.",
  "chores.field.intervalDays.out_of_range":
    "Repita a cada 1 a 365 dias, ou deixe em branco para um afazer de uma vez só.",
  "chores.field.allowedWeekdays.invalid":
    "Um dos dias não é válido. Desmarque-o e tente de novo.",
  "chores.field.allowedWeekdays.out_of_range":
    "Um dos dias não é válido. Desmarque-o e tente de novo.",
  "chores.field.unknown": "Este valor não é aceito. Confira e tente de novo.",

  // Hoje (o plano do dia)
  "dayplan.heading": "Hoje",
  "dayplan.loading": "Carregando o plano de hoje",
  "dayplan.load.offline":
    "Não foi possível carregar o plano de hoje porque o Homeowner não consegue falar com o serviço. Confira a sua conexão e tente de novo.",
  "dayplan.load.error":
    "Algo deu errado ao carregar o plano de hoje. Tente de novo daqui a pouco.",
  "dayplan.notSignedIn": "Seu login terminou. Entre de novo para continuar.",
  "dayplan.retry": "Tentar de novo",
  "dayplan.notPlanned": "O plano de hoje é feito às {time}.",
  "dayplan.rejected":
    "Não foi possível usar o plano de hoje, então nenhuma tarefa foi dada hoje.",
  "dayplan.greeting.morning": "Bom dia",
  "dayplan.greeting.afternoon": "Boa tarde",
  "dayplan.greeting.evening": "Boa noite",
  "dayplan.greeting.morningName": "Bom dia, {name}",
  "dayplan.greeting.afternoonName": "Boa tarde, {name}",
  "dayplan.greeting.eveningName": "Boa noite, {name}",
  "dayplan.energy.value": "Energia {energy}",
  "dayplan.energy.planned": "{planned} de {energy} planejados para você",
  "dayplan.energy.drained": "Esgotado hoje, sem tarefas",
  "dayplan.energy.noBaseline": "Defina a sua energia base para ter energia",
  "dayplan.mine.empty.noBaseline":
    "Sem energia base para hoje, então nenhuma tarefa para você.",
  "dayplan.mine.empty.noBaseline.link": "Definir a energia base",
  "dayplan.mine.heading": "Suas tarefas",
  "dayplan.mine.empty": "Nada para você hoje. Aproveite o dia.",
  "dayplan.others.heading": "Tarefas dos outros moradores",
  "dayplan.others.someone": "Um morador",
  "dayplan.summary.mine": { one: "{count} tarefa sua", other: "{count} tarefas suas" },
  "dayplan.summary.others": { one: "{count} dos outros", other: "{count} dos outros" },
  "dayplan.summary.pool": { one: "{count} por fazer", other: "{count} por fazer" },
  "dayplan.pool.heading": "Ainda por fazer",
  "dayplan.pool.empty":
    "Nenhuma outra tarefa em aberto. Tudo está planejado ou feito.",
  "dayplan.task.effort": "Esforço: {level}",
  "dayplan.task.effort.grown": "Esforço: {level}, normalmente {base}",
  "dayplan.task.due": "Para {date}",
  "dayplan.task.dueToday": "Para hoje",
  "dayplan.task.duePast": "Era para {date}",
  "dayplan.task.reason": "Por quê: {reason}",
  "dayplan.assigned.reason.deadline_today": "Vence hoje.",
  "dayplan.assigned.reason.importance": "É a que mais importa.",
  "dayplan.assigned.reason.lateness": "É a que espera há mais tempo.",
  "dayplan.assigned.reason.fits_energy": "Cabe na sua energia.",
  "dayplan.pool.reason.no_energy_left":
    "Ninguém tem energia suficiente sobrando hoje.",
  "dayplan.pool.reason.restricted_for_all":
    "Ninguém pode fazer: todos os moradores têm uma restrição sobre ela.",
  "dayplan.pool.reason.weekday_not_allowed":
    "Não é permitida neste dia da semana.",
  "dayplan.pool.reason.two_person_deferred":
    "Precisa de duas pessoas, e as duas não estavam livres hoje.",
  "dayplan.pool.reason.invalid_effort":
    "O esforço dela não é válido, então ficou de fora. Edite o afazer para corrigir.",
  "dayplan.pool.reason.added_after_plan":
    "Foi adicionada depois que o plano de hoje foi feito.",
  "dayplan.mine.empty.drained":
    "Você fez check-in como esgotado, então nenhuma tarefa hoje. Descanse.",
  "dayplan.pool.reason.refused": "Foi recusada, então voltou para as tarefas em aberto.",
  "dayplan.assigned.reason.taken": "Você pegou esta tarefa das em aberto.",
  "dayplan.assigned.reason.liked": "Você gosta desta.",
  "dayplan.assigned.reason.spared_dislike": "Poupado de uma tarefa de que você não gosta.",
  "dayplan.assigned.reason.turn_taking": "É a sua vez.",
  "dayplan.assigned.reason.swapped": "Veio de uma troca.",
  "dayplan.action.accept": "Aceitar",
  "dayplan.action.accept.named": "Aceitar {task}",
  "dayplan.action.acceptAll": {
    one: "Aceitar {count} tarefa",
    other: "Aceitar todas as {count} tarefas",
  },
  "dayplan.action.refuse": "Recusar",
  "dayplan.action.refuse.named": "Recusar {task}",
  "dayplan.action.take": "Pegar",
  "dayplan.action.take.named": "Pegar {task}",
  "dayplan.action.done": "Concluir",
  "dayplan.action.done.named": "Concluir {task}",
  "dayplan.task.committed": "Assumida",
  "dayplan.task.with": "Com {name}",
  "dayplan.task.withYou": "Com você",
  "dayplan.task.withSomeone": "Com um morador",
  "dayplan.task.suggestTwoPerson": "Esse afazer só cresce. Que tal fazê-lo em dupla?",
  "dayplan.task.suggestTwoPerson.action": "Tornar para duas pessoas",
  "dayplan.task.suggestTwoPerson.action.named": "Tornar {task} para duas pessoas",
  "dayplan.done.heading": "Concluídas hoje",
  "dayplan.done.at": "Concluída às {time}",
  "dayplan.done.atTogether": "Concluída às {time}, em dupla",
  "dayplan.action.failed.offline":
    "Parece que você está sem internet, então isso não foi enviado. Confira sua conexão e tente de novo.",
  "dayplan.action.failed.error":
    "Algo deu errado e isso não foi enviado. Tente de novo daqui a pouco.",
  "dayplan.replan.action": "Replanejar agora",
  "dayplan.replan.waiting": "Replanejando. Pode levar um minuto.",
  "dayplan.replan.timedOut": "O novo plano está demorando. Ele ainda pode chegar, volte daqui a pouco.",
  "dayplan.replan.done.llm": "A IA fez este plano.",
  "dayplan.replan.done.baseline": "O alocador padrão fez este plano, sem a IA.",
  "dayplan.replan.fallback.llm_daily_cap_reached":
    "Este é o plano padrão, não o da IA: o limite diário da IA foi atingido.",
  "dayplan.replan.fallback.llm_error": "Este é o plano padrão, não o da IA: a IA teve um problema.",
  "dayplan.replan.fallback.llm_timeout": "Este é o plano padrão, não o da IA: a IA demorou demais.",
  "dayplan.replan.fallback.llm_invalid_response":
    "Este é o plano padrão, não o da IA: a resposta da IA não pôde ser usada.",
  "dayplan.replan.fallback.llm_rejected_by_checker":
    "Este é o plano padrão, não o da IA: o plano da IA não passou na verificação.",
  "dayplan.replan.fallback.unknown": "Este é o plano padrão, não o da IA: o plano da IA não foi usado.",
  "dayplan.conflict.already_done":
    "Essa tarefa já foi concluída. Ela está em Concluídas hoje.",
  "dayplan.conflict.not_proposed":
    "Essa tarefa mudou desde que você olhou. Sua lista está atualizada.",
  "dayplan.conflict.already_committed":
    "Essa tarefa mudou desde que você olhou. Sua lista está atualizada.",
  "dayplan.conflict.not_in_pool":
    "Outro morador já pegou essa tarefa. Sua lista está atualizada.",
  "dayplan.conflict.not_yours":
    "Outro morador está com essa tarefa. Sua lista está atualizada.",
  "dayplan.conflict.no_plan_today": "Ainda não há plano para hoje.",
  "dayplan.conflict.two_person_task":
    "Essa tarefa precisa de duas pessoas, o que ainda não está disponível.",
  "dayplan.conflict.restricted":
    "Você tem uma restrição para essa tarefa, então ela não é para você hoje.",
  "dayplan.conflict.drained":
    "Você está sem energia hoje, então descanse: isso pode esperar.",
  "dayplan.conflict.unknown":
    "O plano mudou desde que você olhou. Sua lista está atualizada.",
  "dayplan.swap.conflict.not_yours": "Essa tarefa não está mais com você. Sua lista está atualizada.",
  "dayplan.swap.conflict.not_held_by_other": "Essa tarefa mudou de mãos. Sua lista está atualizada.",
  "dayplan.swap.conflict.already_done": "Essa tarefa já foi concluída. Sua lista está atualizada.",
  "dayplan.swap.conflict.two_person_task": "Uma tarefa para duas pessoas não pode ser trocada.",
  "dayplan.swap.conflict.no_plan_today": "Ainda não há plano para hoje, então não há trocas.",
  "dayplan.swap.conflict.restricted": "Essa troca não combina com as restrições de hoje.",
  "dayplan.swap.conflict.recipient_drained": "Essa troca pode esperar outro dia.",
  "dayplan.swap.conflict.swap_pending": "Essa troca já foi oferecida.",
  "dayplan.swap.conflict.swap_not_found": "Essa troca não está mais disponível. Sua lista está atualizada.",
  "dayplan.swap.conflict.swap_closed": "Essa troca já foi respondida. Sua lista está atualizada.",
  "dayplan.swap.conflict.swap_stale": "As tarefas mudaram, então essa troca não vale mais. Sua lista está atualizada.",

  // The start choice, at the end of both onboarding flows
  "startChoice.heading": "Quando você quer as suas tarefas?",
  "startChoice.now.button": "Receber minhas tarefas agora",
  "startChoice.tomorrow.button": "Começar amanhã",
  "startChoice.planning": "Planejando as suas tarefas...",
  "startChoice.retry": "Tentar de novo",
  "startChoice.failed.offline":
    "Parece que você está sem internet, então as suas tarefas não foram planejadas. Verifique a conexão e tente de novo.",
  "startChoice.failed.error":
    "Algo deu errado ao planejar as suas tarefas. Tente de novo daqui a pouco.",
  "startChoice.done.tasks": "As suas tarefas de hoje estão prontas.",
  "startChoice.done.noEnergy":
    "A sua energia de hoje é 0, então você não tem tarefas. Defina a energia base na aba Eu.",
  "startChoice.done.nothing":
    "Não sobrou nenhuma tarefa em aberto para você hoje. Aproveite o dia.",
  "startChoice.done.close": "Entendi",

  // Streak
  "streak.heading": "Sequência",
  "streak.days": {
    one: "Sequência de {count} dia",
    other: "Sequência de {count} dias",
  },
  "streak.empty": "Conclua uma tarefa para começar uma",
  "streak.todayCounts": "Hoje conta",

  // Check-in
  "checkin.heading": "Check-in",
  "checkin.prompt": "Como você está hoje?",
  "checkin.open": "Fazer check-in",
  "checkin.load.offline":
    "Não foi possível carregar o seu check-in porque o Homeowner não consegue acessar o serviço. Verifique a sua conexão e tente de novo.",
  "checkin.load.error":
    "Algo deu errado ao carregar o seu check-in. Tente de novo em instantes.",
  "checkin.notSignedIn": "O seu login terminou. Entre de novo para continuar.",
  "checkin.retry": "Tentar de novo",
  "checkin.level.legend": "Como está a sua energia hoje?",
  "checkin.level.drained": "Esgotado",
  "checkin.level.drained.hint": "Sem tarefas hoje",
  "checkin.level.low": "Baixa",
  "checkin.level.normal": "Normal",
  "checkin.level.energized": "Energizado",
  "checkin.level.required": "Escolha como está a sua energia hoje e salve.",
  "checkin.restrictions.legend": "Algo que você não pode fazer hoje?",
  "checkin.submit": "Salvar",
  "checkin.cancel": "Cancelar",
  "checkin.change": "Mudar",
  "checkin.saved": "Check-in salvo",
  "checkin.save.offline":
    "O seu check-in não foi salvo porque o Homeowner não consegue acessar o serviço. Verifique a sua conexão e tente de novo.",
  "checkin.save.error":
    "Algo deu errado ao salvar o seu check-in. Tente de novo em instantes.",
  "checkin.save.invalid":
    "O Homeowner não aceitou esse check-in. Escolha de novo e tente mais uma vez.",
  "checkin.summary": "Check-in de hoje: {level}",
  "checkin.summary.restrictions": "Não hoje: {demands}",

  // Cadastro
  "signUp.heading": "Cadastrar-se",
  "signUp.hint": "Crie uma conta e depois crie o seu lar ou entre em um.",
  "signUp.emailLabel": "E-mail",
  "signUp.passwordLabel": "Senha",
  "signUp.confirmLabel": "Confirmar senha",
  "signUp.mismatch": "As duas senhas não são iguais.",
  "signUp.submit": "Cadastrar",
  "signUp.haveLogin": "Já se cadastrou?",
  "signUp.haveLoginAction": "Entrar",

  // Entrar
  "signIn.heading": "Entrar",
  "signIn.hint": "Veja o que é seu para fazer hoje.",
  "signIn.confirmedNotice": "Seu e-mail foi confirmado. Entre para começar.",
  "signIn.emailLabel": "E-mail",
  "signIn.passwordLabel": "Senha",
  "signIn.submit": "Entrar",
  "signIn.newHere": "Novo por aqui?",
  "signIn.newHereAction": "Cadastrar-se",

  // Confirmar e-mail
  "confirm.heading": "Confirme seu e-mail",
  "confirm.intro": "Enviamos um código para {email}.",
  "confirm.codeLabel": "Código do e-mail",
  "confirm.submit": "Confirmar",
  "confirm.resend": "Enviar um novo código",
  "confirm.useOtherEmail": "Usar outro e-mail",
  "confirm.resent": "Um novo código está a caminho. Use o e-mail mais recente.",

  // Conectado
  "signedIn.heading": "Você está conectado",
  "signedIn.as": "Conectado como {email}.",
  "signedIn.emailFallback": "seu e-mail",
  "signedIn.offline":
    "Não foi possível acessar o serviço. Este é o último login que este dispositivo lembra.",
  "signedIn.signOut": "Sair",

  // Compartilhado pelas telas de login
  "auth.showPassword": "Mostrar senha",

  "auth.failure.alreadyRegistered":
    "Esse e-mail já está cadastrado. Entre com ele ou, se você nunca digitou o código, confirme-o.",
  "auth.failure.invalidPassword":
    "Essa senha não é forte o bastante. Escolha outra senha. {rules}",
  "auth.failure.invalidInput":
    "Confira o e-mail e os dados que você digitou e tente novamente.",
  "auth.failure.wrongCode":
    "Esse código não está certo. Confira o e-mail mais recente e tente novamente.",
  "auth.failure.expiredCode":
    "Esse código expirou. Solicite um novo código e use o e-mail mais recente.",
  "auth.failure.notConfirmed":
    "Confirme seu e-mail primeiro: digite o código que enviamos ou solicite um novo código.",
  "auth.failure.notAuthorized":
    "O e-mail ou a senha não está certo. Confira os dois e tente novamente.",
  "auth.failure.rateLimited":
    "Muitas tentativas. Espere alguns minutos e tente novamente.",
  "auth.failure.network":
    "Não foi possível acessar o serviço de login. Verifique sua conexão e tente novamente.",
  "auth.failure.error": "Algo deu errado. Tente novamente em instantes.",

  // Regras da senha
  "auth.rule.length": {
    one: "Pelo menos {count} caractere",
    other: "Pelo menos {count} caracteres",
  },
  "auth.rule.lowercase": "Uma letra minúscula",
  "auth.rule.uppercase": "Uma letra maiúscula",
  "auth.rule.number": "Um número",
  "auth.rule.symbol": "Um símbolo",
  "auth.rule.status.met": "{rule}: cumprida",
  "auth.rule.status.notMet": "{rule}: ainda não cumprida",
  "auth.rule.announce.met": "{rule} cumprida.",
  "auth.rule.announce.notMet": "{rule} não cumprida.",
  "auth.rule.announce.count": {
    one: "{met} de {count} regra cumprida.",
    other: "{met} de {count} regras cumpridas.",
  },
  "auth.rules.clause.lowercase": "uma letra minúscula",
  "auth.rules.clause.uppercase": "uma letra maiúscula",
  "auth.rules.clause.number": "um número",
  "auth.rules.clause.symbol": "um símbolo",
  "auth.rules.withClauses": "{length}, com {rules}.",
  "auth.rules.lengthOnly": "{length}.",
  "auth.rules.listEnd": "{rest} e {last}",

  // Invites: arriving from a link, joining, and sharing one
  "invite.checking": "Verificando seu convite...",
  "invite.signedOut.heading": "Você foi convidado para um lar",
  "invite.lookup.problem":
    "O Homeowner não conseguiu verificar seu convite agora. O link foi guardado, então você ainda pode entrar e tentar de novo.",
  "invite.dead.not_found":
    "Este link de convite não é válido. Ele pode ter sido copiado errado. Peça um novo convite ao morador.",
  "invite.dead.used":
    "Este convite já foi usado. Um convite funciona só uma vez, então peça um novo ao morador.",
  "invite.dead.expired":
    "Este convite expirou. Um convite dura sete dias, então peça um novo ao morador.",
  "invite.dead.continue": "Continuar",
  "invite.join.heading": "Entrar em um lar",
  "invite.join.loading": "Preparando seu convite...",
  "invite.join.submit": "Entrar neste lar",
  "invite.join.dismiss": "Agora não",
  "invite.leave.heading": "Entrar significa sair do seu lar",
  "invite.leave.warning":
    "Entrar neste lar significa sair do atual. Suas preferências e restrições para os afazeres dele são apagadas. Se você for o último morador, o lar e seus afazeres também são apagados.",
  "invite.leave.confirm": "Sair do meu lar e entrar neste",
  "invite.leave.cancel": "Ficar no meu lar",
  "invite.alreadyHere":
    "Você já mora neste lar, então não havia o que fazer. O convite não foi gasto.",
  "invite.failure.offline":
    "O Homeowner não consegue acessar o serviço, então você ainda não entrou. Seu convite foi guardado; verifique sua conexão e tente de novo.",
  "invite.failure.error":
    "Algo deu errado e você ainda não entrou. Seu convite foi guardado; tente de novo em instantes.",
  "invite.failure.notSignedIn":
    "Você não está mais conectado. Entre de novo para continuar.",
  "invite.failure.retry": "Tentar de novo",
  "invite.rating.heading": "Avalie os afazeres mais pesados",
  "invite.rating.loading": "Carregando os afazeres...",
  "invite.rating.problem":
    "Não foi possível carregar os afazeres, então não há o que avaliar agora. Você pode pular esta etapa.",
  "invite.rating.restricted": "Não consigo fazer este afazer",
  "invite.rating.saved": "Salvo.",
  "invite.rating.saveFailed":
    "Não foi possível salvar sua alteração, então ela foi desfeita. Verifique sua conexão e tente de novo.",
  "invite.rating.done": "Concluir",
  "invite.rating.skip": "Pular por enquanto",
  "invite.share.heading": "Convidar um morador",
  "invite.share.hint": "Um link de uso único para quem mora com você. Vale por sete dias.",
  "invite.share.button": "Compartilhar link do convite",
  "invite.share.title": "Entre no meu lar no Homeowner",
  "invite.share.text":
    "Entre no meu lar no Homeowner. Este link funciona uma vez e dura sete dias.",
  "invite.share.shared":
    "Seu convite está pronto e foi passado ao app que você escolheu.",
  "invite.share.copied":
    "O link do convite foi copiado. Cole em uma mensagem para enviar.",
  "invite.share.failed":
    "Não foi possível compartilhar nem copiar o link do convite. Tente de novo.",
  "invite.share.tooMany":
    "Seu lar já tem o máximo de convites abertos. Espere alguns serem usados ou expirarem.",
  "invite.share.noHome": "Você precisa de um lar antes de convidar alguém.",
  "invite.share.offline":
    "O Homeowner não consegue acessar o serviço, então nenhum convite foi criado. Verifique sua conexão e tente de novo.",
  "invite.share.error":
    "Algo deu errado e nenhum convite foi criado. Tente de novo em instantes.",

  // Settings
  "settings.heading": "Configurações",
  "settings.appearance.label": "Aparência",
  "settings.appearance.system": "Sistema",
  "settings.appearance.light": "Claro",
  "settings.appearance.dark": "Escuro",
  "settings.language.label": "Idioma",

  // Catálogo: o questionário, a revisão dos afazeres sugeridos e a adição pelo Catálogo
  "home.create.step": "Etapa {step} de {total}",
  "home.create.next": "Próximo: sobre o seu lar",
  "home.create.back": "Voltar",
  "home.create.recovered.chores":
    "Você já tem um lar, então ele foi carregado. Os afazeres que você revisou não foram adicionados; adicione-os pelo Catálogo.",
  "catalog.questions.heading": "Sobre o seu lar",
  "catalog.questions.submit": "Sugerir afazeres",
  "catalog.questions.skip": "Pular e adicionar afazeres depois",
  "catalog.questions.invalid":
    "Algumas respostas precisam de ajuste. Confira os campos abaixo.",
  "catalog.questions.offline":
    "O Homeowner não consegue acessar o serviço, então nenhum afazer foi sugerido. Suas respostas continuam aqui; confira sua conexão e tente de novo.",
  "catalog.questions.error":
    "Algo deu errado ao sugerir afazeres. Suas respostas continuam aqui; tente de novo em instantes.",
  "catalog.answers.error.invalid": "Esta resposta não é válida.",
  "catalog.answers.error.out_of_range":
    "Esta resposta está fora do intervalo permitido.",
  "catalog.answers.error.unknown": "Esta resposta não é reconhecida.",
  "catalog.rooms.legend": "Cômodos",
  "catalog.rooms.range": "De 0 a {max}",
  "catalog.rooms.bedrooms": "Quartos",
  "catalog.rooms.bathrooms": "Banheiros",
  "catalog.rooms.kitchens": "Cozinhas",
  "catalog.rooms.livingRooms": "Salas",
  "catalog.rooms.laundryAreas": "Áreas de serviço",
  "catalog.outdoor.legend": "Área externa",
  "catalog.outdoor.none": "Nenhuma",
  "catalog.outdoor.balcony": "Varanda",
  "catalog.outdoor.yard": "Quintal",
  "catalog.outdoor.garden": "Jardim",
  "catalog.pets.legend": "Animais de estimação",
  "catalog.pets.dog": "Cachorro",
  "catalog.pets.cat": "Gato",
  "catalog.pets.fish": "Peixe",
  "catalog.pets.bird": "Pássaro",
  "catalog.pets.other": "Outro tipo de animal",
  "catalog.collection.legend": "Coleta de lixo e de reciclagem",
  "catalog.collection.trash": "Dias da coleta de lixo",
  "catalog.collection.recycling": "Dias da coleta de reciclagem",
  "catalog.habits.legend": "Cozinha e eletrodomésticos",
  "catalog.habits.cooking.legend": "Com que frequência você cozinha em casa?",
  "catalog.habits.cooking.rarely": "Raramente",
  "catalog.habits.cooking.sometimes": "Às vezes",
  "catalog.habits.cooking.daily": "Todos os dias",
  "catalog.habits.dishwasher": "Temos lava-louças",
  "catalog.habits.washingMachine": "Temos máquina de lavar roupa",
  "catalog.regenerate.prompt":
    "Mudar suas respostas sugere os afazeres de novo e perde as suas alterações. Continuar?",
  "catalog.regenerate.confirm": "Sim, sugerir de novo",
  "catalog.regenerate.cancel": "Manter minhas alterações",
  "catalog.review.heading": "Revise os seus afazeres",
  "catalog.review.count": {
    one: "{count} afazer sugerido",
    other: "{count} afazeres sugeridos",
  },
  "catalog.review.empty": "Nenhum afazer foi sugerido.",
  "catalog.review.remove.label": "Remover {name}",
  "catalog.review.remove.prompt": "Remover {name} das sugestões?",
  "catalog.review.remove.confirm": "Sim, remover",
  "catalog.review.remove.cancel": "Manter",
  "catalog.review.removed": "{name} foi removido.",
  "catalog.review.edited": "{name} foi atualizado.",
  "catalog.review.item.invalid":
    "Corrija este afazer antes de criar o seu lar.",
  "catalog.review.tooMany":
    "São afazeres demais para criar de uma vez. Remova alguns e tente de novo.",
  "catalog.review.lists.loading": "Preparando a edição dos afazeres...",
  "catalog.review.lists.error":
    "Algo deu errado ao carregar as listas necessárias para editar afazeres. Tente de novo em instantes.",
  "chores.addFromCatalog": "Adicionar do Catálogo",
  "chores.catalog.heading": "Adicionar do Catálogo",
  "chores.catalog.loading": "Carregando o Catálogo...",
  "chores.catalog.load.offline":
    "O Homeowner não consegue acessar o serviço, então o Catálogo não pôde ser carregado. Confira sua conexão e tente de novo.",
  "chores.catalog.load.error":
    "Algo deu errado ao carregar o Catálogo. Tente de novo em instantes.",
  "chores.catalog.perRoom": "Um para cada cômodo",
  "chores.catalog.add": "Adicionar",
  "chores.catalog.add.label": "Adicionar {name}",
  "chores.catalog.close": "Fechar o Catálogo",
  "catalog.clean_kitchen": "Limpar a cozinha",
  "catalog.wash_dishes": "Lavar a louça",
  "catalog.load_dishwasher": "Colocar e tirar a louça da lava-louças",
  "catalog.clean_fridge": "Limpar a geladeira",
  "catalog.clean_oven": "Limpar o forno",
  "catalog.clean_bathroom": "Limpar o banheiro",
  "catalog.change_bed_linen": "Trocar a roupa de cama",
  "catalog.tidy_living_room": "Arrumar a sala",
  "catalog.clean_laundry_area": "Limpar a área de serviço",
  "catalog.wash_laundry": "Lavar a roupa",
  "catalog.fold_laundry": "Dobrar e guardar a roupa",
  "catalog.vacuum_floors": "Passar aspirador nos pisos",
  "catalog.mop_floors": "Passar pano nos pisos",
  "catalog.put_out_trash": "Colocar o lixo para fora",
  "catalog.put_out_recycling": "Colocar a reciclagem para fora",
  "catalog.sweep_balcony": "Varrer a varanda",
  "catalog.mow_lawn": "Cortar a grama",
  "catalog.sweep_yard": "Varrer o quintal",
  "catalog.weed_garden": "Capinar o jardim",
  "catalog.water_garden": "Regar o jardim",
  "catalog.walk_dog": "Passear com o cachorro",
  "catalog.feed_dog": "Alimentar o cachorro",
  "catalog.bathe_dog": "Dar banho no cachorro",
  "catalog.clean_litter_box": "Limpar a caixa de areia",
  "catalog.feed_cat": "Alimentar o gato",
  "catalog.feed_fish": "Alimentar os peixes",
  "catalog.clean_fish_tank": "Limpar o aquário",
  "catalog.feed_bird": "Alimentar o pássaro",
  "catalog.clean_bird_cage": "Limpar a gaiola",
  "catalog.care_for_pet": "Cuidar do animal de estimação",

  // Onboarding: o passo a passo de instalação, lembretes, perfil e lar para um novo login
  "onboarding.progress": "Configuração: etapa {step} de {total}",
  "onboarding.loading": "Carregando a sua configuração...",
  "onboarding.load.offline":
    "O Homeowner não consegue falar com o serviço, então não sabemos onde você parou. Verifique a sua conexão e tente de novo.",
  "onboarding.load.error":
    "Algo deu errado ao carregar a sua configuração. Tente de novo em instantes.",
  "onboarding.load.notSignedIn":
    "O seu login foi encerrado. Entre de novo para continuar.",
  "onboarding.retry": "Tentar de novo",
  "onboarding.next": "Avançar",
  "onboarding.back": "Voltar",
  "onboarding.advance.offline":
    "Não foi possível falar com o serviço, então você continua nesta etapa. Verifique a sua conexão e tente de novo.",
  "onboarding.advance.error":
    "Algo deu errado ao salvar o seu progresso, então você continua nesta etapa. Tente de novo.",
  "onboarding.advance.notSignedIn":
    "O seu login foi encerrado. Entre de novo para continuar.",
  "onboarding.install.heading": "Adicione o Homeowner à sua Tela de Início",
  "onboarding.install.done": "Já adicionei",
  "onboarding.reminders.heading": "Ative os lembretes",
  "onboarding.reminders.intro":
    "Um aviso neste aparelho quando for hora do seu check-in. O app também pede o check-in sempre que você o abre, então os lembretes são opcionais.",
  "onboarding.reminders.needsInstall":
    "Abra o Homeowner pelo ícone na Tela de Início para ativar os lembretes, ou pule esta etapa.",
  "onboarding.reminders.unsupported":
    "Este navegador não consegue mostrar lembretes.",
  "onboarding.reminders.continue": "Continuar",
  "onboarding.reminders.notNow": "Agora não",
  "onboarding.baseline.heading": "Sua energia base",
  "onboarding.baseline.intro":
    "Quanta energia você costuma ter em cada dia da semana. O check-in de cada dia ajusta isso, então uma estimativa aproximada basta.",
  "onboarding.baseline.incomplete":
    "Digite um número para cada dia, ou 0 para um dia sem afazeres.",
  "onboarding.restrictions.heading": "Suas restrições",
  "onboarding.preferences.heading": "Suas preferências",
  "onboarding.home.heading": "Crie o seu lar",

  // Avisos
  "toast.dismiss": "Dispensar mensagem",
  "toast.region": "Mensagens",
};
