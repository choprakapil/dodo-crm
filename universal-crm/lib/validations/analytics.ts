import { z } from "zod";

export const AnalyticsPresetEnum = z.enum([
  "TODAY",
  "YESTERDAY",
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "THIS_MONTH",
  "LAST_MONTH",
  "THIS_QUARTER",
  "THIS_YEAR",
  "CUSTOM",
]);

export type AnalyticsPreset = z.infer<typeof AnalyticsPresetEnum>;

const dateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  });

export const analyticsQuerySchema = z
  .object({
    preset: AnalyticsPresetEnum.catch("LAST_30_DAYS").default("LAST_30_DAYS"),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    teamId: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
    statusId: z.string().trim().min(1).optional(),
    sourceId: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.preset === "CUSTOM") {
        if (!data.from || !data.to) {
          return false;
        }
        const fromDate = new Date(data.from);
        const toDate = new Date(data.to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
          return false;
        }
        if (fromDate > toDate) {
          return false;
        }
        // Max range limit: 730 days (2 years) to prevent DoS
        const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 730) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Custom preset requires valid 'from' and 'to' dates with from <= to (max 730 days)",
      path: ["from"],
    }
  );

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const analyticsExportSchema = z.object({
  report: z.enum(["team", "statuses", "sources", "pipeline", "activities"]).default("team"),
  preset: AnalyticsPresetEnum.default("LAST_30_DAYS"),
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  teamId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  statusId: z.string().trim().min(1).optional(),
  sourceId: z.string().trim().min(1).optional(),
});

export type AnalyticsExportQuery = z.infer<typeof analyticsExportSchema>;
