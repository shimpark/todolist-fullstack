# REST API 레퍼런스 가이드 (API Reference)

TsProject 백엔드 Web API의 모든 엔드포인트 명세서입니다.

- **기본 URL**: `http://localhost:5191` (또는 환경변수 `VITE_API_URL` 값)
- **Content-Type**: `application/json`
- **인증 방식**: `Authorization: Bearer <JWT_TOKEN>`

---

## 1. 인증 API (`/api/auth`)

### 1.1 회원가입 (Register)
- **Method**: `POST`
- **URL**: `/api/auth/register`
- **인증 필요 여부**: 없음

#### 요청 본문 (Request Body)
```json
{
  "username": "tester",
  "password": "StrongPassword123!"
}
```
*유효성 검증 규칙: 아이디 2~50자, 비밀번호 8~64자, 영문 대/소문자, 숫자, 특수문자 필수, 공백 불가, 아이디 미포함, zxcvbn 점수 3점 이상.*

#### 응답 (Response)
- `200 OK`:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "tester"
  }
  ```
- `400 Bad Request`:
  ```text
  "이미 사용 중인 아이디입니다." 또는 "비밀번호는 8자 이상 64자 이하여야 합니다."
  ```

---

### 1.2 로그인 (Login)
- **Method**: `POST`
- **URL**: `/api/auth/login`
- **인증 필요 여부**: 없음

#### 요청 본문 (Request Body)
```json
{
  "username": "tester",
  "password": "StrongPassword123!"
}
```

#### 응답 (Response)
- `200 OK`:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "tester"
  }
  ```
- `401 Unauthorized`:
  ```text
  "아이디 또는 비밀번호가 올바르지 않습니다."
  ```

---

### 1.3 내 정보 확인 (Get Current User)
- **Method**: `GET`
- **URL**: `/api/auth/me`
- **인증 필요 여부**: **Bearer 토큰 필수**

#### 응답 (Response)
- `200 OK`:
  ```json
  {
    "id": 1,
    "username": "tester"
  }
  ```
- `401 Unauthorized`: 인증 토큰 누락 또는 만료

---

## 2. 할 일 관리 API (`/api/todos`)

모든 엔드포인트는 **Bearer 토큰 인증이 필수**입니다.

### 2.1 할 일 목록 조회 (Get Todos)
- **Method**: `GET`
- **URL**: `/api/todos`
- **쿼리 파라미터 (Query Parameters)**:
  - `search` (string, optional): 제목 키워드 검색
  - `isCompleted` (boolean, optional): 완료 여부 필터 (`true` / `false`)
  - `priority` (integer, optional): 우선순위 필터 (`0`: Low, `1`: Medium, `2`: High)
  - `category` (integer, optional): 카테고리 필터 (`0`: Work, `1`: Personal, `2`: Study)

#### 응답 (Response)
- `200 OK`:
  ```json
  [
    {
      "id": 1,
      "userId": 1,
      "title": "API 문서 작성",
      "isCompleted": false,
      "priority": 2,
      "category": 0,
      "dueDate": "2026-11-20",
      "createdAt": "2026-11-17T10:00:00Z"
    }
  ]
  ```

---

### 2.2 단일 할 일 조회 (Get Todo By ID)
- **Method**: `GET`
- **URL**: `/api/todos/{id}`

#### 응답 (Response)
- `200 OK`: 할 일 객체 반환
- `404 Not Found`: 해당 ID의 항목이 없거나 타 사용자의 항목인 경우

---

### 2.3 새 할 일 생성 (Create Todo)
- **Method**: `POST`
- **URL**: `/api/todos`

#### 요청 본문 (Request Body)
```json
{
  "title": "다크모드 문서 작성",
  "priority": 1,
  "category": 0,
  "dueDate": "2026-11-25"
}
```
*`priority`와 `category`는 생략 시 각각 기본값(`1`: 보통, `0`: 업무) 적용.*

#### 응답 (Response)
- `201 Created`: 생성된 할 일 객체 및 `Location: /api/todos/{id}` 헤더
- `400 Bad Request`: 제목 누락 또는 200자 초과

---

### 2.4 할 일 수정 (Update Todo)
- **Method**: `PUT`
- **URL**: `/api/todos/{id}`

#### 요청 본문 (Request Body)
```json
{
  "title": "다크모드 문서 작성 완료",
  "isCompleted": true,
  "priority": 2,
  "category": 0,
  "dueDate": "2026-11-25"
}
```

#### 응답 (Response)
- `204 No Content`: 성공적으로 수정됨
- `400 Bad Request`: 제목 유효성 실패
- `404 Not Found`: 항목이 존재하지 않거나 소유자가 아닌 경우

---

### 2.5 할 일 삭제 (Delete Todo)
- **Method**: `DELETE`
- **URL**: `/api/todos/{id}`

#### 응답 (Response)
- `204 No Content`: 성공적으로 삭제됨
- `404 Not Found`: 항목이 없거나 소유자가 아닌 경우

---

### 2.6 완료된 할 일 일괄 삭제 (Clear Completed)
- **Method**: `DELETE`
- **URL**: `/api/todos/completed`

#### 응답 (Response)
- `200 OK`:
  ```json
  {
    "deletedCount": 3
  }
  ```

---

## 3. 열거형(Enum) 및 코드 매핑표

### 우선순위 (`Priority`)
| 코드 | 영문명 | 한글 라벨 | 배지 색상 (라이트 / 다크) |
| :---: | :--- | :--- | :--- |
| `0` | `Low` | 낮음 | 연한 회색 (`#f3f4f6` / `#334155`) |
| `1` | `Medium`| 보통 | 파란색 (`#dbeafe` / `#1e3a8a`) |
| `2` | `High` | 높음 | 붉은색 (`#fee2e2` / `#451a1a`) |

### 카테고리 (`Category`)
| 코드 | 영문명 | 한글 라벨 | 태그 색상 (라이트 / 다크) |
| :---: | :--- | :--- | :--- |
| `0` | `Work` | 업무 | 보라색 (`#ede9fe` / `#3b1d6b`) |
| `1` | `Personal` | 개인 | 초록색 (`#dcfce7` / `#14532d`) |
| `2` | `Study` | 공부 | 주황색 (`#ffedd5` / `#5a270f`) |
