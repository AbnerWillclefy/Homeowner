interface Props {
  email: string | null;
  offline: boolean;
  onSignOut(): void;
}

export function SignedIn({ email, offline, onSignOut }: Props) {
  return (
    <section aria-labelledby="signedin-heading">
      <h2 id="signedin-heading">You are signed in</h2>
      <p>
        Signed in as <strong>{email ?? "your email"}</strong>.
      </p>
      {offline && (
        <p role="status">
          Homeowner cannot reach the service right now, so this is the last sign-in this device remembers. Open
          the app again when you are back online to check.
        </p>
      )}
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  );
}
