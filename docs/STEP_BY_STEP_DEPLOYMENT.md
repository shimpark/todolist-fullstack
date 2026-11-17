# 실전 단계별 순차 배포 및 유지보수 런북 (Step-by-Step Deployment Runbook)

본 문서는 **TsProject (TodoList Fullstack)**를 클라우드 무료 인프라(**Vercel + Fly.io**)에 배포하고, 추후 장애 대응 및 데이터베이스 백업 등 실무 유지보수를 수행할 수 있도록 작성된 **순차 실행 런북(Runbook)**입니다.

명령어를 위에서부터 순서대로 복사하여 터미널에 붙여넣기만 하면 배포가 완료됩니다.

---

## 📋 배포 전체 흐름도 (Architecture Overview)

```mermaid
flowchart LR
    Dev[개발자 로컬 환경] -->|1. git push| GitHub[GitHub 원격 저장소]
    GitHub -->|자동 빌드 및 배포| Vercel[Vercel: 프론트엔드]
    Dev -->|2. fly deploy| Fly[Fly.io: 백엔드 API]
    Fly --- Vol[(Fly Volume: /data/todos.db)]
    Vercel -->|HTTPS / REST API| Fly
```

---

## 🛠️ 사전 준비 (Prerequisites)

배포를 시작하기 전 아래 3가지 무료 계정이 필요합니다:
1. [GitHub 계정](https://github.com/) (현재 소스 푸시 완료됨)
2. [Fly.io 계정](https://fly.io/) (백엔드 호스팅 및 SQLite 볼륨 무료 제공)
3. [Vercel 계정](https://vercel.com/) (프론트엔드 무료 호스팅)

---

## 🚀 [Phase 1] 백엔드(Backend) Fly.io 순차 배포

백엔드는 **.NET 8 Web API**와 **SQLite DB**로 구성되어 있습니다. Fly.io의 무료 볼륨에 `todos.db`를 마운트하여 데이터가 영구 보존되도록 설정합니다.

### Step 1-1. Fly CLI 도구 설치 및 로그인
Windows PowerShell을 열고 아래 명령어를 순서대로 실행합니다:

```powershell
# 1. Fly CLI 설치
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"

# 2. 환경변수 PATH 즉시 반영 (또는 터미널 재시작)
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ";" + [Environment]::GetEnvironmentVariable('Path', 'User')

# 3. 로그인 (브라우저가 열리면 승인)
fly auth login
```

---

### Step 1-2. Fly 앱 생성 및 고유 이름 설정
프로젝트 루트 디렉토리(`d:\Source\TsProject`)로 이동하여 초기 앱 구성을 생성합니다:

```powershell
cd d:\Source\TsProject

# 앱 생성 (배포는 아직 진행하지 않음)
# 고유한 앱 이름을 입력합니다. (예: shimpark-todo-api)
fly launch --no-deploy
```

> [!NOTE]
> `fly.toml` 파일이 이미 프로젝트 루트에 준비되어 있으므로, 기존 설정을 사용할 것인지 묻는 프롬프트가 나오면 `Yes`를 선택합니다.

---

### Step 1-3. SQLite 영구 보존용 1GB 무료 볼륨 생성
컨테이너가 재시작되거나 재배포되어도 할 일 데이터가 삭제되지 않도록 **무료 영속 볼륨(Persistent Volume)**을 생성합니다:

```powershell
# 도쿄 리전(nrt - 한국에서 가장 빠름)에 1GB 볼륨 생성
fly volumes create todo_data --region nrt --size 1
```

---

### Step 1-4. 시크릿(환경변수) 안전 주입
보안에 민감한 JWT 비밀키와 초기 CORS 설정을 등록합니다:

```powershell
# 32자 이상의 안전한 난수 JWT 키와 초기 와일드카드 CORS 등록
fly secrets set JWT_SECRET_KEY="SuperSecretKeyForJwtAuthenticationMustBe32BytesLong!" FRONTEND_ORIGIN="*"
```

---

### Step 1-5. 백엔드 컨테이너 빌드 및 배포 실행
준비된 `backend/Dockerfile`을 기반으로 원격 컨테이너 빌드 및 배포를 실행합니다:

```powershell
fly deploy
```

---

### Step 1-6. 백엔드 배포 및 헬스체크 검증
배포가 완료되면 브라우저 또는 터미널에서 헬스체크 엔드포인트를 호출하여 정상 작동을 확인합니다:

```powershell
# 예시 URL (본인의 앱 이름으로 변경)
curl.exe https://shimpark-todo-api.fly.dev/healthz
```
- **기대 출력**: `Healthy` (HTTP 200 OK)
- ⚠️ **중요**: 이때 확인한 백엔드 도메인(`https://<YOUR-APP>.fly.dev`)을 메모해 둡니다. (프론트엔드 연동 시 필요)

---

## 🌐 [Phase 2] 프론트엔드(Frontend) Vercel 순차 배포

Vercel은 GitHub 저장소를 연결해 두면 `main` 브랜치에 코드를 푸시할 때마다 자동으로 전 세계 CDN에 1분 만에 무료 배포됩니다.

### Step 2-1. Vercel 프로젝트 생성
1. [Vercel 대시보드](https://vercel.com/dashboard)에 접속합니다.
2. 우측 상단의 **Add New...** ➔ **Project** 버튼을 클릭합니다.
3. GitHub 저장소 목록에서 `shimpark/todolist-fullstack`을 찾아 **Import** 버튼을 클릭합니다.

---

### Step 2-2. 빌드 및 환경변수 설정
설정 화면(**Configure Project**)에서 아래 3가지만 확인합니다:

1. **Framework Preset**: `Vite` (자동 선택됨)
2. **Root Directory**: `Edit` 버튼을 눌러 **`frontend`** 폴더를 선택하고 `Continue`를 누릅니다.
3. **Environment Variables (환경변수)**:
   - **Key**: `VITE_API_URL`
   - **Value**: Step 1-6에서 메모한 Fly.io 백엔드 주소 입력  
     *(예: `https://shimpark-todo-api.fly.dev` - 끝에 슬래시 `/` 제외)*
   - **Add** 버튼을 클릭하여 등록합니다.

---

### Step 2-3. 배포 실행
- 하단의 **Deploy** 버튼을 클릭합니다.
- 약 30~45초 후 축하 폭죽 애니메이션과 함께 배포가 완료됩니다!
- 발급된 도메인(예: `https://todolist-fullstack-shimpark.vercel.app`)을 클릭하여 접속합니다.

---

## 🔒 [Phase 3] 사후 연동 및 CORS 보안 잠금

배포된 프론트엔드 도메인이 확보되었으므로, 백엔드의 `FRONTEND_ORIGIN`을 와일드카드(`*`)에서 **실제 도메인만 허용**하도록 보안을 강화합니다.

```powershell
# 로컬 개발 주소와 Vercel 배포 주소를 함께 허용 (콤마로 구분)
fly secrets set FRONTEND_ORIGIN="http://localhost:5173,https://todolist-fullstack-shimpark.vercel.app"
```

---

## 🛠️ [Phase 4] 실무 운영 및 유지보수 런북 (Operations Runbook)

배포 완료 후 실무에서 일상적으로 수행하는 유지보수 가이드입니다.

### 4.1 일상 코드 수정 및 재배포 워크플로우
1. **프론트엔드 코드 수정 시**:
   - 로컬에서 코드 수정 ➔ `git commit` ➔ `git push origin main`
   - Vercel이 GitHub 푸시 이벤트를 감지하여 **자동으로 재빌드 및 무중단 배포**합니다.
2. **백엔드 코드 수정 시**:
   - 로컬에서 코드 수정 및 테스트(`dotnet test`) 통과 확인.
   - `fly deploy` 명령어 실행 ➔ 컨테이너 자동 롤링 업데이트 배포.

---

### 4.2 실시간 로그 모니터링 (Debugging Logs)
서버에서 오류가 발생하거나 API 호출 로그를 실시간으로 확인해야 할 때:

```powershell
# 1. 백엔드 실시간 콘솔 로그 스트리밍
fly logs

# 2. 백엔드 인스턴스 상태 확인
fly status
```

---

### 4.3 SQLite 데이터베이스 수동 백업 및 다운로드
정기적으로 SQLite 데이터베이스 파일(`todos.db`)을 로컬 PC에 백업받는 방법입니다:

```powershell
# Fly.io 볼륨(/data/todos.db)에서 로컬로 안전하게 다운로드
fly sftp get /data/todos.db ./backup_todos_$(Get-Date -Format 'yyyyMMdd').db
```

---

### 4.4 데이터베이스 복원 (Restore)
백업해 둔 로컬 DB 파일을 다시 서버로 업로드하여 복구할 때:

```powershell
# 로컬 백업 파일을 서버 볼륨으로 덮어쓰기
fly sftp put ./backup_todos_20261118.db /data/todos.db

# 파일 반영을 위해 백엔드 재시작
fly apps restart
```

---

### 4.5 서비스 긴급 재시작 및 롤백
- **앱 즉시 재시작**:
  ```powershell
  fly apps restart
  ```
- **이전 배포 버전으로 롤백**:
  ```powershell
  # 이전 릴리즈 목록 확인
  fly releases

  # 특정 버전(예: v2)으로 롤백 배포
  fly deploy --image <이전 릴리즈의 이미지 태그>
  ```

---

## ❓ [Phase 5] 자주 묻는 질문 및 트러블슈팅 (FAQ)

### Q1. 브라우저 콘솔에 `CORS error`가 발생합니다.
- **원인**: 백엔드의 `FRONTEND_ORIGIN` 환경변수에 현재 접속 중인 Vercel 도메인이 등록되지 않았습니다.
- **해결**: `fly secrets set FRONTEND_ORIGIN="https://your-domain.vercel.app"`를 실행하세요. (프로토콜 `https://` 필수, 끝의 슬래시 `/` 제외)

### Q2. 첫 요청 시 로딩이 5~10초 정도 걸립니다.
- **원인**: Fly.io 무료 티어 설정 중 `min_machines_running = 0`으로 인해 요청이 없을 때 머신이 대기(Sleep) 상태로 전환되었다가 깨어나는 정상적인 콜드 스타트(Cold Start) 현상입니다.
- **해결**: 첫 요청 이후에는 Kestrel 서버가 즉각적으로 응답합니다. 상시 가동을 원할 경우 `fly.toml`의 `min_machines_running = 1`로 변경할 수 있습니다.

### Q3. 배포 후 새로고침 시 404 Not Found가 발생합니다.
- **원인**: SPA(Single Page Application)의 클라이언트 라우팅이 웹서버에 설정되지 않았기 때문입니다.
- **해결**: 이미 [vercel.json](file:///d:/Source/TsProject/frontend/vercel.json)에 `rewrites` 규칙이 작성되어 있으므로, Vercel의 Root Directory가 `frontend`로 지정되어 있는지 확인하세요.
