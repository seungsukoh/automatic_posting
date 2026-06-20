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

- Instagram은 Creator 계정 전환 후 Meta Graph API로 연동합니다.
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
Build output directory: cloudflare/dist
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

## 다음 구현

1. Instagram OAuth callback endpoint 추가
2. R2 이미지 업로드 API 추가
3. InstagramPublisher를 Meta Graph API 호출로 교체
4. ThreadsPublisher를 Threads API 호출로 교체
5. Queue consumer와 Cron 중복 발행 방지 강화
