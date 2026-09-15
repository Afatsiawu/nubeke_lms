import { supabase } from './supabase';

export async function logAction(
  staffId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await supabase.from('audit_log').insert({
    staff_id: staffId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    details: details ?? null,
  });
}
