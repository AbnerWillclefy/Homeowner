import { useState } from "react";
import { Confirm } from "./Confirm";
import { SignIn } from "./SignIn";
import { SignUp } from "./SignUp";
import type { MessageKey } from "../i18n";
import type { CognitoResult, SignInResult } from "./cognito";

type Step =
  | { kind: "sign-in"; email?: string; noticeKey?: MessageKey }
  | { kind: "sign-up" }
  | { kind: "confirm"; email: string };

interface Props {
  register(email: string, password: string): Promise<CognitoResult>;
  confirm(email: string, code: string): Promise<CognitoResult>;
  resend(email: string): Promise<CognitoResult>;
  logIn(email: string, password: string): Promise<SignInResult>;
  /** A person with a good Invite is most likely new, so they start on sign-up. */
  startOnSignUp?: boolean;
}

/** Which of the three signed-out screens to show, and where each one leads. */
export function SignedOutFlow({ register, confirm, resend, logIn, startOnSignUp = false }: Props) {
  const [step, setStep] = useState<Step>(startOnSignUp ? { kind: "sign-up" } : { kind: "sign-in" });

  switch (step.kind) {
    case "sign-up":
      return (
        <SignUp
          register={register}
          onRegistered={(email) => setStep({ kind: "confirm", email })}
          onHaveLogin={() => setStep({ kind: "sign-in" })}
        />
      );
    case "confirm":
      return (
        <Confirm
          email={step.email}
          confirm={confirm}
          resend={resend}
          onConfirmed={(email) =>
            setStep({ kind: "sign-in", email, noticeKey: "signIn.confirmedNotice" })
          }
          onBack={() => setStep({ kind: "sign-up" })}
        />
      );
    case "sign-in":
      return (
        <SignIn
          initialEmail={step.email}
          noticeKey={step.noticeKey}
          logIn={logIn}
          onNeedsConfirm={(email) => setStep({ kind: "confirm", email })}
          onNeedsSignUp={() => setStep({ kind: "sign-up" })}
        />
      );
  }
}
