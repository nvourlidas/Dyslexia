// supabase/functions/class-create/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { title, description, active } = payload ?? {};

  if (!title || !String(title).trim()) {
    return fail("MISSING_FIELDS", "Ο τίτλος είναι υποχρεωτικός.", req);
  }

  const admin = adminClient();
  const newId = crypto.randomUUID();

  const { error } = await admin.from("classes").insert({
    id: newId,
    tenant_id: tenantId,
    title: String(title).trim(),
    description: description ? String(description).trim() : null,
    active: active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) return fail("DB_INSERT_FAILED", error.message, req);

  return ok({ id: newId }, req);
});
