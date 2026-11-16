import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertTimeclockAuthorised,
  performBadgeScan,
  type BadgeScanResult,
} from "./timeclock.server";

const scanSchema = z.object({
  organization_id: z.string().uuid(),
  badge_uid: z.string().trim().min(1).max(128),
  latitude: z.number().finite().nullable().optional(),
  longitude: z.number().finite().nullable().optional(),
});

export type ScanNfcBadgeInput = z.infer<typeof scanSchema>;
export type ScanNfcBadgeResult = BadgeScanResult | {
  ok: false;
  error: "FORBIDDEN";
  message: string;
};

export const scanNfcBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => scanSchema.parse(data))
  .handler(async ({ data, context }): Promise<ScanNfcBadgeResult> => {
    const { supabase, userId } = context;
    const forbidden = await assertTimeclockAuthorised(supabase, userId, data.organization_id);
    if (forbidden) return { ok: false, error: "FORBIDDEN", message: forbidden };

    return performBadgeScan(supabase, {
      organization_id: data.organization_id,
      badge_uid: data.badge_uid,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      source: "nfc_mobile",
    });
  });
