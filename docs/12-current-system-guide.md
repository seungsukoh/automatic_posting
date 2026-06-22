# 현재 시스템 운영 가이드

이 문서는 현재 구현된 Automatic Posting MVP의 실제 상태와 운영 방법을 정리합니다.

## 1. 시스템 개요

Automatic Posting은 하나의 작성 화면에서 텍스트와 이미지를 준비하고, 공식 API를 통해 Instagram Business, Threads, Kakao 공식 발송 경로에 게시하는 것을 목표로 합니다.

현재 구현의 중심은 Cloudflare 기반 웹앱입니다.

```text
Frontend: Cloudflare Pages + Vite static assets
API: Cloudflare Pages Functions
Database: Cloudflare D1
Image storage: Cloudflare R2
Auth: Meta OAuth
Secrets: Cloudflare Pages Secrets
```

## 2. 배포 URL

```text
https://automatic-posting.pages.dev
```

주요 API:

```text
GET  /api/health
GET  /api/system/readiness
GET  /api/oauth/meta/readiness
GET  /api/admin/settings
POST /api/admin/settings
GET  /api/social-accounts
POST /api/social-accounts/disconnect
GET  /api/auth/meta/start?platform=instagram
GET  /api/auth/meta/callback
POST /api/assets/upload
GET  /api/assets/:key
POST /api/posts
GET  /api/jobs
POST /api/jobs/:id/retry
```

## 3. 현재 완료된 작업

- Cloudflare Pages 배포 구성
- Pages Functions 라우팅 구성
- D1 데이터베이스 생성
- D1 스키마 적용
- R2 이미지 업로드 API 구현
- 앱에서 이미지 선택 및 업로드 연결
- OAuth Redirect URI 표시
- Meta OAuth 시작/콜백 API 구현
- 연결된 계정 저장 구조 구현
- Meta App ID/Secret 관리자 설정 화면 구현
- Meta App Secret 암호화 저장 구현
- Instagram Graph API 단일 이미지 게시 코드 구현
- 시스템 준비 상태 패널 구현
- Cloudflare CLI 보조 스크립트 추가

## 4. Cloudflare 설정 상태

현재 확인된 상태:

```text
D1 binding DB: 준비됨
D1 schema: 준비됨
R2 binding ASSETS: 준비됨
ADMIN_SETUP_KEY: 준비됨
TOKEN_ENCRYPTION_KEY: 준비됨
Meta App ID: 미입력
Meta App Secret: 미입력
```

시스템 준비 상태는 앱 화면의 `시스템 준비 상태` 섹션 또는 아래 API로 확인합니다.

```text
https://automatic-posting.pages.dev/api/system/readiness
```

## 5. 관리자 설정

Meta App ID/Secret은 Cloudflare 콘솔에 직접 넣지 않고 앱 화면에서 나중에 입력할 수 있습니다.

앱 화면의 `관리자 설정` 섹션에서 입력합니다.

```text
관리자 설정 키
Meta App ID
Meta App Secret
```

현재 관리자 설정 키:

```text
ADMIN_SETUP_KEY = Cloudflare Pages Secret에서 관리합니다. 값은 문서나 채팅에 기록하지 않습니다.
```

주의:

- `ADMIN_SETUP_KEY`는 관리자 설정 저장 권한 확인용입니다.
- `TOKEN_ENCRYPTION_KEY`는 DB에 저장되는 Secret과 OAuth 토큰 암호화에 사용됩니다.
- `TOKEN_ENCRYPTION_KEY`를 바꾸면 기존에 저장된 Meta App Secret과 계정 토큰을 복호화할 수 없습니다.

## 6. Meta 설정 절차

Meta Developer App을 만든 뒤 아래 Redirect URI를 등록합니다.

```text
https://automatic-posting.pages.dev/api/auth/meta/callback
```

앱에 필요한 권한:

Instagram:

```text
pages_show_list
pages_read_engagement
instagram_basic
instagram_content_publish
```

Threads:

```text
threads_basic
threads_content_publish
```

Meta App ID/Secret을 받은 뒤 앱의 관리자 설정 화면에 저장합니다. 저장이 성공하면 계정 연결 카드가 `설정값 필요`에서 `연결 준비 완료`로 바뀌어야 합니다.

## 7. Instagram 게시 흐름

현재 Instagram 게시 흐름은 다음과 같습니다.

1. 앱에서 Instagram 연결하기 클릭
2. Meta OAuth 승인
3. Facebook Page 목록 조회
4. 연결된 Instagram Business 계정 확인
5. Page access token 암호화 저장
6. 게시글 작성
7. 이미지 R2 업로드
8. Instagram media container 생성
9. `media_publish` 호출
10. permalink 조회
11. 발행 작업에 성공/실패 결과 저장

## 8. 데이터 모델

주요 테이블:

```text
posts
post_targets
publish_jobs
social_accounts
app_settings
audit_logs
```

`app_settings`에는 Meta App ID와 암호화된 Meta App Secret이 저장됩니다.

`social_accounts`에는 연결된 Instagram/Threads 계정 정보와 암호화된 access token이 저장됩니다.

## 9. 개발 및 배포 명령

검증:

```powershell
npm run typecheck
npm run build
```

수동 배포:

```powershell
npm run deploy:pages
```

D1 스키마 적용:

```powershell
npm run cf:d1:schema
```

## 10. 운영 중 확인할 항목

앱 화면에서 먼저 확인할 섹션:

```text
시스템 준비 상태
관리자 설정
계정 연결
발행 작업
```

문제 발생 시 우선 확인할 API:

```text
/api/system/readiness
/api/oauth/meta/readiness
/api/admin/settings
/api/jobs
```

## 11. 현재 남은 작업

필수:

1. Meta Developer App 생성
2. Redirect URI 등록
3. 앱 관리자 설정에 Meta App ID/Secret 저장
4. Instagram 계정 연결 테스트
5. Instagram 실제 게시 테스트

후속:

1. Threads 실제 게시 API 구현
2. Kakao 공식 발송 경로 확정
3. Kakao API 연동
4. 예약 발행 자동 실행 방식 고도화
5. 토큰 만료/재연결 UX 개선
6. 게시 결과 상세 로그 화면 개선

## 12. 자동화 경계

이 프로젝트는 공식 API 기반 자동화만 지원합니다.

제외하는 방식:

- Instagram/Threads/Kakao 비밀번호 저장
- 브라우저 로그인 세션 탈취
- 브라우저 화면 자동 클릭
- 일반 카카오톡 채팅방 임의 자동 전송

지원하는 방식:

- Meta OAuth
- Instagram Graph API
- Threads API
- Kakao 공식 채널/비즈메시지 계열 API
