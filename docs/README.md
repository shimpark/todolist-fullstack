# 프로젝트 사양 및 유지보수 문서 (Documentation Index)

TsProject (TodoList Fullstack)의 시스템 아키텍처, 기능 명세, API 레퍼런스 및 개발 가이드를 관리하는 문서 디렉토리입니다.

---

## 📚 문서 목차

1. [시스템 종합 기능 명세서 (SPECIFICATION.md)](file:///d:/Source/TsProject/docs/SPECIFICATION.md)
   - 프로젝트 개요 및 기술 스택
   - 아키텍처 및 디렉토리 구조
   - 데이터 모델 및 DB 스키마 명세
   - 프론트엔드 UI/UX 명세 (다크모드, 비밀번호 정책, 마감일 알림 등)
   - 보안 아키텍처 및 환경변수 명세
   - 테스트 및 품질 보증 (QA) 체계

2. [REST API 레퍼런스 가이드 (API_REFERENCE.md)](file:///d:/Source/TsProject/docs/API_REFERENCE.md)
   - 인증 API (`/api/auth`) 엔드포인트 상세 (회원가입, 로그인, 세션 검증)
   - 할 일 관리 API (`/api/todos`) 엔드포인트 상세 (CRUD, 검색/필터, 일괄 삭제)
   - 에러 응답 규격 및 HTTP 상태 코드 정의

3. [AI 협업 프롬프트 히스토리 및 유지보수 가이드 (PROMPT_HISTORY_AND_GUIDE.md)](file:///d:/Source/TsProject/docs/PROMPT_HISTORY_AND_GUIDE.md)
   - AI 페어 프로그래밍 협업 3대 원칙
   - 실제 프로젝트 개발 프롬프트 타임라인 및 교훈 (Phase 1 ~ 5)
   - **미래 추가 개발을 위한 프롬프트 플레이북 (반복 일정, 칸반 보드, OAuth, 파일 첨부, DB 마이그레이션, Docker, Refresh Token, Rate Limiting, 리팩토링 등 10대 시나리오)**
   - 후임자를 위한 안전 체크리스트 및 3대 필수 검증 게이트
