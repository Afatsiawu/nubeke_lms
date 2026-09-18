import { supabase } from './supabase';
import { logAction } from './audit';

export type OpType =
  | 'loan_insert'
  | 'loan_update'
  | 'copy_update'
  | 'book_insert'
  | 'book_update'
  | 'book_delete'
  | 'copy_insert'
  | 'copy_delete'
  | 'member_insert'
  | 'member_update'
  | 'audit_log';

export interface QueuedOp {
  id: string;
  type: OpType;
  table: string;
  payload: Record<string, unknown>;
  filters?: Record<string, unknown>;
  staffId?: string;
  auditAction?: string;
  auditEntityType?: string;
  auditEntityId?: string;
  auditDetails?: Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
  retries: number;
}

const DB_NAME = 'nubuke_offline_queue';
const STORE = 'pending_ops';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueOp(
  type: OpType,
  table: string,
  payload: Record<string, unknown>,
  opts?: {
    filters?: Record<string, unknown>;
    staffId?: string;
    auditAction?: string;
    auditEntityType?: string;
    auditEntityId?: string;
    auditDetails?: Record<string, unknown>;
  }
): Promise<string> {
  const op: QueuedOp = {
    id: genId(),
    type,
    table,
    payload,
    filters: opts?.filters,
    staffId: opts?.staffId,
    auditAction: opts?.auditAction,
    auditEntityType: opts?.auditEntityType,
    auditEntityId: opts?.auditEntityId,
    auditDetails: opts?.auditDetails,
    createdAt: Date.now(),
    status: 'pending',
    retries: 0,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(op);
    tx.oncomplete = () => { db.close(); resolve(op.id); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getPendingOps(): Promise<QueuedOp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as QueuedOp[]).filter((op) => op.status === 'pending' || op.status === 'failed'));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getPendingCount(): Promise<number> {
  const ops = await getPendingOps();
  return ops.length;
}

export async function removeOp(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function updateOpStatus(id: string, status: QueuedOp['status'], error?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const op = getReq.result as QueuedOp | undefined;
      if (op) {
        op.status = status;
        op.error = error;
        op.retries = (op.retries || 0) + 1;
        store.put(op);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function executeOp(op: QueuedOp): Promise<void> {
  let result;

  switch (op.type) {
    case 'loan_insert': {
      result = await supabase.from(op.table).insert(op.payload).select().single();
      if (result.error) throw result.error;
      // After loan insert, also update the copy status
      if (op.filters && op.filters.copy_id) {
        await supabase.from('copies').update({ status: 'borrowed' }).eq('id', op.filters.copy_id);
      }
      break;
    }
    case 'loan_update': {
      result = await supabase.from(op.table).update(op.payload);
      if (op.filters) {
        for (const [key, val] of Object.entries(op.filters)) {
          result = result.eq(key, val as string | number);
        }
      }
      result = await result;
      if (result.error) throw result.error;
      // After loan return, also update copy status
      if (op.filters && op.filters.copy_id) {
        await supabase.from('copies').update({ status: 'available' }).eq('id', op.filters.copy_id as string);
      }
      break;
    }
    case 'copy_update': {
      result = supabase.from(op.table).update(op.payload);
      if (op.filters) {
        for (const [key, val] of Object.entries(op.filters)) {
          result = result.eq(key, val as string | number);
        }
      }
      result = await result;
      if (result.error) throw result.error;
      break;
    }
    case 'book_insert': {
      result = await supabase.from(op.table).insert(op.payload);
      if (result.error) throw result.error;
      break;
    }
    case 'book_update': {
      result = supabase.from(op.table).update(op.payload);
      if (op.filters) {
        for (const [key, val] of Object.entries(op.filters)) {
          result = result.eq(key, val as string | number);
        }
      }
      result = await result;
      if (result.error) throw result.error;
      break;
    }
    case 'book_delete': {
      result = supabase.from(op.table).delete();
      if (op.filters) {
        for (const [key, val] of Object.entries(op.filters)) {
          result = result.eq(key, val as string | number);
        }
      }
      result = await result;
      if (result.error) throw result.error;
      break;
    }
    case 'copy_insert': {
      result = await supabase.from(op.table).insert(op.payload);
      if (result.error) throw result.error;
      break;
    }
    case 'copy_delete': {
      result = supabase.from(op.table).delete();
      if (op.filters) {
        for (const [key, val] of Object.entries(op.filters)) {
          result = result.eq(key, val as string | number);
        }
      }
      result = await result;
      if (result.error) throw result.error;
      break;
    }
    case 'member_insert': {
      result = await supabase.from(op.table).insert(op.payload);
      if (result.error) throw result.error;
      break;
    }
    case 'member_update': {
      result = supabase.from(op.table).update(op.payload);
      if (op.filters) {
        for (const [key, val] of Object.entries(op.filters)) {
          result = result.eq(key, val as string | number);
        }
      }
      result = await result;
      if (result.error) throw result.error;
      break;
    }
    case 'audit_log': {
      if (op.staffId && op.auditAction) {
        await logAction(op.staffId, op.auditAction, op.auditEntityType ?? '', op.auditEntityId, op.auditDetails);
      }
      break;
    }
    default:
      throw new Error(`Unknown op type: ${op.type}`);
  }
}

export async function syncQueue(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const ops = await getPendingOps();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const op of ops) {
    try {
      await updateOpStatus(op.id, 'syncing');
      await executeOp(op);
      await removeOp(op.id);
      synced++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (op.retries >= 3) {
        await removeOp(op.id);
        failed++;
        errors.push(`Op ${op.type}: ${msg} (dropped after 3 retries)`);
      } else {
        await updateOpStatus(op.id, 'failed', msg);
        failed++;
        errors.push(`Op ${op.type}: ${msg}`);
      }
    }
  }

  return { synced, failed, errors };
}

export function isOnline(): boolean {
  return navigator.onLine;
}
