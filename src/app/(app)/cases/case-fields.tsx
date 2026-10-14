import type { Case } from "@prisma/client";
import { Field, STATUS_LABELS } from "@/components/ui";
import { CASE_TYPES } from "@/lib/cases";
import { toDateKey } from "@/lib/dates";

type Option = { id: string; name: string };

export function CaseFields({
  value,
  clients,
  advocates,
  canAssign,
  defaultClientId,
}: {
  value?: Case;
  clients: Option[];
  advocates: Option[];
  canAssign: boolean;
  defaultClientId?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Case number *">
        <input name="caseNumber" required defaultValue={value?.caseNumber} placeholder="O.S. 123/2026" className="input" />
      </Field>
      <Field label="Title *">
        <input name="title" required defaultValue={value?.title} placeholder="Ravi vs. State" className="input" />
      </Field>
      <Field label="Court *">
        <input name="court" required defaultValue={value?.court} placeholder="District Court, Chennai" className="input" />
      </Field>
      <Field label="Case type *">
        <select name="caseType" required defaultValue={value?.caseType ?? ""} className="input">
          <option value="" disabled>
            Select…
          </option>
          {CASE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Client *">
        <select name="clientId" required defaultValue={value?.clientId ?? defaultClientId ?? ""} className="input">
          <option value="" disabled>
            Select…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Opposing party">
        <input name="opposingParty" defaultValue={value?.opposingParty ?? ""} className="input" />
      </Field>
      <Field label="Filing date">
        <input
          name="filingDate"
          type="date"
          defaultValue={value?.filingDate ? toDateKey(value.filingDate) : ""}
          className="input"
        />
      </Field>
      <Field label="Stage">
        <input name="stage" defaultValue={value?.stage ?? ""} placeholder="Evidence, Arguments…" className="input" />
      </Field>
      <Field label="Status *">
        <select name="status" defaultValue={value?.status ?? "OPEN"} className="input">
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {canAssign && (
        <Field label="Assigned advocate">
          <select name="advocateId" defaultValue={value?.advocateId ?? ""} className="input">
            <option value="">Unassigned</option>
            {advocates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
