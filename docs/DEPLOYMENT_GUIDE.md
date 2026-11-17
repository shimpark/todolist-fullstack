# 무료 클라우드 호스팅 배포 가이드 (Free Cloud Deployment Guide)

본 문서는 **TsProject (TodoList Fullstack)**를 100% 무료 클라우드 인프라에 배포하여 운영할 수 있도록 단계별 안내를 제공합니다.

---

## 🏗️ 추천 무료 아키텍처

```
[사용자 브라우저]
       │
       ├───► [Frontend] Vercel (글로벌 CDN, 무제한 트래픽, 무료)
       │         │
       │         ▼ REST API (JWT Bearer)
       └───► [Backend] Fly.io (공유 CPU, 3GB 영속 볼륨 무료 마운트)
                 │
                 ▼ SQLite DB
             [/data/todos.db (영구 보존)]
```

- **Frontend**: **Vercel** (Vite + React SPA 정적 호스팅)
- **Backend**: **Fly.io** (ASP.NET Core 8 Web API + SQLite 무료 볼륨 보존)
  *(대안: **Render.com** 무료 웹 서비스)*

---

## Step 1: 백엔드(Backend) 배포 - Fly.io (추천: SQLite 영구 보존)

Fly.io는 무료 티어에서 **3GB의 영속 볼륨(Persistent Volume)**을 제공하므로, 서버 재시작 시에도 SQLite 데이터(`todos.db`)가 삭제되지 않고 유지됩니다.

### 1.1 사전 준비 (Fly CLI 설치)
- Windows PowerShell에서 Fly CLI를 설치합니다:
  ```powershell
  pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
  ```
- Fly.io 계정으로 로그인합니다:
  ```powershell
  fly auth login
  ```

### 1.2 앱 생성 및 무료 볼륨 마운트
1. 프로젝트 루트(`d:\Source\TsProject`)에서 Fly 앱을 생성합니다:
   ```powershell
   fly launch --no-deploy
   ```
   *(앱 이름은 고유하게 설정합니다. 예: `shimpark-todo-api`)*

2. SQLite 데이터를 저장할 1GB 무료 볼륨을 생성합니다 (도쿄 리전 `nrt` 권장):
   ```powershell
   fly volumes create todo_data --region nrt --size 1
   ```

3. 환경변수(JWT 비밀키)를 등록합니다 (최소 32자 이상):
   ```powershell
   fly secrets set JWT_SECRET_KEY="SuperSecretKeyForJwtAuthentication32CharsLong!"
   fly secrets set FRONTEND_ORIGIN="*"
   ```

4. 배포를 실행합니다:
   ```powershell
   fly deploy
   ```

5. 배포 완료 후 출력되는 백엔드 URL을 확인합니다:
   - 예: `https://shimpark-todo-api.fly.dev`

---

## Step 2 (대안): 백엔드 배포 - Render.com

CLI 설치 없이 웹 UI만으로 손쉽게 배포하고 싶은 경우의 대안입니다.

1. [Render.com](https://render.com)에 가입 후 로그인합니다.
2. 상단 **New +** ➔ **Blueprint** (또는 Web Service)를 선택합니다.
3. GitHub 저장소(`shimpark/todolist-fullstack`)를 연결합니다.
4. 프로젝트에 포함된 `render.yaml` 설정에 따라 자동으로 백엔드가 감지됩니다:
   - **Environment**: Docker
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Plan**: Free
5. 배포 완료 후 생성된 URL을 확인합니다:
   - 예: `https://tsproject-backend.onrender.com`
   *(주의: Render 무료 플랜은 15분 비활성 시 슬립 모드로 전환되며, 영속 디스크가 지원되지 않아 재배포 시 DB가 리셋될 수 있습니다)*

---

## Step 3: 프론트엔드(Frontend) 배포 - Vercel (1분 완성)

1. [Vercel](https://vercel.com)에 접속하여 GitHub 계정으로 로그인합니다.
2. 대시보드에서 **Add New...** ➔ **Project**를 클릭합니다.
3. GitHub 저장소 `shimpark/todolist-fullstack`을 찾아 **Import**를 누릅니다.
4. **Configure Project** 화면에서 아래 설정을 확인합니다:
   - **Framework Preset**: `Vite` (자동 감지)
   - **Root Directory**: `frontend` 선택
   - **Environment Variables**:
     - `Name`: `VITE_API_URL`
     - `Value`: Step 1 또는 2에서 배포한 백엔드 URL (예: `https://shimpark-todo-api.fly.dev`)
5. **Deploy** 버튼을 클릭합니다.
6. 약 30초 후 배포가 완료되며 무료 도메인(예: `https://todolist-fullstack-shimpark.vercel.app`)이 발급됩니다.

---

## Step 4: 백엔드 CORS 최종 설정

프론트엔드 Vercel 도메인이 발급되면, 백엔드의 `FRONTEND_ORIGIN` 환경변수를 해당 도메인으로 지정하여 보안을 강화합니다.

- **Fly.io의 경우**:
  ```powershell
  fly secrets set FRONTEND_ORIGIN="http://localhost:5173,https://your-app.vercel.app"
  ```
- **Render의 경우**:
  - Render 대시보드 ➔ 환경변수(Environment) ➔ `FRONTEND_ORIGIN` 값을 `http://localhost:5173,https://your-app.vercel.app`로 수정 후 저장.

---

## Step 5: 동작 확인 및 점검 체크리스트

- [ ] Vercel 프론트엔드 URL에 접속하여 로그인 및 회원가입 화면이 정상 로드되는지 확인.
- [ ] 신규 회원가입 ➔ 로그인 ➔ 할 일 등록 ➔ 다크모드 전환이 정상 동작하는지 확인.
- [ ] 브라우저 개발자 도구(F12) Network 탭에서 API 호출에 `CORS error`가 없는지 확인.
- [ ] 브라우저를 새로고침하거나 재접속하여 할 일 데이터가 그대로 유지되는지 확인.
