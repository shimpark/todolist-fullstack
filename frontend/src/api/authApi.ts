import type { AuthRequest, AuthResponse } from '../types/todo';

const API_ROOT = import.meta.env.VITE_API_BASE_URL ?? '/api';
const AUTH_BASE = `${API_ROOT}/auth`;
export const TOKEN_STORAGE_KEY = 'todo_jwt_token';
export const USERNAME_STORAGE_KEY = 'todo_username';

export async function registerUser(payload: AuthRequest): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || '회원가입에 실패했습니다.');
  }
  return res.json();
}

export async function loginUser(payload: AuthRequest): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || '아이디 또는 비밀번호가 올바르지 않습니다.');
  }
  return res.json();
}

export function getStoredAuth(): { token: string; username: string } | null {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const username = localStorage.getItem(USERNAME_STORAGE_KEY);
  if (!token || !username) return null;
  return { token, username };
}

export function saveAuth(auth: AuthResponse): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, auth.token);
  localStorage.setItem(USERNAME_STORAGE_KEY, auth.username);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
}
