# 시스템 아키텍처

## 1. 권장 구조

```text
Web App
  -> Backend API
  -> Database
  -> Queue
  -> Worker
  -> Platform Adapters
  -> External APIs
```

## 2. 기술 스택 후보

### Frontend

- Next.js 또는 React
- 운영자용 대시보드 중심 UI
- 게시글 작성, 플랫폼별 미리보기, 예약 캘린더 제공

### Backend

- Node.js/NestJS 또는 Python/FastAPI
- OAuth 콜백 처리
- 게시글/계정/예약/로그 API 제공

### Database

- PostgreSQL
- 트랜잭션과 감사 로그 관리에 적합

### Queue

- Redis + BullMQ 또는 Redis + Celery
- 예약 발행, 실패 재시도, 외부 API 장애 격리

### File Storage

- S3 호환 스토리지
- 이미지 원본과 변환본 저장

## 3. 핵심 모듈

### Content Module

- 게시글 원본 관리
- 플랫폼별 변형 콘텐츠 관리
- 이미지 자산 관리

### Account Module

- 소셜 계정 연결
- OAuth 토큰 저장/갱신
- 계정 권한 관리

### Publish Module

- 즉시 발행
- 예약 발행
- 큐 작업 생성
- 재시도

### Platform Adapter Module

- Instagram Adapter
- Threads Adapter
- Kakao Adapter
- 플랫폼별 API 호출과 오류 정규화

### Audit Module

- 사용자 작업 로그
- 발행 결과 로그
- 관리자 작업 로그

## 4. 발행 흐름

```text
1. 사용자가 게시글 작성
2. 원본 콘텐츠와 플랫폼별 콘텐츠 저장
3. 대상 플랫폼별 PublishJob 생성
4. 즉시 또는 예약 시간에 Worker가 Job 실행
5. Platform Adapter가 외부 API 호출
6. 성공/실패 결과 저장
7. 사용자 화면에 상태 표시
```

## 5. 오류 처리

- 인증 오류: 계정 재연동 필요 상태로 전환
- 제한 오류: 재시도하지 않고 사용자에게 제한 사유 표시
- 일시 장애: 지수 백오프 재시도
- 이미지 규격 오류: 발행 전 검증 단계에서 차단
- 부분 실패: 성공 플랫폼은 유지하고 실패 플랫폼만 재시도 가능

## 6. 보안 설계

- OAuth access token과 refresh token은 암호화 저장
- API 키는 서버 환경변수 또는 secret manager에 저장
- 로그에는 토큰, API 키, 개인정보를 기록하지 않음
- 관리자 기능은 역할 기반 권한으로 제한
- 모든 발행 작업은 사용자/조직/계정 기준으로 권한 검증

