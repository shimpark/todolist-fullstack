import type { CreateTodoRequest, TodoItem, UpdateTodoRequest } from '../types/todo';
import { clearAuth, TOKEN_STORAGE_KEY } from './authApi';

const API_ROOT = import.meta.env.VITE_API_BASE_URL ?? '/api';
const API_BASE = `${API_ROOT}/todos`;

function getAuthHeaders(includeJsonContentType = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function handleUnauthorized(res: Response): void {
  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('인증이 만료되었습니다. 다시 로그인해 주세요.');
  }
}

export async function fetchTodos(): Promise<TodoItem[]> {
  const res = await fetch(API_BASE, {
    headers: getAuthHeaders(),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error('Failed to fetch todos');
  return res.json();
}

export async function createTodo(payload: CreateTodoRequest): Promise<TodoItem> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error('Failed to create todo');
  return res.json();
}

export async function updateTodo(id: number, payload: UpdateTodoRequest): Promise<TodoItem> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error('Failed to update todo');
  return res.json();
}

export async function deleteTodo(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error('Failed to delete todo');
}

export async function clearCompletedTodos(): Promise<void> {
  const res = await fetch(`${API_BASE}/completed`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error('Failed to clear completed todos');
}
