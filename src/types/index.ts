export type StaffRole = 'staff' | 'management';

export interface StaffProfile {
  id: string;
  full_name: string;
  role: StaffRole;
  created_at: string;
}

export type MembershipStatus = 'active' | 'suspended' | 'expired';

export interface Member {
  id: string;
  member_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  membership_status: MembershipStatus;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  subject: string | null;
  call_number: string | null;
  publisher: string | null;
  publication_year: number | null;
  isbn: string | null;
  cover_image_url: string | null;
  description: string | null;
  created_at: string;
}

export type CopyStatus = 'available' | 'borrowed' | 'reserved' | 'lost' | 'under_repair';
export type CopyCondition = 'new' | 'good' | 'fair' | 'poor';

export interface Copy {
  id: string;
  book_id: string;
  copy_code: string;
  status: CopyStatus;
  condition: CopyCondition | null;
  acquired_at: string | null;
  created_at: string;
}

export type LoanStatus = 'active' | 'returned' | 'overdue';

export interface Loan {
  id: string;
  copy_id: string;
  member_id: string;
  staff_id: string | null;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: LoanStatus;
  created_at: string;
}

export type ReservationStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface Reservation {
  id: string;
  book_id: string;
  member_id: string;
  status: ReservationStatus;
  notes: string | null;
  created_at: string;
  fulfilled_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  staff_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface BookWithCopies extends Book {
  copies: Copy[];
}

export interface LoanWithDetails extends Loan {
  copies: Copy;
  members: Member;
}

export interface ReservationWithDetails extends Reservation {
  books: Book;
  members: Member;
}
