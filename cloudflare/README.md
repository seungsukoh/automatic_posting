# Cloudflare TypeScript MVP

Cloudflare Workers, Pages, D1, R2, Queues, Cron 기반 자동 포스팅 MVP입니다.

## 현재 범위

- Workers API
- D1 schema
- Pages 정적 관리자 화면
- 플랫폼별 Publisher 인터페이스
- Instagram, Threads mock success
- Kakao official route not configured failure
- 즉시 발행, 예약 발행, 재시도, 작업 조회

## 전제

- Instagram은 Business 계정과 Meta Graph API로 연동합니다.
- Threads는 Meta Developer 앱에서 권한 확인 후 연동합니다.
- Kakao 일반 채팅방 자동 발송은 제외하고 공식 채널/비즈메시지 계열로 검토합니다.
- API secret과 access token은 브라우저가 아니라 Workers secret/D1에 보관합니다.

## 로컬 실행 준비

Node.js 설치 후:

```powershell
cd cloudflare
npm install
npm run build
npm run typecheck
npx wrangler d1 create automatic-posting
```

Cloudflare Pages build configuration:

```text
Framework preset: Vite
Root directory: empty
Build command: npm run build
Build output directory: dist
```

생성된 D1 database id를 `wrangler.toml`의 `database_id`에 넣습니다.

로컬 D1 초기화:

```powershell
npm run d1:init
```

Workers API 실행:

```powershell
npm run worker:dev
```

로컬 UI에서 API까지 확인할 때는 터미널 두 개를 사용합니다.

```powershell
# terminal 1: Worker API
cd cloudflare
npm run d1:init
npm run worker:dev

# terminal 2: Vite UI
cd cloudflare
npm run dev
```

Vite dev/preview는 기본적으로 `/api/*` 요청을 `http://127.0.0.1:8787` Worker로 프록시합니다.
다른 Worker 주소를 쓰려면 `VITE_WORKER_API_ORIGIN`을 설정하고, 배포된 Pages가 별도 Worker API를 호출해야 하면 `VITE_API_BASE`를 설정합니다.

## 일반 사용자 사용 흐름

운영자가 Cloudflare와 Facebook Login for Business 설정을 먼저 끝낸 뒤, 일반 사용자는 앱 안에서 아래 순서만 진행합니다.

1. 상단의 자동 예약 시작 영역에서 서비스 준비 상태를 확인합니다.
2. `Instagram 연결하기`를 눌러 게시할 Instagram Business 계정을 승인합니다.
3. 플랫폼 상태가 `예약 가능`으로 바뀌면 날짜별 폴더를 선택합니다.
4. 예약 미리보기에서 이미지 수, 날짜, 시간, 제외 파일, 경고를 확인합니다.
5. `예약 작업 만들기`를 눌러 예약을 확정합니다.

일반 사용자는 Meta App ID, Meta App Secret, Cloudflare secret 값을 입력하지 않습니다. 해당 값은 관리자 설정에서 운영자가 한 번만 관리합니다.

## 관리자 설정 범위

운영자는 다음 값이 준비되어야 사용자가 계정을 연결할 수 있습니다.

- Cloudflare D1, R2, Pages Functions, Cron
- `TOKEN_ENCRYPTION_KEY`
- `ADMIN_SETUP_KEY`
- Meta App ID: `Meta for Developers > My Apps > AutoPosting > App settings > Basic > App ID`
- Meta App Secret: `Meta for Developers > My Apps > AutoPosting > App settings > Basic > App secret`
- Facebook Login OAuth Redirect URI: 배포 도메인의 `/api/auth/meta/callback`

## 다음 구현

1. Instagram OAuth callback endpoint 추가
2. R2 이미지 업로드 API 추가
3. InstagramPublisher를 Meta Graph API 호출로 교체
4. ThreadsPublisher를 Threads API 호출로 교체
5. Queue consumer와 Cron 중복 발행 방지 강화
