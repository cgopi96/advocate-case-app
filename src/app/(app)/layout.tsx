import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/cases", label: "Cases" },
    { href: "/clients", label: "Clients" },
    { href: "/calendar", label: "Calendar" },
    { href: "/follow-ups", label: "Follow-ups" },
    { href: "/billing", label: "Billing" },
    ...(can.manageUsers(user) ? [{ href: "/users", label: "Users" }] : []),
    ...(can.sendReminders(user) ? [{ href: "/reminders", label: "Reminders" }] : []),
    ...(can.viewAuditLog(user) ? [{ href: "/audit", label: "Audit log" }] : []),
  ];
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold text-indigo-700">
            Case Follow-up
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-slate-600 hover:text-slate-900">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <form action={logout}>
              <button className="btn">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
