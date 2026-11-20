import { Banner, Button, Card, EmptyState, Input, Skeleton } from "@homeowner/bedrock";
import { ArrowUp, ChevronLeft, Clock, MessageCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import type { Savings } from "../goals/api";
import { savingsKey } from "../goals/hooks/useSavings";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { PageHeader } from "../../shared/PageHeader";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { useAsk } from "./hooks/useAsk";
import { MAX_QUESTION, questionLength, requestMessages, type Turn } from "./logic/conversation";
import { parseFrom, pathOfScreenKey, type ScreenKey } from "./logic/screenKeys";
import { suggestionsFor } from "./logic/suggestions";

const DESKTOP = "(min-width: 1024px)";
/** The counter shows from here, as the artboard draws it. */
const COUNTER_FROM = 450;

type Status = "idle" | "working" | "error" | "limit";

const bubble = "max-w-[85%] rounded-lg px-4 py-3 whitespace-pre-wrap [overflow-wrap:anywhere]";

/**
 * "Perguntar" at `/chat?from=<screen>`. The conversation lives in this component's state, never in the query cache,
 * so leaving the route clears it; keyed by `from`, so opening the chat from another screen starts again too.
 */
export function ChatPage() {
  const from = parseFrom(useSearchParams()[0].get("from"));
  return <Conversation key={from} from={from} />;
}

function Conversation({ from }: { from: ScreenKey }) {
  const { t, locale } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const ask = useAsk();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // The input is disabled while waiting, which drops its focus: give it back once an answer is in.
  const answered = status === "idle" && turns.length > 0;
  useEffect(() => {
    if (answered) input.current?.focus();
  }, [answered, turns.length]);

  const send = (next: Turn[]) => {
    setTurns(next);
    setStatus("working");
    setRemaining(null);
    ask.mutate(
      { screen: from, locale, messages: requestMessages(next) },
      {
        onSuccess: (result) => {
          if (result.kind === "answer") {
            setTurns([...next, { role: "assistant", text: result.answer }]);
            setRemaining(result.remaining);
            setStatus("idle");
          } else if (result.kind === "limit") {
            // The limit is a notice, not a reply, and the unanswered question goes.
            setTurns(next.slice(0, -1));
            setStatus("limit");
          } else setStatus("error");
        },
      },
    );
  };

  const question = draft.trim();
  const length = questionLength(question);
  const tooLong = length > MAX_QUESTION;
  const blocked = status === "working" || status === "limit";

  // A question that failed and was not retried is replaced, so the turns keep alternating.
  const sendQuestion = (text: string) => {
    setDraft("");
    send([...(status === "error" ? turns.slice(0, -1) : turns), { role: "user", text }]);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blocked || question === "" || tooLong) return;
    sendQuestion(question);
  };

  // Read, never fetched: a Goal name only shows when the Goals screen already loaded the savings.
  const goal = useQueryClient().getQueryData<Savings>(savingsKey)?.goals[0]?.name;
  const suggestions = suggestionsFor(from, goal);

  return (
    <>
      <div className="flex items-center gap-2">
        {!desktop && (
          <Link
            to={pathOfScreenKey(from)}
            aria-label={t("chat.back")}
            className="flex size-control-lg shrink-0 items-center justify-center rounded-md text-text outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <PageHeader title={t("chat.title")} subtitle={desktop ? t("chat.subtitle") : undefined} />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[45rem] flex-1 flex-col gap-4">
        <div role="group" aria-label={t("chat.log")} aria-live="polite" className="flex flex-1 flex-col gap-4">
          {turns.length === 0 && status !== "limit" && <EmptyState icon={MessageCircle} title={t("chat.empty.title")} message={t("chat.empty.text")} />}
          {turns.length === 0 && status === "idle" && (
            <div role="group" aria-label={t("chat.suggest")} className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const text = t(s.key, s.vars);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => sendQuestion(text)}
                    className="body min-h-control-lg rounded-full border border-border bg-surface px-4 py-2 text-left text-text-muted outline-none hover:bg-surface-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          )}
          {turns.map((turn, i) => (
            <p key={i} className={`${bubble} ${turn.role === "user" ? "self-end rounded-br-sm bg-brand text-on-brand" : "self-start rounded-bl-sm border border-border bg-surface"}`}>
              {turn.text}
            </p>
          ))}
          {status === "working" && (
            <div role="status" className={`${bubble} flex w-[70%] flex-col gap-2 self-start rounded-bl-sm border border-border bg-surface`}>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <span className="caption text-text-muted">{t("chat.working")}</span>
            </div>
          )}
          {status === "idle" && remaining !== null && <span className="caption text-text-muted">{t(remaining === 1 ? "chat.left.one" : "chat.left.many", { count: remaining })}</span>}
          {status === "error" && (
            <Banner
              tone="danger"
              action={<Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => send(turns)}>{t("chat.retry")}</Button>}
            >
              {t("chat.error")}
              <br />
              <span className="caption text-text-muted">{t("chat.error.note")}</span>
            </Banner>
          )}
          {status === "limit" && (
            <Card variant="compact" role="status" className="flex-row items-center gap-3">
              <Clock aria-hidden className="size-4 shrink-0 text-text-muted" />
              <span>{t("chat.limit")}</span>
            </Card>
          )}
        </div>
        <div className="sticky bottom-0 flex flex-col gap-2 bg-bg pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <form onSubmit={submit} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Input
                ref={input}
                label={t("chat.input.label")}
                hideLabel
                placeholder={t("chat.input.placeholder")}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={blocked}
                autoComplete="off"
                hint={length >= COUNTER_FROM ? t("chat.counter", { n: length, max: MAX_QUESTION }) : undefined}
                error={tooLong ? t("chat.tooLong", { max: MAX_QUESTION }) : undefined}
              />
            </div>
            <Button type="submit" size="lg" className="w-12 shrink-0 px-0" disabled={blocked || question === "" || tooLong} icon={ArrowUp}>
              <span className="sr-only">{t("chat.send")}</span>
            </Button>
          </form>
          <p className="caption text-center text-text-muted">{t("chat.disclaimer")}</p>
        </div>
      </div>
    </>
  );
}
