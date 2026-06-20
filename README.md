# Automatic Posting

Instagram Business, Threads, Kakao 공식 채널을 대상으로 하는 자동 포스팅 도구입니다. 현재 MVP는 Cloudflare Pages, Functions, D1, R2 기반으로 배포되어 있으며, 공식 OAuth/API 방식만 사용합니다.

## 현재 상태

- Cloudflare Pages 앱 배포 완료
- D1 데이터베이스 생성 및 스키마 적용 완료
- R2 이미지 저장소 바인딩 확인 완료
- `ADMIN_SETUP_KEY`, `TOKEN_ENCRYPTION_KEY` Secret 등록 완료
- 앱 내 관리자 설정 화면 구현 완료
- Meta App ID/Secret은 나중에 앱에서 입력 가능
- Instagram OAuth 연결 및 단일 이미지 게시 API 코드 구현 완료
- Threads는 OAuth 연결 뼈대와 mock 게시 상태
- Kakao는 공식 발송 경로 확정 전까지 실제 발송 제외

프로덕션 URL:

```text
https://automatic-posting.pages.dev
```

시스템 준비 상태 확인:

```text
https://automatic-posting.pages.dev/api/system/readiness
```

## 핵심 원칙

- 공식 OAuth/API 기반 자동화만 허용합니다.
- Instagram/Threads 비밀번호나 브라우저 세션 쿠키를 저장하지 않습니다.
- 브라우저 화면 자동 클릭 방식은 사용하지 않습니다.
- Kakao 일반 채팅방 자동 발송은 제외하고, Kakao 공식 채널/비즈메시지 계열만 검토합니다.

## 주요 기능

- 게시글 제목, 본문, 링크, 해시태그 작성
- 이미지 선택, 미리보기, R2 업로드
- Instagram/Threads/Kakao 대상 선택
- 즉시 발행 및 예약 발행 작업 생성
- 발행 작업 상태 조회
- 실패 작업 재시도
- 계정 연결 준비 마법사
- 관리자 설정 화면에서 Meta App ID/Secret 저장
- 시스템 준비 상태 패널

## 현재 남은 설정

Meta Developer App을 만든 뒤 앱의 관리자 설정 화면에 아래 값을 입력해야 Instagram/Threads 연결 버튼이 활성화됩니다.

```text
Meta App ID
Meta App Secret
```

관리자 설정 화면에서 사용할 키:

```text
ADMIN_SETUP_KEY = BkufCHgSz286zTVZ8xQw+l2B/sDRah/u0bM6JaleK6U=
```

## Cloudflare 리소스

사용 중인 리소스:

```text
Pages project: automatic-posting
D1 database: automatic-posting
D1 binding: DB
R2 binding: ASSETS
Required secrets:
  ADMIN_SETUP_KEY
  TOKEN_ENCRYPTION_KEY
```

`wrangler.toml`에는 Pages 빌드 출력과 D1 바인딩이 정의되어 있습니다.

## 개발 명령

```powershell
npm run typecheck
npm run build
```

수동 Pages 배포:

```powershell
npm run deploy:pages
```

Cloudflare 리소스 보조 명령:

```powershell
npm run cf:d1:create
npm run cf:d1:schema
npm run cf:r2:create
npm run cf:secret:admin
npm run cf:secret:token
```

## 문서

- [현재 시스템 운영 가이드](docs/12-current-system-guide.md)
- [전문가 그룹 검토 및 다음 실행 계획](docs/13-expert-group-review-next-plan.md)
- [제품 요구사항 정의서](docs/01-prd.md)
- [플랫폼 가능성 검토](docs/02-platform-feasibility.md)
- [아키텍처](docs/03-architecture.md)
- [데이터 모델](docs/04-data-model.md)
- [MVP 백로그](docs/05-mvp-backlog.md)
- [검증 전략](docs/06-test-strategy.md)
- [리스크 관리](docs/07-risk-register.md)
- [전문가 그룹과 운영 모델](docs/08-team-and-operating-model.md)
- [로그인/자동화 경계](docs/09-login-and-automation-boundary.md)
- [프로젝트 실행 계획](docs/10-project-execution-plan.md)
- [계정 준비 체크리스트](docs/11-account-readiness-checklist.md)

## 다음 개발 단계

1. Meta Developer App 생성
2. Redirect URI 등록
3. 앱 관리자 설정에 Meta App ID/Secret 저장
4. Instagram 계정 연결 테스트
5. 이미지 포함 Instagram 실제 게시 테스트
6. Threads 실제 게시 API 구현
7. Kakao 공식 발송 경로 확정 후 연동
