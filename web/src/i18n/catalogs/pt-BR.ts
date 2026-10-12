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
  "home.tagline": "Divida os afazeres domésticos do seu lar de forma justa.",
  "health.unavailable":
    "Status do serviço: indisponível. O serviço está no ar, mas não consegue acessar o banco de dados.",
  "health.unreachable": "Status do serviço: inacessível. Verifique sua conexão e tente novamente.",
  "health.retry": "Tentar novamente",
  "auth.checking": "Verificando seu login...",

  // Navegação
  "nav.label": "Principal",
  "nav.today": "Hoje",
  "nav.chores": "Afazeres",
  "nav.home": "Lar",
  "nav.me": "Eu",

  // Lar
  "home.loading": "Carregando o seu lar...",
  "home.load.offline":
    "O Homeowner não consegue acessar o serviço, então não foi possível carregar o seu lar. Verifique sua conexão e tente novamente.",
  "home.load.error": "Algo deu errado ao carregar o seu lar. Tente novamente em instantes.",
  "home.notSignedIn": "Seu login terminou. Entre novamente para continuar.",
  "home.retry": "Tentar novamente",
  "home.create.heading": "Crie o seu lar",
  "home.create.intro":
    "O seu lar é o lugar que você e os outros moradores cuidam juntos. O Homeowner precisa do fuso horário e do horário da alocação para saber quando cada dia começa e quando propor o plano do dia. Você pode mudar os dois depois, e só pode morar em um lar.",
  "home.create.submit": "Criar lar",
  "home.create.submitting": "Criando...",
  "home.create.recovered": "Você já tem um lar, então o Homeowner o carregou. Confira os ajustes dele abaixo.",
  "home.settings.heading": "Seu lar",
  "home.settings.intro":
    "Todos os moradores de um lar têm o mesmo poder de decisão, então qualquer morador pode mudar estes ajustes. O horário da alocação é quando o Homeowner propõe o plano do dia.",
  "home.settings.save": "Salvar alterações",
  "home.settings.saving": "Salvando...",
  "home.settings.saved": "Suas alterações foram salvas.",
  "home.timezone.label": "Fuso horário",
  "home.timezone.hint": "Onde fica o seu lar, para o Homeowner saber quando cada dia começa.",
  "home.allocationTime.label": "Horário da alocação",
  "home.allocationTime.hint":
    "O horário de cada dia em que o Homeowner propõe o plano do dia, no fuso horário do seu lar. Os horários variam de 15 em 15 minutos.",
  "home.save.offline":
    "O Homeowner não consegue acessar o serviço. O que você digitou continua aqui; verifique sua conexão e tente novamente.",
  "home.save.error": "Algo deu errado e nada foi salvo. O que você digitou continua aqui; tente novamente em instantes.",
  "home.leave.heading": "Sair deste lar",
  "home.leave.intro":
    "Se você se mudar ou não dividir mais este lar, pode sair dele. Depois, você pode entrar em outro lar ou criar um novo.",
  "home.leave.open": "Sair deste lar",
  "home.leave.title": "Sair deste lar?",
  "home.leave.removes":
    "Suas preferências e restrições para os afazeres deste lar são apagadas, e o mesmo vale para os seus lugares no plano do dia.",
  "home.leave.stays":
    "Sua energia base e suas preferências e restrições gerais continuam com você e vão para o próximo lar.",
  "home.leave.last":
    "Se você for o último morador, o lar e todos os afazeres dele são apagados, e isso não pode ser desfeito.",
  "home.leave.cancel": "Cancelar",
  "home.leave.confirm": "Sair do lar",
  "home.leave.leaving": "Saindo...",
  "home.leave.offline":
    "O Homeowner não consegue acessar o serviço, então você ainda não saiu. Verifique sua conexão e tente novamente.",
  "home.leave.error": "Algo deu errado e você ainda não saiu. Tente novamente em instantes.",
  "home.invalid.summary": "Alguns dados precisam ser corrigidos. Confira os campos abaixo.",
  "home.field.timezone.required": "Escolha um fuso horário.",
  "home.field.timezone.unknown": "Esse fuso horário não foi reconhecido. Escolha um da lista.",
  "home.field.allocationTime.required": "Escolha um horário da alocação.",
  "home.field.allocationTime.invalid": "Esse horário não é válido. Escolha um da lista.",
  "home.field.allocationTime.not_quarter_hour": "O horário da alocação deve ser em um quarto de hora: :00, :15, :30 ou :45.",
  "home.field.unknown": "Este valor não é aceito. Confira e tente novamente.",

  // Reminders
  "reminders.heading": "Lembretes",
  "reminders.intro":
    "Os lembretes são a única forma de o Homeowner avisar você quando o app está fechado, por exemplo para fazer o check-in de hoje e deixar o seu plano do dia de acordo com como você se sente. São só um aviso: o app funciona sem eles.",
  "reminders.unsupported":
    "Este navegador não consegue mostrar lembretes. No iPhone, você precisa do iOS 16.4 ou mais recente; no Android, use um Chrome atualizado e adicione o Homeowner à tela inicial.",
  "reminders.on": "Os lembretes estão ativados neste dispositivo.",
  "reminders.enable": "Ativar lembretes",
  "reminders.enabling": "Ativando...",
  "reminders.sendTest": "Enviar notificação de teste",
  "reminders.sendingTest": "Enviando...",
  "reminders.sendDelayed": "Enviar em {seconds} segundos",
  "reminders.testPending": "Feche o app agora; a notificação chega em cerca de {seconds} segundos.",
  "reminders.test.ok": "Notificação de teste enviada. Ela deve chegar em alguns segundos.",
  "reminders.test.okDelayed": "Notificação de teste enviada.",
  "reminders.test.notSignedIn": "Você não está mais conectado. Entre de novo para enviar um teste.",
  "reminders.test.unknown": "O serviço ainda não conhece este dispositivo. Ative os lembretes novamente.",
  "reminders.test.gone":
    "O serviço de notificações do seu celular rejeitou este dispositivo, então ele foi removido. Ative os lembretes novamente.",
  "reminders.test.pushServiceError":
    "O serviço de notificações não conseguiu entregar agora. Tente novamente em instantes.",
  "reminders.test.error": "Não foi possível acessar o serviço. Verifique sua conexão e tente novamente.",
  "reminders.problem.denied":
    "As notificações estão bloqueadas para o Homeowner. Abra os Ajustes (ou Configurações) do seu celular, encontre o Homeowner em Notificações, permita-as e volte aqui. O app não pode perguntar uma segunda vez.",
  "reminders.problem.dismissed":
    "Você fechou a pergunta de permissão sem responder. Toque no botão para tentar de novo quando quiser.",
  "reminders.problem.notConfigured":
    "Os lembretes ainda não estão configurados no serviço. Tente novamente mais tarde.",
  "reminders.problem.notSignedIn": "Você não está mais conectado. Entre de novo e depois ative os lembretes.",
  "reminders.problem.error": "Algo deu errado ao ativar os lembretes. Verifique sua conexão e tente novamente.",
  "reminders.problem.browserRegister":
    "Este navegador não conseguiu se registrar no serviço de notificações. Use o Chrome e confirme que o Google Play Services está atualizado.",
  "reminders.problem.browserNotAllowed":
    "As notificações não estão permitidas para este app. Verifique Configurações, Apps, Homeowner, Notificações.",
  "reminders.problem.browserRefused": "Seu navegador se recusou a ativar os lembretes ({name}).",

  // iPhone install steps
  "install.heading": "Adicione o Homeowner à sua Tela de Início",
  "install.intro":
    "Os lembretes avisam você quando o seu check-in está esperando e quais tarefas foram propostas para você. No iPhone, a Apple só permite notificações para apps adicionados à Tela de Início, e é preciso ter o iOS 16.4 ou mais recente.",
  "install.step1": "Abra esta página no Safari (não dentro de outro app).",
  "install.step2": "Toque no botão Compartilhar, o quadrado com uma seta, na parte inferior da tela.",
  "install.step3": "Role para baixo e toque em Adicionar à Tela de Início, depois toque em Adicionar.",
  "install.step4": "Feche o Safari e abra o Homeowner pelo novo ícone na sua Tela de Início.",
  "install.outro": "Quando você abrir o Homeowner pelo ícone, esta página vai permitir ativar os lembretes.",

  // Profile
  "profile.intro":
    "O Homeowner usa isto para dividir os afazeres domésticos de forma justa: dá menos afazeres a você nos dias cansativos e evita o que você não gosta ou não consegue fazer. Seus dados vão com você se você mudar de lar.",
  "profile.loading": "Carregando seus dados...",
  "profile.offline": "Não foi possível falar com o serviço, então seus dados não aparecem. Verifique sua conexão e tente de novo.",
  "profile.error": "Algo deu errado ao carregar seus dados. Tente de novo em instantes.",
  "profile.notSignedIn": "Você não está mais conectado. Entre de novo para ver seus dados.",
  "profile.retry": "Tentar de novo",
  "profile.saved": "Salvo.",
  "profile.saveFailed": "Não foi possível salvar sua alteração, então ela foi desfeita. Verifique sua conexão e tente de novo.",
  "profile.saveFailed.notSignedIn": "Você não está mais conectado, então sua alteração foi desfeita. Entre de novo.",
  "profile.baseline.heading": "Energia base",
  "profile.baseline.explain":
    "Um ponto mede o esforço: o quanto um trabalho cansa, de 1 a 5. Sua energia base é a energia que você costuma ter em cada dia, nesses mesmos pontos; deixe o dia vazio se ainda não souber.",
  "profile.baseline.hint": "Um número inteiro de 0 a 20. É salvo quando você sai do campo.",
  "profile.baseline.invalid": "Digite um número inteiro de 0 a 20, ou deixe vazio.",
  "profile.preferences.heading": "Preferências",
  "profile.preferences.intro":
    "Diga de quais tipos de trabalho você gosta ou não gosta. Os afazeres de que você não gosta chegam a você com menos frequência, mas nunca à custa do que é essencial. O que você não mexer fica neutro.",
  "profile.preference.like": "Gosto",
  "profile.preference.neutral": "Neutro",
  "profile.preference.dislike": "Não gosto",
  "profile.restrictions.heading": "Restrições",
  "profile.restrictions.intro":
    "Marque o que o seu corpo não consegue fazer. Os afazeres que pedem isso nunca são dados a você. Desmarque quando isso mudar.",
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
  "chores.intro":
    "Afazeres são o trabalho que o seu lar precisa que seja feito. O Homeowner divide os afazeres todos os dias, então quanto mais certinha for a descrição de cada um, mais justa é a divisão.",
  "chores.loading": "Carregando os seus afazeres...",
  "chores.load.offline":
    "Não foi possível carregar os seus afazeres porque o Homeowner não consegue falar com o serviço. Confira a sua conexão e tente de novo.",
  "chores.load.error": "Algo deu errado ao carregar os seus afazeres. Tente de novo daqui a pouco.",
  "chores.notSignedIn": "Seu login terminou. Entre de novo para continuar.",
  "chores.retry": "Tentar de novo",
  "chores.empty": "O seu lar ainda não tem afazeres. Toque em \"Adicionar afazer\" para criar o seu, ou em \"Adicionar do Catálogo\" para partir de um pronto.",
  "chores.add": "Adicionar afazer",
  "chores.item.effort": "Esforço {effort} de 5",
  "chores.item.people.one": "1 pessoa",
  "chores.item.people.two": "2 pessoas",
  "chores.item.once": "Uma vez só",
  "chores.item.daily": "Todo dia",
  "chores.item.every": "A cada {days} dias",
  "chores.item.weekdays": "Só em {days}",
  "chores.item.buildsUp": "Acumula enquanto não é feito",
  "chores.item.edit": "Editar",
  "chores.item.edit.label": "Editar {name}",
  "chores.item.delete": "Excluir",
  "chores.item.delete.label": "Excluir {name}",
  "chores.delete.prompt": "Excluir {name}? Isso não pode ser desfeito.",
  "chores.delete.confirm": "Sim, excluir",
  "chores.delete.cancel": "Manter",
  "chores.delete.deleting": "Excluindo...",
  "chores.delete.offline":
    "O afazer não foi excluído porque o Homeowner não consegue falar com o serviço. Confira a sua conexão e tente de novo.",
  "chores.delete.error": "Algo deu errado e o afazer não foi excluído. Tente de novo daqui a pouco.",
  "chores.delete.notSignedIn": "Seu login terminou, então o afazer não foi excluído. Entre de novo para continuar.",
  "chores.form.create.heading": "Adicionar afazer",
  "chores.form.edit.heading": "Editar afazer",
  "chores.form.name.label": "Nome",
  "chores.form.name.hint": "Como o afazer se chama, por exemplo \"Lavar a louça\".",
  "chores.form.category.label": "Categoria",
  "chores.form.category.hint": "Que tipo de trabalho é. Ela define quem gosta ou não gosta dele.",
  "chores.form.category.placeholder": "Escolha uma categoria",
  "chores.form.demands.legend": "Exigências",
  "chores.form.demands.hint":
    "O que o afazer pede do corpo. Moradores com uma restrição correspondente nunca recebem esse afazer.",
  "chores.form.baseEffort.legend": "Esforço",
  "chores.form.baseEffort.hint": "O quanto cansa cada pessoa que o faz, de 1 (bem leve) a 5 (bem cansativo).",
  "chores.form.baseEffort.option": "{effort}",
  "chores.form.importance.legend": "Importância",
  "chores.form.importance.hint": "O quanto importa que isso seja feito. Os afazeres essenciais são divididos primeiro.",
  "chores.form.people.legend": "Pessoas necessárias",
  "chores.form.people.hint": "Se um morador faz sozinho ou se dois fazem juntos.",
  "chores.form.people.one": "Uma pessoa",
  "chores.form.people.two": "Duas pessoas",
  "chores.form.suggestion": "Um afazer tão cansativo fica mais leve em dupla. Você pode torná-lo um afazer para duas pessoas.",
  "chores.form.suggestion.action": "Tornar para duas pessoas",
  "chores.form.intervalDays.label": "Repetir a cada (dias)",
  "chores.form.intervalDays.hint": "Deixe em branco para um afazer que vence uma vez só.",
  "chores.form.allowedWeekdays.legend": "Só nestes dias",
  "chores.form.allowedWeekdays.hint": "Marque os dias em que ele pode ser dado a alguém. Não marque nenhum para permitir qualquer dia.",
  "chores.form.buildsUp.label": "Acumula enquanto não é feito",
  "chores.form.buildsUp.hint":
    "Marque se deixar de fazer o torna mais difícil, como a roupa se acumulando. O esforço dele então cresce a cada dia que passa sem ser feito.",
  "chores.form.submit.create": "Adicionar afazer",
  "chores.form.submit.save": "Salvar afazer",
  "chores.form.saving": "Salvando...",
  "chores.form.cancel": "Cancelar",
  "chores.form.saved": "O afazer foi salvo.",
  "chores.form.invalid.summary": "Alguns dados precisam de ajuste. Confira os campos abaixo.",
  "chores.form.save.offline":
    "O afazer não foi salvo porque o Homeowner não consegue falar com o serviço. O que você digitou continua aqui; confira a sua conexão e tente de novo.",
  "chores.form.save.error":
    "Algo deu errado e o afazer não foi salvo. O que você digitou continua aqui; tente de novo daqui a pouco.",
  "chores.form.save.notSignedIn": "Seu login terminou, então o afazer não foi salvo. Entre de novo para continuar.",
  "chores.form.save.gone": "Este afazer não existe mais, talvez porque outro morador o excluiu.",
  "chores.field.name.required": "Dê um nome ao afazer.",
  "chores.field.name.too_long": "Esse nome é longo demais. Use 100 caracteres ou menos.",
  "chores.field.category.required": "Escolha uma categoria.",
  "chores.field.category.unknown": "Essa categoria não é reconhecida. Escolha uma da lista.",
  "chores.field.importance.required": "Escolha uma importância.",
  "chores.field.importance.unknown": "Essa importância não é reconhecida. Escolha uma da lista.",
  "chores.field.demands.unknown": "Uma das exigências não é reconhecida. Desmarque-a e tente de novo.",
  "chores.field.baseEffort.required": "Escolha um esforço de 1 a 5.",
  "chores.field.baseEffort.invalid": "O esforço deve ser um número inteiro de 1 a 5.",
  "chores.field.baseEffort.out_of_range": "O esforço deve ser de 1 a 5.",
  "chores.field.people.required": "Escolha uma ou duas pessoas.",
  "chores.field.people.invalid": "O número de pessoas deve ser 1 ou 2.",
  "chores.field.people.out_of_range": "Um afazer precisa de uma ou duas pessoas.",
  "chores.field.intervalDays.required": "Digite quantos dias, ou deixe em branco para um afazer de uma vez só.",
  "chores.field.intervalDays.invalid": "Digite um número inteiro de dias, ou deixe em branco para um afazer de uma vez só.",
  "chores.field.intervalDays.out_of_range": "Repita a cada 1 a 365 dias, ou deixe em branco para um afazer de uma vez só.",
  "chores.field.allowedWeekdays.invalid": "Um dos dias não é válido. Desmarque-o e tente de novo.",
  "chores.field.allowedWeekdays.out_of_range": "Um dos dias não é válido. Desmarque-o e tente de novo.",
  "chores.field.unknown": "Este valor não é aceito. Confira e tente de novo.",

  // Hoje (o plano do dia)
  "dayplan.heading": "Hoje",
  "dayplan.intro":
    "Todos os dias, no horário da alocação do seu lar, o Homeowner propõe quem faz quais tarefas, sem pedir a ninguém mais energia do que tem. Este é o plano do dia de hoje. É uma proposta: nada aqui é definitivo.",
  "dayplan.loading": "Carregando o plano de hoje...",
  "dayplan.load.offline":
    "Não foi possível carregar o plano de hoje porque o Homeowner não consegue falar com o serviço. Confira a sua conexão e tente de novo.",
  "dayplan.load.error": "Algo deu errado ao carregar o plano de hoje. Tente de novo daqui a pouco.",
  "dayplan.notSignedIn": "Seu login terminou. Entre de novo para continuar.",
  "dayplan.retry": "Tentar de novo",
  "dayplan.notPlanned":
    "O plano de hoje ainda não foi feito. O Homeowner planeja o dia do seu lar às {time}, então volte depois disso. Estas são as tarefas em aberto entre as quais ele vai escolher.",
  "dayplan.rejected":
    "Não foi possível usar o plano de hoje, então nenhuma tarefa foi dada a ninguém hoje. As suas tarefas em aberto continuam listadas abaixo.",
  "dayplan.greeting.morning": "Bom dia",
  "dayplan.greeting.afternoon": "Boa tarde",
  "dayplan.greeting.evening": "Boa noite",
  "dayplan.chip.label": "Energia de hoje: {text}",
  "dayplan.chip.unset": "Faça o check-in para definir a energia de hoje",
  "dayplan.chip.noBaseline": "Defina a sua energia base para ter energia",
  "dayplan.chip.drained": "Esgotado hoje, sem tarefas",
  "dayplan.chip.energy": "Energia {energy}",
  "dayplan.chip.pending": "Check-in feito",
  "dayplan.mine.empty.noBaseline":
    "Você não tem energia base para este dia da semana, então a sua energia é 0 e nenhuma tarefa foi dada a você. Quando quiser, defina a sua energia base para receber tarefas nesse dia.",
  "dayplan.mine.empty.noBaseline.link": "Definir a energia base",
  "dayplan.mine.heading": "Suas tarefas",
  "dayplan.mine.empty": "Nada para você hoje. Aproveite o dia.",
  "dayplan.others.heading": "Tarefas dos outros moradores",
  "dayplan.others.resident": "Morador {number}",
  "dayplan.pool.heading": "Ainda por fazer",
  "dayplan.pool.intro": "Tarefas em aberto que não foram dadas a ninguém hoje, e o motivo.",
  "dayplan.pool.empty": "Nenhuma outra tarefa em aberto. Tudo está planejado ou feito.",
  "dayplan.task.effort": "Esforço {effort}",
  "dayplan.task.effort.grown": "Esforço {effort} (normalmente {base})",
  "dayplan.task.due": "Para {date}",
  "dayplan.task.reason": "Por quê: {reason}",
  "dayplan.assigned.reason.deadline_today": "Vence hoje.",
  "dayplan.assigned.reason.importance": "É a que mais importa.",
  "dayplan.assigned.reason.lateness": "É a que espera há mais tempo.",
  "dayplan.assigned.reason.fits_energy": "Cabe na sua energia.",
  "dayplan.pool.reason.no_energy_left": "Ninguém tem energia suficiente sobrando hoje.",
  "dayplan.pool.reason.restricted_for_all": "Ninguém pode fazer: todos os moradores têm uma restrição sobre ela.",
  "dayplan.pool.reason.weekday_not_allowed": "Não é permitida neste dia da semana.",
  "dayplan.pool.reason.two_person_deferred": "Precisa de duas pessoas, e as duas não estavam livres hoje.",
  "dayplan.pool.reason.invalid_effort": "O esforço dela não é válido, então ficou de fora. Edite o afazer para corrigir.",
  "dayplan.pool.reason.added_after_plan": "Foi adicionada depois que o plano de hoje foi feito.",
  "dayplan.mine.empty.drained": "Você fez check-in como esgotado, então nenhuma tarefa foi dada a você hoje. Descanse.",

  // The start choice, at the end of both onboarding flows
  "startChoice.heading": "Quando você quer as suas tarefas?",
  "startChoice.intro":
    "O seu lar divide as tarefas todos os dias no horário da alocação. Você pode começar agora ou esperar a próxima.",
  "startChoice.now.button": "Receber minhas tarefas agora",
  "startChoice.now.hint":
    "O Homeowner planeja só você, agora, entre as tarefas em aberto que ninguém recebeu hoje. As tarefas dos outros moradores não mudam.",
  "startChoice.tomorrow.button": "Começar amanhã",
  "startChoice.tomorrow.hint": "Esperar a próxima alocação diária. Nada é planejado para você até lá.",
  "startChoice.planning": "Planejando as suas tarefas...",
  "startChoice.retry": "Tentar de novo",
  "startChoice.failed.offline":
    "Parece que você está sem internet, então as suas tarefas não foram planejadas. Verifique a conexão e tente de novo.",
  "startChoice.failed.error": "Algo deu errado ao planejar as suas tarefas. Tente de novo daqui a pouco.",
  "startChoice.done.tasks": "As suas tarefas de hoje estão prontas. Você pode vê-las em Hoje, logo abaixo.",
  "startChoice.done.noEnergy":
    "A sua energia de hoje é 0, então nenhuma tarefa foi dada a você. Se você não tem energia base para este dia da semana, defina-a na aba Eu para receber tarefas nesse dia.",
  "startChoice.done.nothing": "Não sobrou nenhuma tarefa em aberto para você hoje. Aproveite o dia.",
  "startChoice.done.close": "Entendi",

  // Check-in
  "checkin.heading": "Check-in",
  "checkin.intro":
    "Conte ao Homeowner quanta energia você tem hoje. Ela ajusta a sua energia base só para hoje, para que as suas tarefas combinem com o seu dia. Você pode mudar mais tarde hoje, e as suas tarefas serão planejadas de novo.",
  "checkin.loading": "Carregando o seu check-in...",
  "checkin.load.offline":
    "Não foi possível carregar o seu check-in porque o Homeowner não consegue acessar o serviço. Verifique a sua conexão e tente de novo.",
  "checkin.load.error": "Algo deu errado ao carregar o seu check-in. Tente de novo em instantes.",
  "checkin.notSignedIn": "O seu login terminou. Entre de novo para continuar.",
  "checkin.retry": "Tentar de novo",
  "checkin.level.legend": "Como está a sua energia hoje?",
  "checkin.level.drained": "Esgotado",
  "checkin.level.drained.hint": "Nenhuma energia. Você não recebe tarefas hoje.",
  "checkin.level.low": "Baixa",
  "checkin.level.low.hint": "Metade da sua energia de sempre, então menos tarefas e mais leves.",
  "checkin.level.normal": "Normal",
  "checkin.level.normal.hint": "A sua energia de sempre, a da sua energia base.",
  "checkin.level.energized": "Energizado",
  "checkin.level.energized.hint": "Um pouco mais do que de costume, então dá para assumir mais.",
  "checkin.level.required": "Escolha como está a sua energia hoje e salve.",
  "checkin.restrictions.legend": "Há algo que o seu corpo não aguenta hoje?",
  "checkin.restrictions.hint":
    "Marque o que você não consegue fazer hoje, como carregar peso com dor nas costas. Vale só para hoje e não muda as restrições da aba Eu.",
  "checkin.submit": "Salvar check-in",
  "checkin.saving": "Salvando...",
  "checkin.cancel": "Cancelar",
  "checkin.change": "Mudar",
  "checkin.saved": "Check-in salvo. O plano de hoje foi atualizado.",
  "checkin.save.offline":
    "O seu check-in não foi salvo porque o Homeowner não consegue acessar o serviço. Verifique a sua conexão e tente de novo.",
  "checkin.save.error": "Algo deu errado ao salvar o seu check-in. Tente de novo em instantes.",
  "checkin.save.invalid": "O Homeowner não aceitou esse check-in. Escolha de novo e tente mais uma vez.",
  "checkin.summary": "Check-in de hoje: {level}",
  "checkin.summary.restrictions": "Não hoje: {demands}",

  // Cadastro
  "signUp.heading": "Cadastrar-se",
  "signUp.intro":
    "O Homeowner é para as pessoas que cuidam juntas de um lar. Cadastrar-se dá a você um login só seu, então a sua energia base, as suas preferências e as suas restrições são suas e acompanham você, não importa quem mais more no lar.",
  "signUp.emailLabel": "E-mail",
  "signUp.emailHint":
    "Seu e-mail é o seu login. Também enviamos um código para ele na próxima etapa, que comprova que o e-mail é mesmo seu.",
  "signUp.passwordLabel": "Senha",
  "signUp.passwordHint": "Ela impede que outra pessoa entre como você.",
  "signUp.confirmLabel": "Confirmar senha",
  "signUp.mismatch": "As duas senhas não são iguais.",
  "signUp.submit": "Cadastrar",
  "signUp.submitting": "Cadastrando...",
  "signUp.haveLogin": "Já se cadastrou?",
  "signUp.haveLoginAction": "Entrar",

  // Entrar
  "signIn.heading": "Entrar",
  "signIn.intro":
    "Entrar diz ao Homeowner de quem mostrar o check-in e as tarefas. Você continua com o login ativo neste dispositivo até sair.",
  "signIn.confirmedNotice": "Seu e-mail foi confirmado. Entre para começar.",
  "signIn.emailLabel": "E-mail",
  "signIn.passwordLabel": "Senha",
  "signIn.submit": "Entrar",
  "signIn.submitting": "Entrando...",
  "signIn.newHere": "Novo por aqui?",
  "signIn.newHereAction": "Cadastrar-se",

  // Confirmar e-mail
  "confirm.heading": "Confirme seu e-mail",
  "confirm.intro":
    "Enviamos um código para {email}. Digitá-lo comprova que o e-mail é seu, para que ninguém se cadastre em seu nome nem assuma as suas preferências. Até você fazer isso, não é possível entrar.",
  "confirm.spamHint": "O e-mail pode levar um minuto e pode cair na pasta de spam.",
  "confirm.codeLabel": "Código do e-mail",
  "confirm.submit": "Confirmar",
  "confirm.submitting": "Verificando...",
  "confirm.resend": "Enviar um novo código",
  "confirm.useOtherEmail": "Usar outro e-mail",
  "confirm.resent": "Um novo código está a caminho. Use o e-mail mais recente.",

  // Conectado
  "signedIn.heading": "Você está conectado",
  "signedIn.as": "Conectado como {email}.",
  "signedIn.emailFallback": "seu e-mail",
  "signedIn.offline":
    "O Homeowner não consegue acessar o serviço agora, então este é o último login que este dispositivo lembra. Abra o app de novo quando estiver online para conferir.",
  "signedIn.signOut": "Sair",

  // Compartilhado pelas telas de login
  "auth.showPassword": "Mostrar senha",

  "auth.failure.alreadyRegistered":
    "Esse e-mail já está cadastrado. Entre com ele ou, se você nunca digitou o código, confirme-o.",
  "auth.failure.invalidPassword": "Essa senha não é forte o bastante. Escolha outra senha. {rules}",
  "auth.failure.invalidInput": "Confira o e-mail e os dados que você digitou e tente novamente.",
  "auth.failure.wrongCode": "Esse código não está certo. Confira o e-mail mais recente e tente novamente.",
  "auth.failure.expiredCode": "Esse código expirou. Solicite um novo código e use o e-mail mais recente.",
  "auth.failure.notConfirmed":
    "Confirme seu e-mail primeiro: digite o código que enviamos ou solicite um novo código.",
  "auth.failure.notAuthorized": "O e-mail ou a senha não está certo. Confira os dois e tente novamente.",
  "auth.failure.rateLimited": "Muitas tentativas. Espere alguns minutos e tente novamente.",
  "auth.failure.network": "Não foi possível acessar o serviço de login. Verifique sua conexão e tente novamente.",
  "auth.failure.error": "Algo deu errado. Tente novamente em instantes.",

  // Regras da senha
  "auth.rule.length": { one: "Pelo menos {count} caractere", other: "Pelo menos {count} caracteres" },
  "auth.rule.lowercase": "Uma letra minúscula",
  "auth.rule.uppercase": "Uma letra maiúscula",
  "auth.rule.number": "Um número",
  "auth.rule.symbol": "Um símbolo",
  "auth.rule.status.met": "{rule}: cumprida",
  "auth.rule.status.notMet": "{rule}: ainda não cumprida",
  "auth.rule.announce.met": "{rule} cumprida.",
  "auth.rule.announce.notMet": "{rule} não cumprida.",
  "auth.rule.announce.count": { one: "{met} de {count} regra cumprida.", other: "{met} de {count} regras cumpridas." },
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
  "invite.signedOut.intro":
    "Um morador convidou você para o lar dele. Crie um login, ou entre se você já tem um, e você passa a ser morador, com o mesmo poder de decisão no lar. Seu convite fica salvo neste aparelho, então você pode confirmar seu e-mail e voltar a ele.",
  "invite.lookup.problem":
    "O Homeowner não conseguiu verificar seu convite agora. O link foi guardado, então você ainda pode entrar e tentar de novo.",
  "invite.dead.not_found":
    "Este link de convite não é válido. Ele pode ter sido copiado errado. Peça um novo convite ao morador.",
  "invite.dead.used": "Este convite já foi usado. Um convite funciona só uma vez, então peça um novo ao morador.",
  "invite.dead.expired": "Este convite expirou. Um convite dura sete dias, então peça um novo ao morador.",
  "invite.dead.continue": "Continuar",
  "invite.join.heading": "Entrar em um lar",
  "invite.join.loading": "Preparando seu convite...",
  "invite.join.intro":
    "Você foi convidado para um lar. Entrar faz de você um morador, com o mesmo poder de decisão. Se quiser, preencha antes sua energia base, suas preferências e suas restrições abaixo: o Homeowner usa isso para dividir o trabalho de forma justa. Você também pode fazer isso depois de entrar.",
  "invite.join.submit": "Entrar neste lar",
  "invite.join.submitting": "Entrando...",
  "invite.join.dismiss": "Agora não",
  "invite.leave.heading": "Entrar significa sair do seu lar",
  "invite.leave.warning":
    "Você já mora em um lar, e um login pode ser morador de apenas um. Entrar neste significa sair do seu lar atual. Suas preferências e restrições para os afazeres dele são apagadas. Se você for o último morador, o lar e todos os afazeres dele também são apagados.",
  "invite.leave.confirm": "Sair do meu lar e entrar neste",
  "invite.leave.cancel": "Ficar no meu lar",
  "invite.alreadyHere": "Você já mora neste lar, então não havia o que fazer. O convite não foi gasto.",
  "invite.failure.offline":
    "O Homeowner não consegue acessar o serviço, então você ainda não entrou. Seu convite foi guardado; verifique sua conexão e tente de novo.",
  "invite.failure.error":
    "Algo deu errado e você ainda não entrou. Seu convite foi guardado; tente de novo em instantes.",
  "invite.failure.notSignedIn": "Você não está mais conectado. Entre de novo para continuar.",
  "invite.failure.retry": "Tentar de novo",
  "invite.rating.heading": "Avalie os afazeres mais pesados",
  "invite.rating.intro":
    "Agora você é morador. Estes são os afazeres mais exigentes do lar, pelo esforço. Diga ao Homeowner de quais você gosta ou não gosta e marque os que você não consegue fazer, para que suas primeiras tarefas combinem com você. Cada escolha é salva sozinha e você pode mudar depois.",
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
  "invite.share.intro":
    "Um convite é um link que você pode enviar por qualquer app. Ele funciona uma vez e dura sete dias. Quem abrir pode entrar no seu lar, então envie só para a pessoa que você quer.",
  "invite.share.button": "Convidar um morador",
  "invite.share.creating": "Criando o convite...",
  "invite.share.title": "Entre no meu lar no Homeowner",
  "invite.share.text": "Entre no meu lar no Homeowner. Este link funciona uma vez e dura sete dias.",
  "invite.share.shared": "Seu convite está pronto e foi passado ao app que você escolheu.",
  "invite.share.copied": "O link do convite foi copiado. Cole em uma mensagem para enviar.",
  "invite.share.cancelled":
    "O convite não foi enviado. O link dele continua valendo, caso você o tenha criado por engano; peça outro só se precisar.",
  "invite.share.failed": "Não foi possível compartilhar nem copiar o link do convite. Tente de novo.",
  "invite.share.tooMany":
    "Seu lar já tem o máximo de convites abertos. Espere alguns serem usados ou expirarem.",
  "invite.share.noHome": "Você precisa de um lar antes de convidar alguém.",
  "invite.share.offline":
    "O Homeowner não consegue acessar o serviço, então nenhum convite foi criado. Verifique sua conexão e tente de novo.",
  "invite.share.error": "Algo deu errado e nenhum convite foi criado. Tente de novo em instantes.",

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
    "Você já tem um lar, então o Homeowner carregou esse lar. Os afazeres que você revisou não foram adicionados; adicione-os pelo Catálogo na seção de afazeres.",
  "catalog.questions.heading": "Sobre o seu lar",
  "catalog.questions.intro":
    "Algumas respostas permitem que o Homeowner sugira os afazeres de que o seu lar precisa, para você não começar com a lista vazia. Nada é salvo ainda, e você pode mudar cada sugestão na próxima etapa. Deixe como está o que não se aplicar.",
  "catalog.questions.submit": "Sugerir afazeres",
  "catalog.questions.submitting": "Preparando os seus afazeres...",
  "catalog.questions.skip": "Pular e adicionar afazeres depois",
  "catalog.questions.invalid": "Algumas respostas precisam de ajuste. Confira os campos abaixo.",
  "catalog.questions.offline":
    "O Homeowner não consegue acessar o serviço, então nenhum afazer foi sugerido. Suas respostas continuam aqui; confira sua conexão e tente de novo.",
  "catalog.questions.error":
    "Algo deu errado ao sugerir afazeres. Suas respostas continuam aqui; tente de novo em instantes.",
  "catalog.answers.error.invalid": "Esta resposta não é válida.",
  "catalog.answers.error.out_of_range": "Esta resposta está fora do intervalo permitido.",
  "catalog.answers.error.unknown": "Esta resposta não é reconhecida.",
  "catalog.rooms.legend": "Cômodos",
  "catalog.rooms.hint": "Cada cômodo recebe os próprios afazeres; dois banheiros significam dois afazeres de banheiro.",
  "catalog.rooms.range": "De 0 a {max}",
  "catalog.rooms.bedrooms": "Quartos",
  "catalog.rooms.bathrooms": "Banheiros",
  "catalog.rooms.kitchens": "Cozinhas",
  "catalog.rooms.livingRooms": "Salas",
  "catalog.rooms.laundryAreas": "Áreas de serviço",
  "catalog.outdoor.legend": "Área externa",
  "catalog.outdoor.hint": "Define se afazeres da área externa, como varrer ou cortar a grama, são sugeridos.",
  "catalog.outdoor.none": "Nenhuma",
  "catalog.outdoor.balcony": "Varanda",
  "catalog.outdoor.yard": "Quintal",
  "catalog.outdoor.garden": "Jardim",
  "catalog.pets.legend": "Animais de estimação",
  "catalog.pets.hint": "Cada animal adiciona afazeres de alimentação e cuidado. Não marque nada se você não tem animais.",
  "catalog.pets.dog": "Cachorro",
  "catalog.pets.cat": "Gato",
  "catalog.pets.fish": "Peixe",
  "catalog.pets.bird": "Pássaro",
  "catalog.pets.other": "Outro tipo de animal",
  "catalog.collection.legend": "Coleta de lixo e de reciclagem",
  "catalog.collection.hint":
    "Marque os dias em que a coleta passa. O afazer de colocar o lixo para fora fica limitado a esses dias. Deixe o grupo vazio se não há coleta.",
  "catalog.collection.trash": "Dias da coleta de lixo",
  "catalog.collection.recycling": "Dias da coleta de reciclagem",
  "catalog.habits.legend": "Cozinha e eletrodomésticos",
  "catalog.habits.hint":
    "Cozinhar em casa com mais frequência pede mais cuidado com a cozinha. Os eletrodomésticos que você tem mudam os afazeres sugeridos.",
  "catalog.habits.cooking.legend": "Com que frequência você cozinha em casa?",
  "catalog.habits.cooking.rarely": "Raramente",
  "catalog.habits.cooking.sometimes": "Às vezes",
  "catalog.habits.cooking.daily": "Todos os dias",
  "catalog.habits.dishwasher": "Temos lava-louças",
  "catalog.habits.washingMachine": "Temos máquina de lavar roupa",
  "catalog.regenerate.prompt":
    "Você mudou suas respostas, então os afazeres sugeridos serão calculados de novo e as suas alterações neles serão perdidas. Continuar?",
  "catalog.regenerate.confirm": "Sim, sugerir de novo",
  "catalog.regenerate.cancel": "Manter minhas alterações",
  "catalog.review.heading": "Revise os seus afazeres",
  "catalog.review.intro":
    "Estes são os afazeres que o Homeowner sugere a partir das suas respostas. Edite os que não servirem e remova os que você não quer; depois, crie o seu lar. Você pode adicionar ou mudar afazeres a qualquer momento.",
  "catalog.review.count": { one: "{count} afazer sugerido", other: "{count} afazeres sugeridos" },
  "catalog.review.empty":
    "Nenhum afazer foi sugerido. Você pode criar o seu lar agora e adicionar afazeres do Catálogo depois.",
  "catalog.review.edit": "Editar",
  "catalog.review.remove": "Remover",
  "catalog.review.remove.label": "Remover {name}",
  "catalog.review.remove.prompt": "Remover {name} das sugestões?",
  "catalog.review.remove.confirm": "Sim, remover",
  "catalog.review.remove.cancel": "Manter",
  "catalog.review.removed": "{name} foi removido.",
  "catalog.review.edited": "{name} foi atualizado.",
  "catalog.review.item.invalid": "Corrija este afazer antes de criar o seu lar.",
  "catalog.review.tooMany": "São afazeres demais para criar de uma vez. Remova alguns e tente de novo.",
  "catalog.review.lists.loading": "Preparando a edição dos afazeres...",
  "catalog.review.lists.error":
    "Algo deu errado ao carregar as listas necessárias para editar afazeres. Tente de novo em instantes.",
  "chores.addFromCatalog": "Adicionar do Catálogo",
  "chores.catalog.heading": "Adicionar do Catálogo",
  "chores.catalog.intro":
    "O Catálogo é a lista de afazeres comuns do Homeowner. Escolha um para adicioná-lo ao seu lar; você pode mudar qualquer coisa antes de salvar. Escolha de novo um afazer de cômodo para adicioná-lo a outro cômodo.",
  "chores.catalog.loading": "Carregando o Catálogo...",
  "chores.catalog.load.offline":
    "O Homeowner não consegue acessar o serviço, então o Catálogo não pôde ser carregado. Confira sua conexão e tente de novo.",
  "chores.catalog.load.error": "Algo deu errado ao carregar o Catálogo. Tente de novo em instantes.",
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
  "onboarding.load.error": "Algo deu errado ao carregar a sua configuração. Tente de novo em instantes.",
  "onboarding.load.notSignedIn": "O seu login foi encerrado. Entre de novo para continuar.",
  "onboarding.retry": "Tentar de novo",
  "onboarding.next": "Avançar",
  "onboarding.back": "Voltar",
  "onboarding.saving": "Salvando...",
  "onboarding.advance.offline":
    "Não foi possível falar com o serviço, então você continua nesta etapa. Verifique a sua conexão e tente de novo.",
  "onboarding.advance.error": "Algo deu errado ao salvar o seu progresso, então você continua nesta etapa. Tente de novo.",
  "onboarding.advance.notSignedIn": "O seu login foi encerrado. Entre de novo para continuar.",
  "onboarding.install.heading": "Adicione o Homeowner à sua Tela de Início",
  "onboarding.install.why":
    "No iPhone, a Apple só deixa um app enviar notificações depois que ele está na sua Tela de Início. Adicioná-lo agora permite que a próxima etapa ative os lembretes, e o Homeowner abre como qualquer outro app. O seu progresso fica salvo: quando você abrir o Homeowner pelo ícone e entrar de novo, continua daqui.",
  "onboarding.install.done": "Já adicionei",
  "onboarding.reminders.heading": "Ative os lembretes",
  "onboarding.reminders.why":
    "O Homeowner decide todo dia quem faz qual tarefa, e só consegue avisar você com o app fechado por meio de uma notificação. Sem lembretes, você teria que se lembrar de abrir o app. São só um aviso: nada deixa de funcionar se você pular esta etapa, e dá para ativá-los depois.",
  "onboarding.reminders.needsInstall":
    "Os lembretes só podem ser ativados depois que você abrir o Homeowner pelo ícone na Tela de Início. Continue por lá para retomar esta etapa, ou pule por enquanto.",
  "onboarding.reminders.unsupported":
    "Este navegador não consegue mostrar lembretes, então não há nada para ativar aqui. Você pode continuar sem eles.",
  "onboarding.reminders.continue": "Continuar",
  "onboarding.reminders.notNow": "Agora não",
  "onboarding.baseline.heading": "Sua energia base",
  "onboarding.baseline.why":
    "Sua energia base é a energia que você costuma ter em cada dia da semana. O Homeowner a usa como ponto de partida para decidir quanto esforço dar a você, e o seu check-in diário diz como hoje se compara. Pedimos os sete dias para que ela se encaixe na sua semana; digite 0 num dia em que você não consegue fazer nenhum afazer.",
  "onboarding.baseline.incomplete":
    "Digite um número para cada dia da semana antes de continuar. Use 0 se você não consegue fazer nenhum afazer naquele dia.",
  "onboarding.restrictions.heading": "Suas restrições",
  "onboarding.restrictions.why":
    "Alguns trabalhos exigem demais do corpo, como carregar peso ou usar produtos químicos fortes. Contar isso ao Homeowner agora faz com que um afazer com essa exigência nunca seja dado a você. Se nada disso se aplica a você, deixe tudo desmarcado: essa também é uma resposta completa.",
  "onboarding.preferences.heading": "Suas preferências",
  "onboarding.preferences.why":
    "Todo mundo gosta mais de alguns afazeres domésticos do que de outros. Suas preferências ajudam o Homeowner a dar a você mais do trabalho de que você gosta e menos do que não gosta, e a dividir em rodízio o trabalho de que ninguém gosta. Deixar um tipo de trabalho como neutro é uma boa resposta.",
  "onboarding.home.heading": "Crie o seu lar",
  "onboarding.home.why":
    "A última etapa. O seu lar é onde acontece a divisão diária. As próximas perguntas dizem ao Homeowner quando os seus dias começam e o que o seu lar precisa que seja feito, para que ele sugira os primeiros afazeres para você revisar. Você pode mudar tudo depois.",

  // Avisos
  "toast.dismiss": "Dispensar mensagem",
  "toast.region": "Mensagens",
};
