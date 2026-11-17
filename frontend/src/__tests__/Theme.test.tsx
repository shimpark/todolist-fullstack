import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import * as authApi from '../api/authApi';
import * as todoApi from '../api/todoApi';
import { THEME_STORAGE_KEY } from '../hooks/useTheme';

vi.mock('../api/todoApi');
vi.mock('../api/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/authApi')>();
  return {
    ...actual,
    loginUser: vi.fn(),
    registerUser: vi.fn(),
  };
});

describe('다크모드 (Theme) 기능', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    authApi.clearAuth();
    vi.mocked(todoApi.fetchTodos).mockResolvedValue([]);
  });

  it('localStorage에 저장된 테마가 없을 때 OS 기본값(라이트)에 맞춰 data-theme="light"가 설정된다', () => {
    render(<App />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button', { name: '다크 모드로 전환' })).toBeInTheDocument();
  });

  it('localStorage에 dark가 저장되어 있으면 초기 마운트 시 data-theme="dark"가 설정된다', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    render(<App />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: '라이트 모드로 전환' })).toBeInTheDocument();
  });

  it('비로그인 화면에서 테마 토글 버튼을 클릭하면 라이트와 다크 모드가 전환된다', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggleBtn = screen.getByRole('button', { name: '다크 모드로 전환' });
    await user.click(toggleBtn);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: '라이트 모드로 전환' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '라이트 모드로 전환' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByRole('button', { name: '다크 모드로 전환' })).toBeInTheDocument();
  });

  it('로그인 완료 후 메인 헤더에서도 테마 토글 버튼이 작동하여 테마가 정상 전환된다', async () => {
    const user = userEvent.setup();
    authApi.saveAuth({ token: 'mock-token', username: 'tester' });

    render(<App />);

    expect(await screen.findByText('Todo List')).toBeInTheDocument();
    expect(screen.getByLabelText('현재 로그인 사용자')).toHaveTextContent('tester');

    const toggleBtn = screen.getByRole('button', { name: '다크 모드로 전환' });
    await user.click(toggleBtn);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('OS 다크모드가 기본 설정되어 있는 경우 초기 마운트 시 data-theme="dark"로 반영된다', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<App />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
