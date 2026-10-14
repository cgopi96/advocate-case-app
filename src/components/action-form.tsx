"use client";

import { useActionState } from "react";
import { FormError } from "./ui";

/** `nonce` changes on each success so the form can reset itself. */
export type FormState = { error?: string; nonce?: number };

/** A form bound to a server action that returns { error } on failure. */
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "space-y-4",
  resetOnSuccess = false,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess ? state.nonce : undefined}
    >
      {children}
      <FormError error={state.error} />
      <button disabled={pending} className="btn-primary">
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
