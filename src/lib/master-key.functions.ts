import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FALLBACK_KEY = "ADMIN-Rahul";
const SETTING_KEY = "admin_master_key";

/** Public: verifies a candidate master key without ever revealing the stored value. */
export const verifyMasterKey = createServerFn({ method: "POST" })
  .inputValidator((data: { key: string }) => ({ key: String(data?.key ?? "") }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("setting_text")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle();
    const expected = (row?.setting_text ?? FALLBACK_KEY).trim();
    return { valid: data.key.trim() === expected };
  });

/** Admin-only: rotates the stored master key after verifying the current one. */
export const updateMasterKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { currentKey: string; newKey: string }) => ({
    currentKey: String(data?.currentKey ?? ""),
    newKey: String(data?.newKey ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) return { ok: false as const, message: "Forbidden" };


    const newKey = data.newKey.trim();
    if (newKey.length < 6) {
      return { ok: false as const, message: "New key must be at least 6 characters" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("id, setting_text")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle();

    const expected = (row?.setting_text ?? FALLBACK_KEY).trim();
    if (data.currentKey.trim() !== expected) {
      return { ok: false as const, message: "Current key is incorrect" };
    }

    if (row?.id) {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .update({ setting_text: newKey })
        .eq("id", row.id);
      if (error) return { ok: false as const, message: error.message };
    } else {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .insert({ setting_key: SETTING_KEY, setting_value: 0, setting_text: newKey });
      if (error) return { ok: false as const, message: error.message };
    }

    return { ok: true as const, message: "Master key updated" };
  });
