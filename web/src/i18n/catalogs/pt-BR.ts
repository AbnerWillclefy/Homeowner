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
  "health.loading": "Verificando o serviço...",
  "health.ok": "Status do serviço: ok",
  "health.unavailable":
    "Status do serviço: indisponível. O serviço está no ar, mas não consegue acessar o banco de dados.",
  "health.unreachable": "Status do serviço: inacessível. Verifique sua conexão e tente novamente.",
  "health.retry": "Tentar novamente",
  "auth.checking": "Verificando seu login...",

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
  "profile.heading": "Seu perfil",
  "profile.intro":
    "O Homeowner usa isto para dividir os afazeres domésticos de forma justa: dá menos afazeres a você nos dias cansativos e evita o que você não gosta ou não consegue fazer. Seu perfil vai com você se você mudar de lar.",
  "profile.loading": "Carregando seu perfil...",
  "profile.offline": "Não foi possível falar com o serviço, então seu perfil não aparece. Verifique sua conexão e tente de novo.",
  "profile.error": "Algo deu errado ao carregar seu perfil. Tente de novo em instantes.",
  "profile.notSignedIn": "Você não está mais conectado. Entre de novo para ver seu perfil.",
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
  "chores.empty": "O seu lar ainda não tem afazeres. Adicione o primeiro para começar.",
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

  // Settings
  "settings.heading": "Configurações",
  "settings.appearance.label": "Aparência",
  "settings.appearance.system": "Sistema",
  "settings.appearance.light": "Claro",
  "settings.appearance.dark": "Escuro",
  "settings.language.label": "Idioma",
};
