export type PriorityLevel = 0 | 1 | 2; // 0: 낮음 (Low), 1: 보통 (Medium), 2: 높음 (High)
export type TodoCategory = 0 | 1 | 2; // 0: 업무 (Work), 1: 개인 (Personal), 2: 공부 (Study)
export type FilterStatus = 'all' | 'active' | 'completed';
export type PriorityFilter = 'all' | PriorityLevel;
export type CategoryFilter = 'all' | TodoCategory;
export type SortOption = 'createdDesc' | 'dueDateAsc' | 'priorityDesc';

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  username: string;
}

export interface TodoItem {
  id: number;
  title: string;
  isCompleted: boolean;
  priority: PriorityLevel;
  category: TodoCategory;
  dueDate: string | null; // YYYY-MM-DD
  createdAt: string;
}

export interface CreateTodoRequest {
  title: string;
  priority: PriorityLevel;
  category: TodoCategory;
  dueDate: string | null;
}

export interface UpdateTodoRequest {
  title: string;
  isCompleted: boolean;
  priority: PriorityLevel;
  category: TodoCategory;
  dueDate: string | null;
}
