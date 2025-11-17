export type Role = 'user' | 'model';

export interface Message {
  role: Role;
  text: string;
}

export interface Transaction {
  id: number;
  created_at: string;
  description: string;
  amount: number;
  type: 'receita' | 'despesa';
}

export interface Task {
  id: number;
  created_at: string;
  description: string;
  is_completed: boolean;
  due_at?: string | null;
  duration: number | null;
  google_calendar_event_id?: string | null;
}
