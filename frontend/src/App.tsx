import { useEffect, useMemo, useState, type FormEvent } from 'react';
import zxcvbn from 'zxcvbn';
import {
  clearAuth,
  getStoredAuth,
  loginUser,
  registerUser,
  saveAuth,
} from './api/authApi';
import {
  clearCompletedTodos,
  createTodo,
  deleteTodo,
  fetchTodos,
  updateTodo,
} from './api/todoApi';
import type {
  CategoryFilter,
  FilterStatus,
  PriorityFilter,
  PriorityLevel,
  SortOption,
  TodoCategory,
  TodoItem,
} from './types/todo';
import { useTheme } from './hooks/useTheme';
import './App.css';

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  0: '낮음',
  1: '보통',
  2: '높음',
};

const PRIORITY_CLASSES: Record<PriorityLevel, string> = {
  0: 'badge-low',
  1: 'badge-medium',
  2: 'badge-high',
};

const CATEGORY_LABELS: Record<TodoCategory, string> = {
  0: '업무',
  1: '개인',
  2: '공부',
};

const CATEGORY_CLASSES: Record<TodoCategory, string> = {
  0: 'category-work',
  1: 'category-personal',
  2: 'category-study',
};

const ZXCVBN_SCORE_LABELS: Record<number, string> = {
  0: '매우 취약',
  1: '취약',
  2: '보통 (사용 불가)',
  3: '강함 (안전)',
  4: '매우 강함 (매우 안전)',
};

