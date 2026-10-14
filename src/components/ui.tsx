import Link from "next/link";
import type { CaseStatus } from "@prisma/client";

export const STATUS_LABELS: Record<CaseStatus, string> = {
  OPEN: "Open",
  ADJOURNED: "Adjourned",
  RESERVED: "Reserved for judgment",
  DISPOSED: "Disposed",
  CLOSED: "Closed",
};

const STATUS_STYLES: Record<CaseStatus, string> = {
  OPEN: "bg-green-100 text-green-800",
  ADJOURNED: "bg-amber-100 text-amber-800",
  RESERVED: "bg-indigo-100 text-indigo-800",
  DISPOSED: "bg-slate-200 text-slate-700",
  CLOSED: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {action && (
        <Link href={action.href} className="btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {error}
    </p>
  );
}
