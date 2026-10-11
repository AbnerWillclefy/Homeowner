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

  // Settings
  "settings.heading": "Configurações",
  "settings.appearance.label": "Aparência",
  "settings.appearance.system": "Sistema",
  "settings.appearance.light": "Claro",
  "settings.appearance.dark": "Escuro",
  "settings.language.label": "Idioma",
};
