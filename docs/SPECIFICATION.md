# TsProject 시스템 기능 명세서 (System Specification)

본 문서는 **TsProject (TodoList Fullstack Application)**의 시스템 아키텍처, 데이터 모델, 핵심 비즈니스 로직, 보안 체계 및 UI/UX 사양을 상세히 기술합니다.

---

## 1. 프로젝트 개요 (Overview)

- **프로젝트명**: TsProject (TodoList Fullstack)
- **목표**: 현대적인 기술 스택을 바탕으로 안전한 사용자 인증, 정밀한 할 일 관리(우선순위, 카테고리, 마감일 알림), 직관적인 검색/필터링, 그리고 시스템 연동 다크모드를 제공하는 풀스택 웹 애플리케이션.
- **저장소**: [https://github.com/shimpark/todolist-fullstack](https://github.com/shimpark/todolist-fullstack)

### 기술 스택 (Technology Stack)

| 구분 | 기술 / 도구 | 상세 설명 |
| :--- | :--- | :--- |
| **Backend** | ASP.NET Core 8 Web API | `net8.0`, C# 12, Controller 기반 REST API |
| **ORM / Database** | Entity Framework Core 8 + SQLite | 파일 기반 경량 RDBMS (`todos.db`) |
| **인증 / 암호화** | JWT Bearer + BCrypt.Net-Next | HMAC-SHA256 토큰 서명, 솔트 기반 해싱 (WorkFactor=11) |
| **비밀번호 강도** | `zxcvbn-core` | Dropbox 알고리즘 기반 사전 단어 및 패턴 엔트로피 측정 (3점 이상 요구) |
| **환경변수 관리** | `DotNetEnv` | `.env` 파일 기반 민감 정보 주입 |
| **Backend Tests** | xUnit + SQLite In-Memory | EF Core 관계형 연산(`ExecuteDeleteAsync` 등) 완전 호환 검증 |
| **Frontend** | React 19 + TypeScript + Vite | 컴포넌트 기반 SPA, 빠르고 가벼운 번들러 |
| **Frontend Styling** | Modern CSS + CSS Custom Properties | 테마 토큰 기반 라이트/다크모드 지원 |
| **Frontend Tests** | Vitest + React Testing Library + user-event | jsdom 기반 사용자 상호작용 및 통합 단위 테스트 |

---

## 2. 시스템 아키텍처 및 폴더 구조

```text
d:\Source\TsProject/
├── backend/                  # ASP.NET Core 8 백엔드 API
│   ├── Controllers/          # API 엔드포인트 (AuthController, TodosController)
│   ├── Data/                 # EF Core DbContext (TodoDbContext)
│   ├── Models/               # 도메인 엔티티 (AppUser, TodoItem)
│   ├── Program.cs            # DI 컨테이너 및 미들웨어 파이프라인
│   ├── .env.example          # 백엔드 환경변수 템플릿
│   └── TodoApi.csproj
├── backend.Tests/            # xUnit 백엔드 단위/통합 테스트
│   ├── AuthControllerTests.cs
│   └── TodosControllerTests.cs
├── frontend/                 # React + TypeScript 프론트엔드 SPA
│   ├── src/
│   │   ├── api/              # 백엔드 연동 클라이언트 (authApi, todoApi)
│   │   ├── hooks/            # 커스텀 훅 (useTheme)
│   │   ├── types/            # TypeScript 타입 정의 (todo, theme)
│   │   ├── __tests__/        # Vitest 테스트 스위트 (App.test, Theme.test)
│   │   ├── App.tsx           # 메인 애플리케이션 컴포넌트
│   │   ├── App.css           # 애플리케이션 컴포넌트 스타일
│   │   ├── index.css         # 글로벌 CSS 토큰 및 다크모드 정의
│   │   └── main.tsx          # React 마운트 진입점
│   ├── .env.example          # 프론트엔드 환경변수 템플릿
│   └── package.json
├── docs/                     # 프로젝트 사양 및 API 문서
│   ├── README.md
│   ├── SPECIFICATION.md
│   └── API_REFERENCE.md
├── GEMINI.md                 # 프로젝트 개발 및 검증 규칙
└── .gitignore                # 시크릿 및 빌드 산출물 차단 규칙
```

---

## 3. 데이터 모델 및 DB 스키마 (Data Schema)

### 3.1 `AppUser` (사용자 계정)

사용자 계정 정보를 관리하는 엔티티입니다.

| 컬럼명 | 데이터 타입 | 제약 조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `Id` | `INTEGER` | Primary Key, Auto Increment | 사용자 고유 식별자 |
| `Username` | `TEXT` | Required, MaxLength(50), Unique Index | 로그인 아이디 (2~50자) |
| `PasswordHash` | `TEXT` | Required | BCrypt 해시 문자열 |
| `CreatedAt` | `TEXT (ISO8601)` | Required, Default UTC Now | 계정 생성 일시 |

### 3.2 `TodoItem` (할 일 항목)

사용자별 할 일 데이터를 보관하며 외래 식별자로 격리됩니다.

| 컬럼명 | 데이터 타입 | 제약 조건 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `Id` | `INTEGER` | Primary Key, Auto Increment | - | 할 일 고유 식별자 |
| `UserId` | `INTEGER` | Required, Foreign Key | - | 소유 사용자 식별자 (데이터 격리) |
| `Title` | `TEXT` | Required, MaxLength(200) | - | 할 일 제목 (1~200자) |
| `IsCompleted` | `INTEGER (Boolean)`| Required | `0` (false) | 완료 여부 |
| `Priority` | `INTEGER` | Required | `1` (Medium) | 우선순위 (`0`: Low, `1`: Medium, `2`: High) |
| `Category` | `INTEGER` | Required | `0` (Work) | 카테고리 (`0`: Work, `1`: Personal, `2`: Study) |
| `DueDate` | `TEXT (YYYY-MM-DD)`| Nullable | `NULL` | 마감 기한 날짜 |
| `CreatedAt` | `TEXT (ISO8601)` | Required | UTC Now | 항목 생성 일시 |

---

## 4. 핵심 기능 명세 (Core Specifications)

### 4.1 안전한 사용자 인증 및 비밀번호 정책 (Authentication & Password Security)
1. **JWT Bearer 토큰 인증**:
   - 로그인 성공 시 서명된 JWT 발급 (기본 7일 유효).
   - 클라이언트 `localStorage`에 토큰 보관 및 모든 API 요청 시 `Authorization: Bearer <TOKEN>` 헤더 전송.
   - `401 Unauthorized` 수신 시 `auth:unauthorized` 커스텀 이벤트를 발생시켜 자동으로 세션을 만료하고 로그인 화면으로 전환.
2. **비밀번호 강도 정책 (서버 및 클라이언트 양방향 적용)**:
   - **기본 복잡도 요건**: 8~64자, 영문 대문자, 영문 소문자, 숫자, 특수문자 각 최소 1자 포함, 공백 불가, 아이디 포함 불가.
   - **엔트로피 검증 (`zxcvbn`)**: 단순 사전 단어나 키보드 연속 패턴(`qwerty`, `123456` 등)을 차단하며 최소 3점 이상(0~4점 척도)만 회원가입 허용.
   - **비밀번호 강도 미터기 (UI)**: 4단계 시각화 바 및 실시간 체크리스트 제공.

### 4.2 세분화된 할 일 관리 (Task Management)
1. **우선순위 (Priority)**:
   - `낮음 (Low, 0)`: 회색 배지
   - `보통 (Medium, 1)`: 파란색 배지
   - `높음 (High, 2)`: 붉은색 배지
2. **카테고리 (Category)**:
   - `업무 (Work, 0)`: 보라색 태그
   - `개인 (Personal, 1)`: 녹색 태그
   - `공부 (Study, 2)`: 주황색 태그
3. **마감일 관리 및 알림 (Due Dates & Alert Banner)**:
   - 기한 초과(Overdue), 오늘 마감(Today), 내일 마감 임박(Soon) 상태 자동 계산.
   - 상단 마감 알림 배너에 기한 초과/오늘 마감/임박 건수를 시각화하며 '마감 알림만 보기' 단축 필터 제공.
4. **인라인 빠른 수정 (Inline Editing)**:
   - 항목 클릭 시 모달 없이 인라인에서 제목, 우선순위, 카테고리, 마감일을 즉시 수정 및 저장.
5. **검색, 필터, 정렬**:
   - 실시간 제목 검색 (`EF.Functions.Like`)
   - 상태 필터 (전체 / 진행 중 / 완료됨)
   - 카테고리 및 우선순위 다중 필터링
   - 정렬 옵션 (최신 등록순, 오래된순, 마감일 임박순, 우선순위 높은순)
6. **일괄 정리**: 완료된 모든 항목을 원클릭으로 일괄 삭제 (`ExecuteDeleteAsync`).

### 4.3 시스템 연동 반응형 다크모드 (Dark Mode Architecture)
1. **테마 토큰화**:
   - [index.css](file:///d:/Source/TsProject/frontend/src/index.css): `:root` 및 `[data-theme='dark']` 셀렉터에 시맨틱 변수(`--bg-page`, `--bg-card`, `--text-main`, `--border-color` 등) 정의.
2. **상태 관리 및 동기화 (`useTheme` 훅)**:
   - 브라우저 `localStorage`(`todo_theme`)에 저장/복원.
   - OS 시스템 설정(`prefers-color-scheme: dark`) 자동 감지 및 실시간 변경(`change` 이벤트) 반응.
3. **접근성 및 명도 대비**:
   - 비로그인(인증 카드) 및 로그인(메인 Todo) 헤더 우상단에 직관적인 원클릭 토글 버튼(☀️ 라이트 / 🌙 다크) 배치.
   - 다크모드에서도 WCAG AA 기준을 만족하도록 배지, 입력창, 마감 알림 배너 색상 보정.

---

## 5. 보안 및 환경변수 명세 (Security & Environment)

### 5.1 보안 수칙
- **시크릿 하드코딩 금지**: `JWT_SECRET_KEY`, `DB_CONNECTION_STRING` 등 모든 민감 정보는 소스코드나 `appsettings.json`에 기록하지 않고 환경변수로만 주입.
- **Git 차단**: `.gitignore`에 `**/.env`, `**/*.db`를 등록하여 커밋 원천 차단.

### 5.2 환경변수 명세

#### Backend (`backend/.env`)
```env
JWT_SECRET_KEY=YourSuperSecretKeyMustBeAtLeast32CharsLong12345!
DB_CONNECTION_STRING=Data Source=todos.db
```

#### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5191
```

---

## 6. 테스트 및 품질 보증 (Testing & QA)

### 6.1 백엔드 테스트 (`backend.Tests/`)
- 프레임워크: `xUnit`
- 데이터베이스: SQLite In-Memory (`DataSource=:memory:`)
- 검증 범위:
  - 비밀번호 정책 검증 (길이, 대소문자, zxcvbn 점수, 중복 방지)
  - 인증 인가 (JWT 발행, 유효하지 않은 토큰 차단)
  - 투두 CRUD, 타 사용자 데이터 접근 차단 격리성
  - 완료 항목 일괄 삭제 및 검색/정렬 쿼리

### 6.2 프론트엔드 테스트 (`frontend/src/__tests__/`)
- 프레임워크: `Vitest` + `React Testing Library` + `@testing-library/user-event`
- 검증 범위:
  - 비로그인/로그인 화면 전환 및 폼 인터랙션
  - 회원가입 시 취약한 비밀번호 차단 및 강도 미터기 렌더링
  - 할 일 등록, 우선순위/카테고리/마감일 지정, 완료 토글, 삭제
  - 다크모드 초기 OS 감지 및 수동 토글 인터랙션

### 6.3 필수 검증 게이트 (Verification Gate)
```bash
# 백엔드 테스트 (실행 중인 서버가 있을 때는 --no-build 사용)
dotnet test d:\Source\TsProject\backend.Tests\TodoApi.Tests.csproj --no-build

# 프론트엔드 테스트
cd d:\Source\TsProject\frontend && npm test

# 프론트엔드 타입 체크 및 빌드
cd d:\Source\TsProject\frontend && npm run build
```
