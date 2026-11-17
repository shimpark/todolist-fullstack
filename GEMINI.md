# TsProject (TodoList) 프로젝트 개발 규칙

## 1. 기술 스택 및 구조
- **Backend (`backend/`)**: ASP.NET Core 8 Web API (`net8.0`), Entity Framework Core + SQLite (`todos.db`), JWT Bearer 인증, `BCrypt.Net-Next` + `zxcvbn-core`, `DotNetEnv` (`.env` 기반 환경변수 관리), Swagger
- **Backend Tests (`backend.Tests/`)**: `xUnit` + `SQLite In-Memory` (`DataSource=:memory:`)
- **Frontend (`frontend/`)**: React + TypeScript + Vite + `zxcvbn`
- **Frontend Tests (`frontend/src/__tests__/`)**: `Vitest` + `React Testing Library` + `@testing-library/user-event` + `jsdom`
- **보안 및 환경변수 관리**:
  - 모든 민감 정보(`JWT_SECRET_KEY`, `DB_CONNECTION_STRING` 등)는 코드나 `appsettings.json`에 하드코딩하지 않고 `backend/.env` 및 `frontend/.env`에서 관리한다 (`.gitignore`로 커밋 차단, `.env.example` 템플릿 유지).
  - 코드 변경 후 필요 시 `sonar analyze secrets`로 시크릿 유출 여부를 점검한다.

---

## 2. 개발 및 테스트 워크플로우 규칙 (Development & Testing Rules)

1. **계획 단계 (`/plan`) 필수 포함 사항**
   - 새로운 기능이나 변경 사항에 대해 `/plan`을 작성할 때는 반드시 **백엔드(`xUnit`) 및 프론트엔드(`Vitest`) 테스트 시나리오 목록**을 계획서에 함께 포함한다.
2. **테스트 주도 및 동시 검증 원칙**
   - **백엔드 API / 비즈니스 로직**: 요구사항과 엣지 케이스(유효성 검증, 예외 상태 코드 등)를 검증하는 테스트 케이스를 먼저 정의(TDD)하거나 기능 구현과 함께 반드시 작성한다.
   - **프론트엔드 UI / 상태 로직**: 사용자 상호작용(`user-event`) 기반의 컴포넌트 테스트를 함께 작성하거나 업데이트한다.
   - EF Core의 관계형 전용 기능(`ExecuteDeleteAsync`, `EF.Functions.Like` 등)을 정확히 검증하기 위해 백엔드 테스트는 항상 **SQLite In-Memory (`DataSource=:memory:`)**를 사용한다.
3. **작업 완료 전 필수 검증 명령어 (Verification Gate)**
   - 코드 변경 후 작업을 완료했다고 보고하기 전에 반드시 아래 명령어를 실행하여 모든 테스트와 빌드가 통과하는지 확인한다:
     - Backend 테스트: `dotnet test d:\Source\TsProject\backend.Tests\TodoApi.Tests.csproj`
     - Frontend 테스트: `cd d:\Source\TsProject\frontend && npm test`
     - Frontend 빌드 및 타입 체크: `cd d:\Source\TsProject\frontend && npm run build`
