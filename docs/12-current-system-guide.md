# 현재 시스템 운영 가이드

이 문서는 현재 구현된 Social Publisher MVP의 실제 상태와 운영 방법을 정리합니다.

## 1. 시스템 개요

Social Publisher는 Instagram Business와 Threads 계정에 공식 API로 게시 작업을 생성하는 Cloudflare 기반 웹앱입니다.

```text
Frontend: Cloudflare Pages + Vite static assets
API: Cloudflare Pages Functions
Database: Cloudflare D1
Media storage: Cloudflare MEDIA_KV
Auth: Meta OAuth
Secrets: Cloudflare Pages Secrets
```

R2는 현재 Cloudflare 계정에서 사용하지 않습니다. 이미지와 자동 생성된 텍스트 이미지는 `MEDIA_KV`에 저장합니다.

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
GET  /api/social-accounts
POST /api/social-accounts/disconnect
GET  /api/auth/meta/start?platform=instagram
GET  /api/auth/meta/start?platform=threads
GET  /api/auth/meta/callback
POST /api/assets/upload
GET  /api/assets/:key
POST /api/posts
GET  /api/jobs
POST /api/jobs/:id/retry
POST /api/scheduler/run
```

## 3. 현재 완료된 작업

- Cloudflare Pages 배포 구성
- Pages Functions 라우팅 구성
- D1 데이터베이스와 스키마 적용
- `MEDIA_KV` 기반 이미지 업로드와 공개 URL 제공
- Meta OAuth 시작/콜백 API 구현
- Instagram Business 계정 연결 저장
- Meta App ID/Secret 저장
- Page access token 암호화 저장
- Instagram Graph API 발행 구현
- Threads Graph API 발행 구현
- PNG/JPG/WEBP 업로드 지원
- MP4/MOV 영상 업로드 지원
- Instagram 발행 시 JPG 변환 지원
- 이미지 없이 글만 입력하면 본문 기반 JPG 자동 생성
- 일반 사용자 화면에서 관리자 설정과 시스템 상세 상태 숨김

## 4. 현재 운영 상태

```text
Instagram connection: working
Instagram publishing: working
Threads connection: configured / ready for live verification
Threads publishing: implemented / ready for live verification
Media storage: MEDIA_KV
Meta App ID: configured
Meta App Secret: configured
Facebook Login Configuration ID: optional / not configured
```

관리자 설정 API는 실제 App ID, Secret, 관리자 키 값을 반환하지 않고 설정 여부만 반환해야 합니다.

## 5. 역할 분리

### 일반 사용자

일반 사용자는 다음만 수행합니다.

- Instagram 또는 Threads 계정 연결
- 게시글 작성
- 이미지 선택 또는 텍스트만 작성
- 바로 게시 작업 생성
- 날짜 폴더 예약 작업 생성
- 발행 작업 상태 확인

일반 사용자는 다음 값을 입력하지 않습니다.

- 관리자 설정 키
- Meta App ID
- Meta App Secret
- Cloudflare Secret

### 운영자

운영자는 다음을 관리합니다.

- Meta Developer App 설정
- OAuth Redirect URI
- Meta App ID/Secret
- Cloudflare Secrets
- D1/KV 바인딩
- 관리자 전용 설정 변경

## 6. 새 사용자 계정 연결 절차

새 사용자가 자신의 Instagram 또는 Threads 계정을 연결하려면 프로그래밍이나 관리자 키가 필요하지 않습니다.

1. 앱에 접속합니다.
2. `계정 연결` 영역에서 `Instagram 연결하기` 또는 `Threads 연결하기`를 누릅니다.
3. Meta 로그인 화면에서 본인 계정으로 로그인합니다.
4. 게시에 사용할 Instagram Business 계정 또는 Threads 계정을 승인합니다.
5. 앱으로 돌아왔을 때 연결된 username이 표시되는지 확인합니다.
6. 게시 채널이 활성화되면 바로 게시 또는 예약을 진행합니다.

전제 조건:

- Instagram 계정은 프로페셔널 계정이어야 합니다.
- Instagram 계정은 Facebook Page에 연결되어 있어야 합니다.
- 로그인한 Facebook 계정은 해당 Page와 Instagram 자산에 충분한 권한이 있어야 합니다.

## 7. 게시 흐름

Instagram/Threads 발행 흐름:

1. 사용자가 제목/본문/해시태그를 입력합니다.
2. 이미지나 영상이 있으면 `MEDIA_KV`에 업로드합니다.
3. Instagram이 선택되어 있고 이미지가 없으면 브라우저에서 본문 기반 JPG를 자동 생성합니다.
4. 선택된 플랫폼별로 publish job을 생성합니다.
5. Instagram은 media container 생성 후 `media_publish`를 호출합니다.
6. Threads는 threads container 생성 후 `threads_publish`를 호출합니다.
7. permalink를 조회하고 발행 작업에 성공/실패 결과를 저장합니다.

Instagram 공식 Content Publishing API는 순수 텍스트 피드 게시를 지원하지 않으므로, 텍스트만 입력한 경우에도 앱이 자동으로 JPG 이미지를 만들어 발행합니다.

## 8. 예약 흐름

날짜 폴더 예약은 다음 규칙을 사용합니다.

- 날짜 폴더명: `YYYY-MM-DD`
- 이미지 순서: 파일명 숫자순
- 예약 시간: 날짜 폴더 + 시작 시간 + 간격
- 시간 기준: 브라우저 현지 시간
- 캡션: 같은 이름의 `.txt`/`.md` 또는 `captions.csv` 우선, 없으면 기본 문구 사용

## 9. 운영 중 확인 항목

일반 사용자는 앱 화면의 계정 연결, 게시 작업 상태만 확인하면 됩니다.

운영자는 필요할 때 다음 API를 확인합니다.

```text
/api/system/readiness
/api/oauth/meta/readiness
/api/admin/settings
/api/social-accounts
/api/jobs
```

## 10. 주의 사항

- `TOKEN_ENCRYPTION_KEY`를 바꾸면 기존 Meta App Secret과 OAuth token을 복호화할 수 없습니다.
- `ADMIN_SETUP_KEY`는 일반 사용자가 기억하거나 입력할 값이 아닙니다.
- Meta App ID와 Instagram 계정 ID를 혼동하면 안 됩니다. OAuth에는 Meta Developer App ID를 사용합니다.
- `instagram_content_publish` 권한 이름을 사용합니다. `instagram_content_publishing`이 아닙니다.

## 11. 후속 작업

1. 운영자 전용 설정 경로를 Cloudflare Access 또는 계정 기반 admin auth로 대체
2. 새 사용자 온보딩 매뉴얼 보강
3. 단건 게시 전 확인 요약 추가
4. 발행 작업 상세 로그 화면 개선
5. Threads 실제 게시 라이브 검증
6. Kakao 공식 발송 경로 확정 후 연동
