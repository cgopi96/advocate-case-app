"use client";

import { startTransition, useActionState } from "react";
import { FormError } from "./ui";

/** `nonce` changes on each success so the form can reset itself. */
export type FormState = { error?: string; nonce?: number; message?: string };

/**
 * A form bound to a server action that returns { error } on failure.
 * Submits through onSubmit rather than the `action` prop, because React
 * clears a form's fields after an action runs, and a user who hits a
 * validation error should keep what they typed.
 */
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
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className={className}
      key={resetOnSuccess ? state.nonce : undefined}
    >
      {children}
      <FormError error={state.error} />
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
      <button disabled={pending} className="btn-primary">
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
