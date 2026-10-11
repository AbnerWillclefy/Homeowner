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

  // Settings
  "settings.heading": "Configurações",
  "settings.appearance.label": "Aparência",
  "settings.appearance.system": "Sistema",
  "settings.appearance.light": "Claro",
  "settings.appearance.dark": "Escuro",
  "settings.language.label": "Idioma",
};