function formatDateOffset(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type DueStatus = 'overdue' | 'today' | 'soon' | 'upcoming' | null;

function getDueStatus(dueDate: string | null, isCompleted: boolean): DueStatus {
  if (!dueDate || isCompleted) return null;
  const today = formatDateOffset(0);
  const tomorrow = formatDateOffset(1);
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  if (dueDate === tomorrow) return 'soon';
  return 'upcoming';
}

export interface PasswordRuleResult {
  lengthValid: boolean;
  upperAndLowerValid: boolean;
  digitValid: boolean;
  specialCharValid: boolean;
  noSpaceOrUsernameValid: boolean;
  zxcvbnScore: number;
  zxcvbnValid: boolean;
  allValid: boolean;
  firstError: string | null;
}

export function evaluatePasswordRules(username: string, password: string): PasswordRuleResult {
  const lengthValid = password.length >= 8 && password.length <= 64;
  const hasWhitespace = /\s/.test(password);
  const upperAndLowerValid = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const digitValid = /[0-9]/.test(password);
  const specialCharValid = /[^A-Za-z0-9\s]/.test(password);
  const trimmedUsername = username.trim();
  const containsUsername =
    trimmedUsername.length >= 2 &&
    password.toLowerCase().includes(trimmedUsername.toLowerCase());
  const noSpaceOrUsernameValid =
    password.length > 0 && !hasWhitespace && !containsUsername;

  // Dropbox zxcvbn 라이브러리를 통한 엔트로피/사전 단어/키보드 패턴 분석 (0~4점)
  const zxcvbnAnalysis = password
    ? zxcvbn(password, trimmedUsername ? [trimmedUsername] : [])
    : null;
  const zxcvbnScore = zxcvbnAnalysis ? zxcvbnAnalysis.score : 0;
  const zxcvbnValid = zxcvbnScore >= 3;

  let firstError: string | null = null;
  if (!lengthValid) {
    firstError = '비밀번호는 8자 이상 64자 이하여야 합니다.';
  } else if (hasWhitespace) {
    firstError = '비밀번호에는 공백을 포함할 수 없습니다.';
  } else if (!upperAndLowerValid) {
    firstError = '비밀번호에는 영문 대문자와 소문자가 모두 포함되어야 합니다.';
  } else if (!digitValid) {
    firstError = '비밀번호에는 숫자가 최소 1자 이상 포함되어야 합니다.';
  } else if (!specialCharValid) {
    firstError = '비밀번호에는 특수문자가 최소 1자 이상 포함되어야 합니다.';
  } else if (containsUsername) {
    firstError = '비밀번호에 아이디를 포함할 수 없습니다.';
  } else if (!zxcvbnValid) {
    firstError =
      '추측하기 쉬운 단어(예: password, qwerty)나 단순 패턴이 포함되어 있습니다. 더 복잡한 비밀번호를 사용해 주세요.';
  }

  return {
    lengthValid,
    upperAndLowerValid,
    digitValid,
    specialCharValid,
    noSpaceOrUsernameValid,
    zxcvbnScore,
    zxcvbnValid,
    allValid:
      lengthValid &&
      upperAndLowerValid &&
      digitValid &&
      specialCharValid &&
      noSpaceOrUsernameValid &&
      zxcvbnValid,
    firstError,
  };
}

function App() {
  const { isDark, toggleTheme } = useTheme();

  // Auth state
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return getStoredAuth()?.username ?? null;
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Todo Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<TodoCategory>(0);
  const [newPriority, setNewPriority] = useState<PriorityLevel>(1);
  const [newDueDate, setNewDueDate] = useState('');

  // Filter / Search / Sort / Due Alert state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('createdDesc');
  const [onlyDueAlerts, setOnlyDueAlerts] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Inline Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingCategory, setEditingCategory] = useState<TodoCategory>(0);
  const [editingPriority, setEditingPriority] = useState<PriorityLevel>(1);
  const [editingDueDate, setEditingDueDate] = useState('');

  useEffect(() => {
    const onUnauthorized = () => {
      setCurrentUser(null);
      setTodos([]);
      setAuthError('세션이 만료되었습니다. 다시 로그인해 주세요.');
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadTodos();
    } else {
      setTodos([]);
      setLoading(false);
    }
  }, [currentUser]);

  const passwordRules = useMemo(
    () => evaluatePasswordRules(usernameInput, passwordInput),
    [usernameInput, passwordInput]
  );

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedUser = usernameInput.trim();
    if (trimmedUser.length < 2 || trimmedUser.length > 50) {
      setAuthError('아이디는 2자 이상 50자 이하여야 합니다.');
      return;
    }

    if (authMode === 'register') {
      if (!passwordRules.allValid) {
        setAuthError(passwordRules.firstError ?? '비밀번호 보안 규칙을 모두 충족해야 합니다.');
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        setAuthError('비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    } else {
      if (!passwordInput) {
        setAuthError('비밀번호를 입력해 주세요.');
        return;
      }
    }

    try {
      setAuthError(null);
      const response =
        authMode === 'login'
          ? await loginUser({ username: trimmedUser, password: passwordInput })
          : await registerUser({ username: trimmedUser, password: passwordInput });

      saveAuth(response);
      setCurrentUser(response.username);
      setUsernameInput('');
      setPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : authMode === 'login'
          ? '로그인에 실패했습니다.'
          : '회원가입에 실패했습니다.'
      );
    }
  }

  function handleLogout() {
    clearAuth();
    setCurrentUser(null);
    setTodos([]);
    setOnlyDueAlerts(false);
    setAlertDismissed(false);
  }

  async function loadTodos() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTodos();
      setTodos(data);
    } catch {
      setError('서버에서 할 일 목록을 불러오지 못했습니다. 백엔드 서버가 실행 중인지 확인하세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setError(null);
      const created = await createTodo({
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        dueDate: newDueDate ? newDueDate : null,
      });
      setTodos((prev) => [created, ...prev]);
      setNewTitle('');
      setNewCategory(0);
      setNewPriority(1);
      setNewDueDate('');
    } catch {
      setError('할 일을 추가하지 못했습니다.');
    }
  }

  async function handleToggle(todo: TodoItem) {
    try {
      setError(null);
      const updated = await updateTodo(todo.id, {
        title: todo.title,
        isCompleted: !todo.isCompleted,
        category: todo.category,
        priority: todo.priority,
        dueDate: todo.dueDate,
      });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    } catch {
      setError('상태 변경에 실패했습니다.');
    }
  }

  function startEdit(todo: TodoItem) {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
    setEditingCategory(todo.category);
    setEditingPriority(todo.priority);
    setEditingDueDate(todo.dueDate ?? '');
  }

  async function handleSaveEdit(todo: TodoItem) {
    if (!editingTitle.trim()) return;
    try {
      setError(null);
      const updated = await updateTodo(todo.id, {
        title: editingTitle.trim(),
        isCompleted: todo.isCompleted,
        category: editingCategory,
        priority: editingPriority,
        dueDate: editingDueDate ? editingDueDate : null,
      });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
      setEditingId(null);
    } catch {
      setError('수정에 실패했습니다.');
    }
  }

  async function handleDelete(id: number) {
    try {
      setError(null);
      await deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) {
        setEditingId(null);
      }
    } catch {
      setError('삭제에 실패했습니다.');
    }
  }

  async function handleClearCompleted() {
    try {
      setError(null);
      await clearCompletedTodos();
      setTodos((prev) => prev.filter((t) => !t.isCompleted));
    } catch {
      setError('완료된 항목 삭제에 실패했습니다.');
    }
  }

  // 마감일 알림 요약 집계
  const dueAlertSummary = useMemo(() => {
    let overdueCount = 0;
    let todayCount = 0;
    let soonCount = 0;

    for (const todo of todos) {
      const status = getDueStatus(todo.dueDate, todo.isCompleted);
      if (status === 'overdue') overdueCount++;
      else if (status === 'today') todayCount++;
      else if (status === 'soon') soonCount++;
    }

    const totalAlertCount = overdueCount + todayCount + soonCount;
    return { overdueCount, todayCount, soonCount, totalAlertCount };
  }, [todos]);

  const filteredAndSortedTodos = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    const filtered = todos.filter((todo) => {
      if (onlyDueAlerts) {
        const dueStatus = getDueStatus(todo.dueDate, todo.isCompleted);
        if (dueStatus !== 'overdue' && dueStatus !== 'today' && dueStatus !== 'soon') {
          return false;
        }
      }
      if (keyword && !todo.title.toLowerCase().includes(keyword)) {
        return false;
      }
      if (statusFilter === 'active' && todo.isCompleted) {
        return false;
      }
      if (statusFilter === 'completed' && !todo.isCompleted) {
        return false;
      }
      if (categoryFilter !== 'all' && todo.category !== categoryFilter) {
        return false;
      }
      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === 'priorityDesc') {
        if (b.priority !== a.priority) return b.priority - a.priority;
      } else if (sortOption === 'dueDateAsc') {
        if (a.dueDate && b.dueDate) {
          const cmp = a.dueDate.localeCompare(b.dueDate);
          if (cmp !== 0) return cmp;
        } else if (a.dueDate && !b.dueDate) {
          return -1;
        } else if (!a.dueDate && b.dueDate) {
          return 1;
        }
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    todos,
    onlyDueAlerts,
    searchQuery,
    statusFilter,
    categoryFilter,
    priorityFilter,
    sortOption,
  ]);

  // 비로그인 상태일 때 로그인/회원가입 화면 표시
  if (!currentUser) {
    return (
      <div className="todo-container auth-container">
        <div className="auth-header-row">
          <header className="todo-header" style={{ textAlign: 'left', marginBottom: 0 }}>
            <h1>Todo List</h1>
            <p className="subtitle">개인 할 일 관리를 위해 로그인하세요</p>
          </header>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            <span className="theme-icon">{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? '라이트' : '다크'}</span>
          </button>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={`tab-btn ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('login');
              setAuthError(null);
            }}
          >
            로그인
          </button>
          <button
            type="button"
            className={`tab-btn ${authMode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('register');
              setAuthError(null);
            }}
          >
            회원가입
          </button>
        </div>

        {authError && <div className="error-banner">{authError}</div>}

        <form className="auth-form" onSubmit={handleAuthSubmit}>
          <label className="auth-field">
            <span>아이디</span>
            <input
              type="text"
              className="todo-input"
              placeholder="아이디 입력 (2~50자)"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
            />
          </label>
          <label className="auth-field">
            <span>비밀번호</span>
            <input
              type="password"
              className="todo-input"
              placeholder={
                authMode === 'register'
                  ? '비밀번호 입력 (8자 이상, 대/소/숫자/특수문자)'
                  : '비밀번호 입력'
              }
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </label>

          {authMode === 'register' && (
            <>
              <label className="auth-field">
                <span>비밀번호 확인</span>
                <input
                  type="password"
                  className="todo-input"
                  placeholder="비밀번호 재입력"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                />
              </label>

              <div className="zxcvbn-meter" aria-label="비밀번호 강도 게이지">
                <div className="zxcvbn-header">
                  <span>보안 강도 (zxcvbn):</span>
                  <strong className={passwordRules.zxcvbnValid ? 'rule-ok' : 'rule-pending'}>
                    {passwordInput ? ZXCVBN_SCORE_LABELS[passwordRules.zxcvbnScore] : '미입력'}
                  </strong>
                </div>
                <div className="zxcvbn-bars">
                  {[0, 1, 2, 3].map((idx) => (
                    <span
                      key={idx}
                      className={`zxcvbn-bar ${
                        passwordInput && passwordRules.zxcvbnScore > idx
                          ? passwordRules.zxcvbnValid
                            ? 'bar-strong'
                            : 'bar-weak'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <ul className="password-rules" aria-label="비밀번호 보안 규칙">
                <li className={passwordRules.lengthValid ? 'rule-ok' : 'rule-pending'}>
                  {passwordRules.lengthValid ? '✓' : '•'} 8~64자 길이
                </li>
                <li className={passwordRules.upperAndLowerValid ? 'rule-ok' : 'rule-pending'}>
                  {passwordRules.upperAndLowerValid ? '✓' : '•'} 영문 대문자 및 소문자 포함
                </li>
                <li className={passwordRules.digitValid ? 'rule-ok' : 'rule-pending'}>
                  {passwordRules.digitValid ? '✓' : '•'} 숫자 최소 1자 포함
                </li>
                <li className={passwordRules.specialCharValid ? 'rule-ok' : 'rule-pending'}>
                  {passwordRules.specialCharValid ? '✓' : '•'} 특수문자(!@#$ 등) 최소 1자 포함
                </li>
                <li className={passwordRules.noSpaceOrUsernameValid ? 'rule-ok' : 'rule-pending'}>
                  {passwordRules.noSpaceOrUsernameValid ? '✓' : '•'} 공백 및 아이디 미포함
                </li>
                <li className={passwordRules.zxcvbnValid ? 'rule-ok' : 'rule-pending'}>
                  {passwordRules.zxcvbnValid ? '✓' : '•'} 사전 단어·단순 패턴 없음 (zxcvbn 3점 이상)
                </li>
              </ul>
            </>
          )}

          <button type="submit" className="btn btn-primary auth-submit-btn">
            {authMode === 'login' ? '로그인하기' : '회원가입 완료'}
          </button>
        </form>
      </div>
    );
  }

  const totalCount = todos.length;
  const activeCount = todos.filter((t) => !t.isCompleted).length;
  const completedCount = totalCount - activeCount;

  return (
    <div className="todo-container">
      <header className="todo-header todo-header-with-user">
        <div className="header-title-group">
          <h1>Todo List</h1>
          <p className="subtitle">ASP.NET Core 8 + React + TypeScript + SQLite</p>
        </div>
        <div className="user-bar">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            <span className="theme-icon">{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? '라이트' : '다크'}</span>
          </button>
          <span className="user-badge" aria-label="현재 로그인 사용자">
            👤 {currentUser}
          </span>
          <button type="button" className="btn btn-small btn-ghost" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 상단 마감일 알림 배너 */}
      {!loading && !alertDismissed && dueAlertSummary.totalAlertCount > 0 && (
        <div className="due-alert-banner" role="alert">
          <div className="due-alert-info">
            <span className="due-alert-title">🔔 마감 알림</span>
            <div className="due-alert-counts">
              {dueAlertSummary.overdueCount > 0 && (
                <span className="alert-pill pill-overdue">
                  기한 초과 {dueAlertSummary.overdueCount}건
                </span>
              )}
              {dueAlertSummary.todayCount > 0 && (
                <span className="alert-pill pill-today">
                  오늘 마감 {dueAlertSummary.todayCount}건
                </span>
              )}
              {dueAlertSummary.soonCount > 0 && (
                <span className="alert-pill pill-soon">
                  마감 임박 {dueAlertSummary.soonCount}건
                </span>
              )}
            </div>
          </div>
          <div className="due-alert-actions">
            <button
              type="button"
              className={`btn btn-small ${onlyDueAlerts ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setOnlyDueAlerts((prev) => !prev)}
            >
              {onlyDueAlerts ? '마감 알림 필터 해제' : '마감 알림 항목만 보기'}
            </button>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              aria-label="알림 닫기"
              onClick={() => {
                setAlertDismissed(true);
                setOnlyDueAlerts(false);
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 할 일 추가 폼 */}
      <form className="todo-form" onSubmit={handleAdd}>
        <div className="todo-form-main">
          <input
            type="text"
            className="todo-input"
            placeholder="새로운 할 일을 입력하세요..."
            maxLength={200}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            추가
          </button>
        </div>
        <div className="todo-form-options">
          <label className="form-option">
            <span>카테고리</span>
            <select
              className="todo-select"
              aria-label="카테고리 선택"
              value={newCategory}
              onChange={(e) => setNewCategory(Number(e.target.value) as TodoCategory)}
            >
              <option value={0}>업무</option>
              <option value={1}>개인</option>
              <option value={2}>공부</option>
            </select>
          </label>
          <label className="form-option">
            <span>우선순위</span>
            <select
              className="todo-select"
              aria-label="우선순위 선택"
              value={newPriority}
              onChange={(e) => setNewPriority(Number(e.target.value) as PriorityLevel)}
            >
              <option value={0}>낮음</option>
              <option value={1}>보통</option>
              <option value={2}>높음</option>
            </select>
          </label>
          <label className="form-option">
            <span>마감 기한</span>
            <input
              type="date"
              className="todo-date-input"
              aria-label="마감 기한 선택"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </label>
        </div>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {/* 검색 및 필터 컨트롤 영역 */}
      <div className="todo-controls">
        <div className="search-row">
          <input
            type="search"
            className="search-input"
            placeholder="할 일 제목 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-bar">
          <div className="filter-tabs" role="tablist">
            <button
              type="button"
              className={`tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              전체 ({totalCount})
            </button>
            <button
              type="button"
              className={`tab-btn ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              진행 중 ({activeCount})
            </button>
            <button
              type="button"
              className={`tab-btn ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              완료됨 ({completedCount})
            </button>
          </div>

          <div className="filter-selects">
            <select
              className="todo-select select-compact"
              aria-label="카테고리 필터"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value === 'all' ? 'all' : (Number(e.target.value) as TodoCategory)
                )
              }
            >
              <option value="all">모든 카테고리</option>
              <option value={0}>업무만</option>
              <option value={1}>개인만</option>
              <option value={2}>공부만</option>
            </select>

            <select
              className="todo-select select-compact"
              aria-label="우선순위 필터"
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(
                  e.target.value === 'all' ? 'all' : (Number(e.target.value) as PriorityLevel)
                )
              }
            >
              <option value="all">모든 우선순위</option>
              <option value={2}>높음만</option>
              <option value={1}>보통만</option>
              <option value={0}>낮음만</option>
            </select>

            <select
              className="todo-select select-compact"
              aria-label="정렬 기준"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
            >
              <option value="createdDesc">최신 등록순</option>
              <option value="dueDateAsc">마감일 임박순</option>
              <option value="priorityDesc">우선순위 높은순</option>
            </select>
          </div>
        </div>
      </div>

      {/* 할 일 목록 */}
      {loading ? (
        <p className="empty-state">불러오는 중...</p>
      ) : filteredAndSortedTodos.length === 0 ? (
        <p className="empty-state">
          {todos.length === 0
            ? '등록된 할 일이 없습니다. 첫 할 일을 추가해 보세요!'
            : '조건에 일치하는 할 일이 없습니다.'}
        </p>
      ) : (
        <ul className="todo-list">
          {filteredAndSortedTodos.map((todo) => {
            const dueStatus = getDueStatus(todo.dueDate, todo.isCompleted);

            return (
              <li key={todo.id} className={`todo-item ${todo.isCompleted ? 'completed' : ''}`}>
                <label className="todo-check">
                  <input
                    type="checkbox"
                    checked={todo.isCompleted}
                    onChange={() => handleToggle(todo)}
                  />
                </label>

                {editingId === todo.id ? (
                  <div className="todo-edit-panel">
                    <input
                      type="text"
                      className="todo-edit-input"
                      maxLength={200}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(todo);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <div className="todo-edit-meta">
                      <select
                        className="todo-select select-compact"
                        aria-label="카테고리 수정"
                        value={editingCategory}
                        onChange={(e) =>
                          setEditingCategory(Number(e.target.value) as TodoCategory)
                        }
                      >
                        <option value={0}>업무</option>
                        <option value={1}>개인</option>
                        <option value={2}>공부</option>
                      </select>
                      <select
                        className="todo-select select-compact"
                        aria-label="우선순위 수정"
                        value={editingPriority}
                        onChange={(e) =>
                          setEditingPriority(Number(e.target.value) as PriorityLevel)
                        }
                      >
                        <option value={0}>낮음</option>
                        <option value={1}>보통</option>
                        <option value={2}>높음</option>
                      </select>
                      <input
                        type="date"
                        className="todo-date-input select-compact"
                        value={editingDueDate}
                        onChange={(e) => setEditingDueDate(e.target.value)}
                      />
                      <div className="todo-edit-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-primary"
                          onClick={() => handleSaveEdit(todo)}
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-ghost"
                          onClick={() => setEditingId(null)}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="todo-content" onDoubleClick={() => startEdit(todo)}>
                      <span className="todo-title">{todo.title}</span>
                      <div className="todo-badges">
                        <span className={`badge ${CATEGORY_CLASSES[todo.category]}`}>
                          {CATEGORY_LABELS[todo.category]}
                        </span>
                        <span className={`badge ${PRIORITY_CLASSES[todo.priority]}`}>
                          {PRIORITY_LABELS[todo.priority]}
                        </span>
                        {todo.dueDate && (
                          <span
                            className={`due-tag ${
                              dueStatus === 'overdue'
                                ? 'due-overdue'
                                : dueStatus === 'today'
                                ? 'due-today'
                                : dueStatus === 'soon'
                                ? 'due-soon'
                                : ''
                            }`}
                          >
                            📅 {todo.dueDate}
                            {dueStatus === 'overdue' && ' (기한 초과)'}
                            {dueStatus === 'today' && ' (오늘 마감)'}
                            {dueStatus === 'soon' && ' (D-1 마감 임박)'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="todo-actions">
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        onClick={() => startEdit(todo)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        onClick={() => handleDelete(todo.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 하단 푸터 */}
      {todos.length > 0 && (
        <footer className="todo-footer">
          <span>
            표시된 항목: {filteredAndSortedTodos.length}개 / 전체 {totalCount}개
          </span>
          {completedCount > 0 && (
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={handleClearCompleted}
            >
              완료된 항목 모두 삭제 ({completedCount})
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

export default App;
