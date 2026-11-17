import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import * as authApi from '../api/authApi';
import * as todoApi from '../api/todoApi';
import type { TodoItem } from '../types/todo';

vi.mock('../api/todoApi');
vi.mock('../api/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/authApi')>();
  return {
    ...actual,
    loginUser: vi.fn(),
    registerUser: vi.fn(),
  };
});

const mockTodos: TodoItem[] = [
  {
    id: 1,
    title: 'API 문서 작성',
    isCompleted: false,
    priority: 2, // 높음
    category: 0, // 업무
    dueDate: '2020-01-01', // 기한 초과
    createdAt: '2026-11-17T10:00:00Z',
  },
  {
    id: 2,
    title: '프론트엔드 스타일 점검',
    isCompleted: true,
    priority: 0, // 낮음
    category: 1, // 개인
    dueDate: null,
    createdAt: '2026-11-17T11:00:00Z',
  },
  {
    id: 3,
    title: '단위 테스트 추가',
    isCompleted: false,
    priority: 1, // 보통
    category: 2, // 공부
    dueDate: '2099-12-31',
    createdAt: '2026-11-17T12:00:00Z',
  },
];

describe('Todo App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authApi.saveAuth({ token: 'mock-jwt-token', username: 'tester' });
    vi.mocked(todoApi.fetchTodos).mockResolvedValue([...mockTodos]);
  });

  it('비로그인 상태일 때는 할 일 목록 대신 로그인/회원가입 폼을 표시한다', () => {
    authApi.clearAuth();
    render(<App />);

    expect(screen.getByText('개인 할 일 관리를 위해 로그인하세요')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('아이디 입력 (2~50자)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('비밀번호 입력')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인하기' })).toBeInTheDocument();
    expect(todoApi.fetchTodos).not.toHaveBeenCalled();
  });

  it('아이디와 비밀번호로 로그인을 수행하면 사용자 헤더와 할 일 목록이 표시된다', async () => {
    const user = userEvent.setup();
    authApi.clearAuth();
    vi.mocked(authApi.loginUser).mockResolvedValue({
      token: 'jwt-alice',
      username: 'alice',
    });

    render(<App />);

    await user.type(screen.getByPlaceholderText('아이디 입력 (2~50자)'), 'alice');
    await user.type(screen.getByPlaceholderText('비밀번호 입력'), 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: '로그인하기' }));

    await waitFor(() => {
      expect(authApi.loginUser).toHaveBeenCalledWith({
        username: 'alice',
        password: 'StrongPass1!',
      });
    });

    expect(await screen.findByText('API 문서 작성')).toBeInTheDocument();
    expect(screen.getByLabelText('현재 로그인 사용자')).toHaveTextContent('alice');
  });

  it('회원가입 시 취약한 비밀번호 및 비밀번호 확인 불일치를 차단하고, 강력한 비밀번호만 허용한다', async () => {
    const user = userEvent.setup();
    authApi.clearAuth();
    vi.mocked(authApi.registerUser).mockResolvedValue({
      token: 'jwt-newuser',
      username: 'newuser',
    });

    render(<App />);

    await user.click(screen.getByRole('button', { name: '회원가입' }));

    const usernameInput = screen.getByPlaceholderText('아이디 입력 (2~50자)');
    const passwordInput = screen.getByPlaceholderText(
      '비밀번호 입력 (8자 이상, 대/소/숫자/특수문자)'
    );
    const confirmInput = screen.getByPlaceholderText('비밀번호 재입력');

    // 1) 약한 비밀번호(대문자/특수문자 누락) 제출 시 차단 확인
    await user.type(usernameInput, 'newuser');
    await user.type(passwordInput, 'weakpass12');
    await user.type(confirmInput, 'weakpass12');
    await user.click(screen.getByRole('button', { name: '회원가입 완료' }));

    expect(
      screen.getByText('비밀번호에는 영문 대문자와 소문자가 모두 포함되어야 합니다.')
    ).toBeInTheDocument();
    expect(authApi.registerUser).not.toHaveBeenCalled();

    // 2) 대/소/숫자/특수문자가 있어도 zxcvbn 사전 단어(Password1!)인 경우 차단 확인
    await user.clear(passwordInput);
    await user.clear(confirmInput);
    await user.type(passwordInput, 'Password1!');
    await user.type(confirmInput, 'Password1!');
    await user.click(screen.getByRole('button', { name: '회원가입 완료' }));

    expect(
      screen.getByText(/추측하기 쉬운 단어\(예: password, qwerty\)나 단순 패턴이 포함되어 있습니다/)
    ).toBeInTheDocument();
    expect(authApi.registerUser).not.toHaveBeenCalled();

    // 3) 강력한 비밀번호(K9#mP2$vL8@qR5) 입력 후 비밀번호 확인 불일치 시 차단 확인
    await user.clear(passwordInput);
    await user.clear(confirmInput);
    await user.type(passwordInput, 'K9#mP2$vL8@qR5');
    await user.type(confirmInput, 'MismatchPass1!');
    await user.click(screen.getByRole('button', { name: '회원가입 완료' }));

    expect(screen.getByText('비밀번호 확인이 일치하지 않습니다.')).toBeInTheDocument();
    expect(authApi.registerUser).not.toHaveBeenCalled();

    // 4) 비밀번호 확인 일치 시 정상 회원가입 완료
    await user.clear(confirmInput);
    await user.type(confirmInput, 'K9#mP2$vL8@qR5');
    await user.click(screen.getByRole('button', { name: '회원가입 완료' }));

    await waitFor(() => {
      expect(authApi.registerUser).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'K9#mP2$vL8@qR5',
      });
    });

    expect(await screen.findByText('API 문서 작성')).toBeInTheDocument();
    expect(screen.getByLabelText('현재 로그인 사용자')).toHaveTextContent('newuser');
  });

  it('상단 로그아웃 버튼 클릭 시 인증 정보가 삭제되고 로그인 화면으로 돌아간다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('API 문서 작성');
    expect(screen.getByLabelText('현재 로그인 사용자')).toHaveTextContent('tester');

    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(screen.getByText('개인 할 일 관리를 위해 로그인하세요')).toBeInTheDocument();
    expect(authApi.getStoredAuth()).toBeNull();
  });

  it('초기 할 일 목록과 카테고리/우선순위/기한 초과 배지를 렌더링한다', async () => {
    render(<App />);

    expect(await screen.findByText('API 문서 작성')).toBeInTheDocument();
    expect(screen.getByText('프론트엔드 스타일 점검')).toBeInTheDocument();
    expect(screen.getByText('단위 테스트 추가')).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('공부')).toBeInTheDocument();
    expect(within(items[1]).getByText('개인')).toBeInTheDocument();
    expect(within(items[2]).getByText('업무')).toBeInTheDocument();

    expect(screen.getByText(/2020-01-01 \(기한 초과\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체 (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '진행 중 (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '완료됨 (1)' })).toBeInTheDocument();
  });

  it('새로운 할 일을 카테고리, 우선순위 및 마감 기한과 함께 추가한다', async () => {
    const user = userEvent.setup();
    vi.mocked(todoApi.createTodo).mockResolvedValue({
      id: 4,
      title: '신규 배포 파이프라인 구축',
      isCompleted: false,
      priority: 2,
      category: 2,
      dueDate: '2026-12-25',
      createdAt: '2026-11-17T13:00:00Z',
    });

    render(<App />);
    await screen.findByText('API 문서 작성');

    const input = screen.getByPlaceholderText('새로운 할 일을 입력하세요...');
    const categorySelect = screen.getByLabelText('카테고리 선택');

    await user.type(input, '신규 배포 파이프라인 구축');
    await user.selectOptions(categorySelect, '2');
    await user.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => {
      expect(todoApi.createTodo).toHaveBeenCalledWith({
        title: '신규 배포 파이프라인 구축',
        category: 2,
        priority: 1,
        dueDate: null,
      });
    });

    expect(await screen.findByText('신규 배포 파이프라인 구축')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체 (4)' })).toBeInTheDocument();
  });

  it('체크박스 클릭 시 할 일의 완료 상태를 토글한다', async () => {
    const user = userEvent.setup();
    vi.mocked(todoApi.updateTodo).mockResolvedValue({
      ...mockTodos[0],
      isCompleted: true,
    });

    render(<App />);
    const itemText = await screen.findByText('API 문서 작성');
    const listItem = itemText.closest('li')!;
    const checkbox = within(listItem).getByRole('checkbox');

    await user.click(checkbox);

    await waitFor(() => {
      expect(todoApi.updateTodo).toHaveBeenCalledWith(1, {
        title: 'API 문서 작성',
        isCompleted: true,
        category: 0,
        priority: 2,
        dueDate: '2020-01-01',
      });
    });
  });

  it('상태 탭(전체/진행 중/완료됨)과 우선순위 필터로 목록을 필터링한다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('API 문서 작성');

    await user.click(screen.getByRole('button', { name: /완료됨/ }));
    expect(screen.getByText('프론트엔드 스타일 점검')).toBeInTheDocument();
    expect(screen.queryByText('API 문서 작성')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /진행 중/ }));
    expect(screen.getByText('API 문서 작성')).toBeInTheDocument();
    expect(screen.getByText('단위 테스트 추가')).toBeInTheDocument();
    expect(screen.queryByText('프론트엔드 스타일 점검')).not.toBeInTheDocument();

    const prioritySelect = screen.getByLabelText('우선순위 필터');
    await user.selectOptions(prioritySelect, '2');
    expect(screen.getByText('API 문서 작성')).toBeInTheDocument();
    expect(screen.queryByText('단위 테스트 추가')).not.toBeInTheDocument();
  });

  it('카테고리 필터(업무/개인/공부)로 목록을 필터링한다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('API 문서 작성');

    const categoryFilter = screen.getByLabelText('카테고리 필터');

    await user.selectOptions(categoryFilter, '2');
    expect(screen.getByText('단위 테스트 추가')).toBeInTheDocument();
    expect(screen.queryByText('API 문서 작성')).not.toBeInTheDocument();
    expect(screen.queryByText('프론트엔드 스타일 점검')).not.toBeInTheDocument();

    await user.selectOptions(categoryFilter, '0');
    expect(screen.getByText('API 문서 작성')).toBeInTheDocument();
    expect(screen.queryByText('단위 테스트 추가')).not.toBeInTheDocument();
  });

  it('검색창에 키워드 입력 시 제목이 일치하는 할 일만 표시한다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('API 문서 작성');

    const searchInput = screen.getByPlaceholderText('할 일 제목 검색...');
    await user.type(searchInput, '단위 테스트');

    expect(screen.getByText('단위 테스트 추가')).toBeInTheDocument();
    expect(screen.queryByText('API 문서 작성')).not.toBeInTheDocument();
    expect(screen.queryByText('프론트엔드 스타일 점검')).not.toBeInTheDocument();
  });

  it('정렬 기준을 변경하면 목록 순서가 변경된다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('API 문서 작성');

    const sortSelect = screen.getByLabelText('정렬 기준');
    await user.selectOptions(sortSelect, 'priorityDesc');

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('API 문서 작성')).toBeInTheDocument();
    expect(within(items[1]).getByText('단위 테스트 추가')).toBeInTheDocument();
    expect(within(items[2]).getByText('프론트엔드 스타일 점검')).toBeInTheDocument();
  });

  it('완료된 항목 모두 삭제 버튼 클릭 시 완료된 항목만 제거된다', async () => {
    const user = userEvent.setup();
    vi.mocked(todoApi.clearCompletedTodos).mockResolvedValue();

    render(<App />);
    await screen.findByText('프론트엔드 스타일 점검');

    const clearBtn = screen.getByRole('button', { name: /완료된 항목 모두 삭제/ });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(todoApi.clearCompletedTodos).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText('프론트엔드 스타일 점검')).not.toBeInTheDocument();
    expect(screen.getByText('API 문서 작성')).toBeInTheDocument();
  });

  it('기한 초과, 오늘 마감, 내일 마감(D-1) 항목이 있으면 상단 마감일 알림 배너와 D-1 배지를 표시한다', async () => {
    const now = new Date();
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const todayStr = formatDate(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    vi.mocked(todoApi.fetchTodos).mockResolvedValue([
      {
        id: 10,
        title: '어제 마감 작업',
        isCompleted: false,
        priority: 2,
        category: 0,
        dueDate: '2020-01-01',
        createdAt: '2026-11-17T10:00:00Z',
      },
      {
        id: 11,
        title: '오늘 마감 작업',
        isCompleted: false,
        priority: 1,
        category: 0,
        dueDate: todayStr,
        createdAt: '2026-11-17T11:00:00Z',
      },
      {
        id: 12,
        title: '내일 마감 작업',
        isCompleted: false,
        priority: 1,
        category: 2,
        dueDate: tomorrowStr,
        createdAt: '2026-11-17T12:00:00Z',
      },
    ]);

    render(<App />);
    await screen.findByText('내일 마감 작업');

    const alertBanner = screen.getByRole('alert');
    expect(alertBanner).toBeInTheDocument();
    expect(within(alertBanner).getByText(/기한 초과 1건/)).toBeInTheDocument();
    expect(within(alertBanner).getByText(/오늘 마감 1건/)).toBeInTheDocument();
    expect(within(alertBanner).getByText(/마감 임박 1건/)).toBeInTheDocument();

    expect(screen.getByText(new RegExp(`${tomorrowStr} \\(D-1 마감 임박\\)`))).toBeInTheDocument();
  });

  it('마감 알림 배너의 "마감 알림 항목만 보기" 토글 및 "닫기" 버튼이 동작한다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('API 문서 작성');

    const alertBanner = screen.getByRole('alert');
    const filterAlertBtn = within(alertBanner).getByRole('button', {
      name: /마감 알림 항목만 보기/,
    });

    await user.click(filterAlertBtn);

    expect(screen.getByText('API 문서 작성')).toBeInTheDocument();
    expect(screen.queryByText('단위 테스트 추가')).not.toBeInTheDocument();

    await user.click(
      within(alertBanner).getByRole('button', { name: /마감 알림 필터 해제/ })
    );
    expect(screen.getByText('단위 테스트 추가')).toBeInTheDocument();

    const closeBtn = within(alertBanner).getByRole('button', { name: '알림 닫기' });
    await user.click(closeBtn);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
