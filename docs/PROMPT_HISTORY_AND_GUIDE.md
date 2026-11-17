# AI 협업 프롬프트 히스토리 및 유지보수 가이드 (Prompt History & Maintenance Guide)

본 문서는 **TsProject (TodoList Fullstack)**를 개발하는 과정에서 실제로 사용된 프롬프트와 지시 맥락을 기록하고, 향후 프로젝트를 인계받을 **주니어 개발자 및 후임자가 AI 코딩 에이전트(Antigravity, Cursor, Claude Code 등)와 협업하여 유지보수 및 추가 개발을 원활하게 수행할 수 있도록 돕는 실무 가이드**입니다.

---

## 📖 목차

1. [AI 페어 프로그래밍 협업 3대 원칙](#1-ai-페어-프로그래밍-협업-3대-원칙)
2. [실제 프로젝트 개발 프롬프트 히스토리 (Phase 1 ~ 5)](#2-실제-프로젝트-개발-프롬프트-히스토리)
3. [미래 추가 개발을 위한 프롬프트 플레이북 (Prompt Playbook)](#3-미래-추가-개발을-위한-프롬프트-플레이북)
   - 3.1 [기능 확장 (Feature Expansion)](#31-기능-확장-feature-expansion)
   - 3.2 [아키텍처 및 인프라 전환 (Architecture & DevOps)](#32-아키텍처-및-인프라-전환-architecture--devops)
   - 3.3 [보안 고도화 (Security Hardening)](#33-보안-고도화-security-hardening)
   - 3.4 [코드 리팩토링 및 테스트 강화 (Refactoring & Testing)](#34-코드-리팩토링-및-테스트-강화-refactoring--testing)
4. [후임자를 위한 개발 수칙 및 안전 체크리스트](#4-후임자를-위한-개발-수칙-및-안전-체크리스트)

---

## 1. AI 페어 프로그래밍 협업 3대 원칙

주니어 개발자가 AI 에이전트를 가장 신뢰성 높게 활용하기 위해 반드시 지켜야 할 기본 규칙입니다.

1. **컨텍스트 우선 명시 (Context First)**:
   - "이거 고쳐줘" 대신 관련 파일 경로(`file:///d:/Source/TsProject/frontend/src/App.tsx`), 현재 실행 환경(Windows, net8.0, Vite) 및 구체적인 에러 메시지나 기대 결과를 함께 제시하세요.
2. **계획 수립 후 실행 원칙 (`/plan` First)**:
   - 2개 이상의 파일이 변경되거나 아키텍처/데이터베이스 구조가 바뀌는 작업은 반드시 `/plan` 명령어를 통해 상세 설계와 테스트 시나리오를 먼저 확인하고 승인한 후 구현을 시작하세요.
3. **검증 게이트 준수 (Never Skip Verification Gate)**:
   - AI가 "작업을 완료했습니다"라고 하더라도, 완료 보고 전에 백엔드 테스트(`dotnet test`), 프론트엔드 테스트(`npm test`), 빌드(`npm run build`)가 통과했는지 확인하는 검증 게이트를 항상 거치게 하세요.

---

## 2. 실제 프로젝트 개발 프롬프트 히스토리

TsProject가 구축되고 발전해 온 실제 프롬프트와 작업 맥락입니다.

### 📌 Phase 1: 서버 점검 및 화면 다크모드 기능 구현
- **실제 프롬프트**:
  ```text
  현재 실행 중인 서버 확인하고 화면 다크모드 기능 /plan 세워줘.
  ```
- **의도 및 배경**:
  - 포트 충돌 여부 및 기존 백엔드(5191)/프론트엔드(5173) 프로세스 상태를 먼저 확인.
  - 전역 CSS 색상을 토큰화하고, 시스템 OS 다크모드(`prefers-color-scheme`)와 수동 토글이 조화롭게 동작하도록 계획 수립.
- **수행 작업 및 결과**:
  - `frontend/src/index.css`: `:root` 및 `[data-theme='dark']` CSS 커스텀 프로퍼티 정의.
  - `frontend/src/hooks/useTheme.ts`: `localStorage` 저장 및 실시간 미디어 쿼리 감지 훅 작성.
  - `frontend/src/__tests__/Theme.test.tsx`: 다크모드 전용 Vitest 단위/통합 테스트 5개 작성 (총 19개 통과).
- **💡 교훈 (Lesson Learned)**:
  - CSS `transition: background-color 0.2s`가 걸려 있는 경우, 클릭 직후(`0.01초`) Computed Style을 측정하면 중간 보간 색상(`rgba(...)`)이 나올 수 있으므로 트랜지션 완료 시간(약 300~400ms) 대기 후 검증해야 합니다.

---

### 📌 Phase 2: 브라우저 자동화 툴(ego lite) 환경 설정
- **실제 프롬프트**:
  ```text
  https://lite.ego.app/document/en/docs/windows/cursor ego lite 를 설치했어. 활용할 수 있도록 설정해줘.
  ```
- **의도 및 배경**:
  - Chromium 기반 에이전트 협업 브라우저인 `ego (lite)`를 윈도우 환경에서 Cursor 및 Antigravity 에이전트와 연동.
- **수행 작업 및 결과**:
  - User `PATH` 환경변수에 `C:\Users\lucks\.local\share\ego\active_version_dir` 등록 및 정규화.
  - Cursor 전역(`.cursor/skills/ego-browser`), 프로젝트(`.cursor/skills/ego-browser`), Antigravity(`.gemini/config/skills/ego-browser`)에 스킬 배포.
  - Cursor의 `Run Everything` 모드 설정 안내.

---

### 📌 Phase 3: 실 브라우저 E2E 무결성 점검
- **실제 프롬프트**:
  ```text
  /ego-browser 현재 실행 중인 http://localhost:5173 에 접속해서 다크모드 토글 버튼을 누르고 화면을 캡처해서 UI가 깨지지 않는지 점검해줘.
  ```
- **의도 및 배경**:
  - 단위 테스트 통과에 그치지 않고 실제 브라우저 런타임에서 UI 레이아웃, 명도 대비, 텍스트 가독성 검증.
- **수행 작업 및 결과**:
  - Vite HMR WebSocket으로 인한 `networkidle` 타임아웃을 방지하기 위해 `waitUntil: "domcontentloaded"` 채택.
  - 다크모드 상태의 폼, 탭, 배지, 입력창의 Computed Style을 정밀 추출하여 텍스트 묻힘 현상이 없음을 검증.
  - 검증 완료 후 사용자가 직접 볼 수 있도록 `task.finish({ keep: ["p1"] })`로 브라우저 탭 유지.

---

### 📌 Phase 4: 보안 강화 및 GitHub 원격 저장소 최초 커밋/푸시
- **실제 프롬프트**:
  ```text
  해당 소스를 git 사용하고, github 에 원격지 커밋하고자 한다. 내가 해야 할 일은? 
  https://github.com/shimpark
  /plan
  ```
- **의도 및 배경**:
  - 로컬 프로젝트를 Git 저장소로 초기화하고 GitHub 원격 저장소(`https://github.com/shimpark/todolist-fullstack.git`)에 안전하게 푸시.
- **수행 작업 및 결과**:
  - `.gitignore`를 엄격하게 보강하여 `.env` 및 `todos.db`, `bin/`, `obj/`, `dist/`가 절대 커밋되지 않도록 차단.
  - 3대 Verification Gate(백엔드 테스트 39개, 프론트엔드 테스트 19개, 빌드) 검증 후 초기 커밋 생성 및 `main` 브랜치 푸시 완료.

---

### 📌 Phase 5: 프로젝트 사양(Spec) 및 API 문서화
- **실제 프롬프트**:
  ```text
  docs 폴더를 만들어서 해당 프로젝트의 spec 문서를 md 로 만들어서 관리하자.
  ```
- **수행 작업 및 결과**:
  - [docs/SPECIFICATION.md](file:///d:/Source/TsProject/docs/SPECIFICATION.md): 아키텍처, 데이터 스키마, 기능 사양, 보안 규칙.
  - [docs/API_REFERENCE.md](file:///d:/Source/TsProject/docs/API_REFERENCE.md): REST API 요청/응답 규격 및 HTTP 상태 코드.
  - [docs/README.md](file:///d:/Source/TsProject/docs/README.md): 문서 인덱스.

---

## 3. 미래 추가 개발을 위한 프롬프트 플레이북 (Prompt Playbook)

후임자가 향후 신규 요구사항을 구현할 때, 복사하여 AI 에이전트에게 지시할 수 있는 **상황별 최적 프롬프트 모음**입니다.

### 3.1 기능 확장 (Feature Expansion)

#### 🔹 [시나리오 1] 반복 할 일 (Recurring Tasks) 추가
```text
할 일에 반복 주기(매일, 매주, 매월)를 설정할 수 있는 반복 일정 기능을 추가하고 싶습니다.
1. 백엔드 TodoItem 모델에 Recurrence enum(None=0, Daily=1, Weekly=2, Monthly=3)을 추가하고, 완료 토글 시 다음 주기로 DueDate가 자동 갱신되는 비즈니스 로직을 구현해주세요.
2. 프론트엔드 입력 폼에 반복 주기 선택 셀렉트박스와 투두 아이템 배지를 추가해주세요.
3. xUnit(SQLite In-Memory) 및 Vitest 테스트 케이스를 포함하여 GEMINI.md 개발 규칙에 따라 /plan 작성해주세요.
```

#### 🔹 [시나리오 2] 칸반 보드 뷰 (Kanban Board) 및 드래그 앤 드롭
```text
현재 리스트 뷰 외에 상태별(대기 중 / 진행 중 / 완료됨)로 카드를 배치할 수 있는 칸반 보드 뷰를 추가하고자 합니다.
1. 상단에 뷰 전환 토글(리스트 뷰 ↔ 칸반 뷰)을 추가해주세요.
2. 드래그 앤 드롭으로 카드의 진행 상태를 변경하고 백엔드 PUT /api/todos/{id}로 동기화해주세요.
3. 접근성과 모바일 터치를 고려한 UI 컴포넌트 설계 및 Vitest 테스트 시나리오를 포함하여 /plan 세워주세요.
```

#### 🔹 [시나리오 3] 소셜 로그인 (GitHub / Google OAuth2) 연동
```text
기존 로컬 아이디/비밀번호 방식에 더해 GitHub 소셜 로그인 기능을 추가하고 싶습니다.
1. 백엔드 ASP.NET Core에 OAuth2 인증 핸들러를 구성하고, 신규 소셜 유저인 경우 AppUser 엔티티에 자동 연동/가입되도록 설계해주세요.
2. OAuth 클라이언트 ID와 Secret은 backend/.env에서 안전하게 관리하도록 구성해주세요.
3. 프론트엔드 로그인 카드에 "GitHub로 로그인" 버튼과 리다이렉트 콜백 처리 흐름을 설계하여 /plan 작성해주세요.
```

#### 🔹 [시나리오 4] 파일 및 이미지 첨부 기능 (Attachments)
```text
할 일 항목마다 관련 스크린샷이나 문서를 첨부할 수 있는 파일 첨부 기능을 추가해주세요.
1. 백엔드에 다중 파트 파일 업로드 API(POST /api/todos/{id}/attachments) 및 파일 삭제 API를 구현해주세요. (업로드 파일 크기 제한 5MB, 허용 확장자 검증 필수)
2. 프론트엔드 인라인 편집 영역에 드래그 앤 드롭 파일 업로더와 썸네일 미리보기를 구현해주세요.
3. 로컬 파일 저장소 경로 격리 및 xUnit 통합 테스트를 포함하여 /plan 세워주세요.
```

---

### 3.2 아키텍처 및 인프라 전환 (Architecture & DevOps)

#### 🔹 [시나리오 5] SQLite ➔ PostgreSQL / SQL Server 프로덕션 마이그레이션
```text
현재 개발용 파일 기반 SQLite를 프로덕션 환경 운영을 위해 PostgreSQL(또는 SQL Server)로 전환하고자 합니다.
1. backend/Program.cs에서 환경변수(DB_PROVIDER=PostgreSQL | SQLite)에 따라 DbContext를 동적으로 주입할 수 있도록 리팩토링해주세요.
2. Npgsql.EntityFrameworkCore.PostgreSQL 패키지를 추가하고, DB 마이그레이션 스크립트를 작성해주세요.
3. 중요: 단위 테스트 프로젝트(backend.Tests/)는 기존 SQLite In-Memory(DataSource=:memory:)를 유지하여 CI 환경에서 외부 DB 없이 독립 실행되도록 /plan 세워주세요.
```

#### 🔹 [시나리오 6] Docker & Docker Compose 컨테이너화
```text
개발 환경과 배포 환경을 표준화하기 위해 Docker 및 Docker Compose 구성을 구축하고 싶습니다.
1. backend: ASP.NET Core 8 멀티 스테이지 빌드 Dockerfile 작성 (경량화 chiseled/alpine 런타임 이미지 적용).
2. frontend: Node 빌드 후 Nginx 경량 컨테이너로 정적 파일 서빙 및 API 프록시를 수행하는 Dockerfile 작성.
3. docker-compose.yml을 작성하여 로컬에서 docker compose up 명령어 한 번으로 전체 시스템이 정상 구동되도록 /plan 세워주세요.
```

---

### 3.3 보안 고도화 (Security Hardening)

#### 🔹 [시나리오 7] Refresh Token 도입 및 자동 세션 연장 (Silent Refresh)
```text
현재 7일 유효 단일 JWT 토큰 구조를 보안 표준에 맞게 Access Token(15분) + Refresh Token(7일) 이중화 구조로 고도화하고자 합니다.
1. AppUser에 RefreshToken 및 RefreshTokenExpiryTime 컬럼을 추가하고, POST /api/auth/refresh 엔드포인트를 구현해주세요.
2. 프론트엔드 API 클라이언트에서 Access Token 만료 시(401 발생 전 또는 직후) Refresh Token으로 토큰을 조용히 자동 재발급받는 인터셉터 로직을 구현해주세요.
3. 로그아웃 시 Refresh Token 무효화 처리와 xUnit 테스트를 포함하여 /plan 작성해주세요.
```

#### 🔹 [시나리오 8] API Rate Limiting (무차별 대입 공격 및 DoS 방어)
```text
로그인 및 회원가입 엔드포인트(/api/auth/*)에 무차별 대입(Brute-force) 공격을 방어하기 위한 Rate Limiting을 도입하고자 합니다.
1. ASP.NET Core 8 내장 RateLimiter 미들웨어를 사용하여 IP당 분당 5회 초과 요청 시 429 Too Many Requests를 반환하도록 구성해주세요.
2. 프론트엔드에서 429 수신 시 "요청이 너무 많습니다. 잠시 후 다시 시도해주세요" 알림을 표시해주세요.
3. Rate Limiting 예외 정책 및 단위 테스트 시나리오를 포함하여 /plan 작성해주세요.
```

---

### 3.4 코드 리팩토링 및 테스트 강화 (Refactoring & Testing)

#### 🔹 [시나리오 9] 거대 컴포넌트(`App.tsx`)의 모듈화 및 커스텀 훅 분리
```text
현재 App.tsx 파일이 900줄 이상으로 비대해져 유지보수성이 저하되고 있습니다.
1. 역할별 서브 컴포넌트로 분리해주세요:
   - src/components/TodoHeader.tsx (타이틀, 테마 토글, 유저 배지, 로그아웃)
   - src/components/AuthCard.tsx (로그인/회원가입 탭, 폼, 비밀번호 강도 미터)
   - src/components/TodoForm.tsx (신규 할 일 입력, 우선순위/카테고리/마감일 선택)
   - src/components/TodoList.tsx & TodoItemRow.tsx (인라인 편집 포함)
   - src/components/FilterControls.tsx (검색창, 필터 탭, 정렬 셀렉트)
   - src/components/DueAlertBanner.tsx (마감 알림 배너)
2. 비즈니스 상태 로직을 src/hooks/useTodos.ts와 src/hooks/useAuth.ts로 분리해주세요.
3. 리팩토링 후 기존 19개 Vitest 테스트가 100% 통과하도록 보장하는 /plan을 작성해주세요.
```

#### 🔹 [시나리오 10] Playwright 기반 E2E 자동화 테스트 구축
```text
브라우저 환경에서의 사용자 시나리오 전체를 자동으로 검증하기 위해 Playwright E2E 테스트를 도입하고자 합니다.
1. frontend 디렉토리에 Playwright를 설정하고, 회원가입 ➔ 로그인 ➔ 투두 등록 ➔ 다크모드 전환 ➔ 완료 처리 ➔ 로그아웃의 전체 해피 패스를 검증하는 테스트 스크립트를 작성해주세요.
2. 헤드리스 모드 및 CI 연동 실행 스크립트(package.json script)를 추가하는 /plan을 세워주세요.
```

---

## 4. 후임자를 위한 개발 수칙 및 안전 체크리스트

코드를 수정하고 배포하기 전에 반드시 확인해야 할 체크리스트입니다.

### 🛡️ 1) 시크릿(Secret) 유출 방지 수칙
- [ ] `backend/.env`나 `frontend/.env` 파일이 절대 Git에 커밋되지 않았는지 확인 (`git status`).
- [ ] 로컬 SQLite DB 파일(`todos.db`, `*.db-wal`)이 스테이징되지 않았는지 확인.
- [ ] 의심스러운 API 키나 토큰을 코드에 작성하지 않았는지 확인 (`sonar analyze secrets`).

### 🧪 2) 3대 필수 검증 게이트 (Verification Gate) 실행
작업 완료를 선언하거나 커밋하기 전에 반드시 터미널에서 아래 명령을 모두 통과시켜야 합니다:

```powershell
# 1. 백엔드 xUnit 테스트 (서버가 실행 중일 때는 --no-build 옵션 사용)
dotnet test d:\Source\TsProject\backend.Tests\TodoApi.Tests.csproj --no-build

# 2. 프론트엔드 Vitest 단위/통합 테스트
cd d:\Source\TsProject\frontend ; npm test

# 3. 프론트엔드 TypeScript 타입 검사 및 프로덕션 빌드
cd d:\Source\TsProject\frontend ; npm run build
```

### 📦 3) Git 커밋 컨벤션 권장안
- `feat:` 새로운 기능 추가 (예: `feat: add recurring todo schedule`)
- `fix:` 버그 수정 (예: `fix: resolve transition color flickering in dark mode`)
- `refactor:` 기능 변경 없는 코드 구조 개선 (예: `refactor: split App.tsx into subcomponents`)
- `test:` 테스트 코드 추가 및 수정 (예: `test: add xUnit tests for password policy`)
- `docs:` 문서 추가 및 수정 (예: `docs: update API reference for attachments`)
