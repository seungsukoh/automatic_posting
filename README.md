# Automatic Posting

Instagram Business 계정용 자동 포스팅 도구입니다. 현재 MVP는 Cloudflare Pages, Pages Functions, D1, MEDIA_KV 저장소를 사용하며 공식 OAuth/API 방식만 사용합니다.

## 현재 상태

- Production URL: `https://automatic-posting.pages.dev`
- Instagram 계정 연결 확인 완료
- Instagram 실제 발행 확인 완료
- 글만 입력해도 Instagram 발행용 JPG 이미지를 자동 생성
- 이미지 업로드 저장소는 현재 `MEDIA_KV` 사용
- Meta App ID/Secret은 서버 설정에 저장됨
- 관리자 설정 키는 일반 사용자 흐름에서 사용하지 않음
- Threads와 Kakao는 일반 사용자 게시 채널에서 숨김 처리

## 사용자 흐름

일반 사용자가 알아야 하는 것은 두 가지입니다.

1. 계정 연결
   - 앱에서 `Instagram 연결하기`를 누릅니다.
   - Facebook/Instagram 승인 화면에서 게시할 Instagram Business 계정을 선택합니다.
   - 앱으로 돌아와 연결된 계정명이 표시되면 준비 완료입니다.

2. 게시 또는 예약
   - 게시 채널을 확인합니다.
   - 제목, 본문, 해시태그를 입력합니다.
   - 이미지는 선택 사항입니다. 이미지를 선택하지 않으면 본문 기반 JPG가 자동 생성됩니다.
   - 바로 게시하거나 날짜 폴더 예약을 만듭니다.

## 운영자 흐름

운영자가 관리하는 값은 일반 사용자 UI에 노출하지 않습니다.

- Meta App ID
- Meta App Secret
- `ADMIN_SETUP_KEY`
- `TOKEN_ENCRYPTION_KEY`
- Cloudflare D1/KV 바인딩

일반적인 계정 연결, 게시, 예약에는 관리자 키 입력이 필요하지 않습니다. 드물게 Meta 앱 설정을 바꿔야 할 때만 운영자가 Cloudflare 또는 운영자 전용 설정 절차로 처리합니다.

## Cloudflare 리소스

```text
Pages project: automatic-posting
D1 database: automatic-posting
D1 binding: DB
Media storage binding: MEDIA_KV
Required secrets:
  ADMIN_SETUP_KEY
  TOKEN_ENCRYPTION_KEY
```

## 개발 명령

```powershell
npm run typecheck
npm run build
npm run deploy:pages
```

Cloudflare 보조 명령:

```powershell
npm run cf:d1:schema
npm run cf:secret:admin
npm run cf:secret:token
```

## 주요 문서

- [현재 시스템 운영 가이드](docs/12-current-system-guide.md)
- [사용자 매뉴얼](docs/15-user-manual.md)
- [진행 상황과 다음 계획](docs/14-progress-and-plan.md)
- [계정 준비 체크리스트](docs/11-account-readiness-checklist.md)
- [제품 요구사항 정의서](docs/01-prd.md)
