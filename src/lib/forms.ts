import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { parseDateInput } from "./dates";

export const ok = (): FormState => ({ nonce: Date.now() });

/** Empty strings from forms become null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const requiredText = (max = 200) => z.string().trim().min(1, "is required").max(max);

export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date")
  .transform((v) => parseDateInput(v));

export const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    try {
      return parseDateInput(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "must be a date" });
      return z.NEVER;
    }
  });

export const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, "must be a valid phone number");

/** Turn a zod failure into a readable single-line error. */
export function firstError(error: z.ZodError): FormState {
  const issue = error.issues[0];
  const field = issue?.path.join(".") ?? "";
  const name = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return { error: field ? `The ${name} ${issue.message}.` : issue.message };
}

export function formObject(form: FormData) {
  const obj: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}
