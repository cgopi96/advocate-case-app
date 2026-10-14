import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "must be at least 10 characters")
  .max(200)
  .regex(/[A-Za-z]/, "must contain a letter")
  .regex(/[0-9]/, "must contain a number");
