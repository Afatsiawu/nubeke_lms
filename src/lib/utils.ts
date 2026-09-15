import type { Copy } from '@/types';

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  year: 'numeric',
  });
}

export function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateStr);
}

export function isOverdue(dueDate: string, returnedAt: string | null): boolean {
  if (returnedAt) return false;
  return new Date(dueDate) < new Date();
}

export function getAvailability(copies: Copy[]): { available: number; total: number } {
  return {
    available: copies.filter((c) => c.status === 'available').length,
    total: copies.length,
  };
}

export function daysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function defaultDueDate(loanDays = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + loanDays);
  return d.toISOString().split('T')[0];
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateMemberCode(existing: string[]): string {
  let max = 0;
  for (const code of existing) {
    const match = code.match(/MBR-(\d+)/);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return `MBR-${String(max + 1).padStart(4, '0')}`;
}

export function generateCopyCode(existing: string[]): string {
  let max = 0;
  for (const code of existing) {
    const match = code.match(/NUB-(\d+)/);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return `NUB-${String(max + 1).padStart(4, '0')}`;
}
