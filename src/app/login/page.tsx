"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Case Follow-up</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" autoComplete="username" required className="input" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className="input" />
        </label>
        {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
