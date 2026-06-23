# Cloudflare TypeScript MVP

Cloudflare Workers/Pages Functions, Pages, D1, MEDIA_KV, Queues, Cron 기반 자동 게시 MVP입니다.

## 현재 범위

- Workers API
- D1 schema
- Pages 정적 게시 화면
- 플랫폼별 Publisher 인터페이스
- Instagram, Threads 공식 API 게시 흐름
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

1. `계정 연결` 영역에서 Instagram 또는 Threads 계정을 승인합니다.
2. 플랫폼 상태가 `게시 가능`으로 바뀌는지 확인합니다.
3. 게시 채널을 선택하고 제목, 본문, 해시태그를 입력합니다.
4. 필요하면 이미지나 영상을 선택합니다.
5. `게시 작업 만들기` 또는 `예약 작업 만들기`를 눌러 작업을 생성합니다.

일반 사용자는 Meta App ID, Meta App Secret, Cloudflare secret 값을 입력하지 않습니다. 해당 값은 관리자 설정에서 운영자가 한 번만 관리합니다.

## 관리자 설정 범위

운영자는 다음 값이 준비되어야 사용자가 계정을 연결할 수 있습니다.

- Cloudflare D1, MEDIA_KV, Pages Functions, Cron
- `TOKEN_ENCRYPTION_KEY`
- `ADMIN_SETUP_KEY`
- Meta App ID: `Meta for Developers > My Apps > AutoPosting > App settings > Basic > App ID`
- Meta App Secret: `Meta for Developers > My Apps > AutoPosting > App settings > Basic > App secret`
- Facebook Login OAuth Redirect URI: 배포 도메인의 `/api/auth/meta/callback`

## 다음 확인

1. production 배포가 최신 정적 자산과 Pages Functions를 함께 반영했는지 확인
2. 실제 연결된 Instagram과 Threads 계정으로 같은 게시글을 작성해 플랫폼별 작업 생성 확인
3. 이미지 없음, 비율 초과 이미지, 짧은 영상, 긴 영상 케이스 확인
4. 실패 작업의 Meta API 오류 메시지가 작업 현황에서 읽기 쉬운지 확인
5. Queue consumer와 Cron 중복 발행 방지 강화
