import { ActionForm } from "@/components/action-form";
import { Field, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { changeRole, createUser, resetPassword, setActive } from "./actions";

export default async function UsersPage() {
  const admin = await requireRole("ADMIN");
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const now = new Date();

  return (
    <>
      <PageHeader title="Users" />
      <div className="mb-6 space-y-3">
        {users.map((u) => (
          <div key={u.id} className={`card ${u.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  {u.name} {u.id === admin.id && <span className="text-xs text-slate-500">(you)</span>}
                </div>
                <div className="text-sm text-slate-500">
                  {u.email} {u.phone && `· ${u.phone}`} · {ROLE_LABELS[u.role]}
                  {!u.active && " · Deactivated"}
                  {u.lockedUntil && u.lockedUntil > now && " · Locked"}
                </div>
              </div>
              {u.id !== admin.id && (
                <form action={setActive.bind(null, u.id, !u.active)}>
                  <button className="btn">{u.active ? "Deactivate" : "Activate"}</button>
                </form>
              )}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-indigo-700">Change role or reset password</summary>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <ActionForm action={changeRole.bind(null, u.id)} submitLabel="Change role" className="space-y-2">
                  <Field label="Role">
                    <select name="role" defaultValue={u.role} className="input">
                      {Object.entries(ROLE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </ActionForm>
                <ActionForm action={resetPassword.bind(null, u.id)} submitLabel="Reset password" className="space-y-2" resetOnSuccess>
                  <Field label="New password (10+ characters, a letter and a number)">
                    <input name="password" type="password" autoComplete="new-password" required className="input" />
                  </Field>
                </ActionForm>
              </div>
            </details>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Add user</h2>
        <ActionForm action={createUser} submitLabel="Add user" resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *">
              <input name="name" required className="input" />
            </Field>
            <Field label="Email *">
              <input name="email" type="email" required className="input" />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" />
            </Field>
            <Field label="Role *">
              <select name="role" defaultValue="ADVOCATE" className="input">
                {Object.entries(ROLE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Temporary password * (10+ characters, a letter and a number)" className="sm:col-span-2">
              <input name="password" type="password" autoComplete="new-password" required className="input" />
            </Field>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
