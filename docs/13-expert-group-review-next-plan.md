# 전문가 그룹 검토 및 다음 실행 계획

작성일: 2026-06-21

## 1. 회의 목적

Social Publisher 프로젝트의 현재 구현 상태를 기준으로 전문가 그룹 관점에서 방향성을 재검토하고, 이후 진행 순서를 확정한다.

참여 관점:

- 프로젝트 매니저
- 소프트웨어 아키텍트
- 백엔드 개발자
- 프론트엔드 개발자
- 보안 담당자
- QA/검증 엔지니어
- 마케팅/광고 운영 담당자
- 플랫폼 정책 검토 담당자
- Cloudflare 운영 담당자
- Meta/Instagram 연동 담당자
- Kakao 연동 검토 담당자

## 2. 현재까지 확정된 방향

### 2.1 자동화 원칙

공식 OAuth/API 기반 자동화만 지원한다.

제외:

- 플랫폼 비밀번호 저장
- 로그인 세션/쿠키 저장
- 브라우저 또는 앱 화면 자동 조작
- 비공식 API 사용
- 일반 카카오톡 단체방 완전 자동 발송

포함:

- Meta OAuth
- Instagram Graph API
- Threads API
- Kakao 공식 채널/비즈메시지 계열 API
- 일반 카카오톡 단체방은 반자동 공유 보조 UX만 검토

### 2.2 1차 제품 범위

초기 버전은 외부 고객용 SaaS가 아니라 운영자 본인이 소유하거나 명확한 운영 권한을 가진 계정만 연결하는 내부용 자동 포스팅 도구로 진행한다.

포함:

- 게시글 작성
- 이미지 첨부
- Cloudflare R2 이미지 업로드
- Instagram Business 계정 연결
- Instagram 단일 이미지 게시
- Threads 연결 준비
- 예약/즉시 발행 작업 구조
- 발행 결과 저장
- 관리자 설정 화면
- 시스템 준비 상태 확인

후순위:

- Threads 실제 게시 API
- Kakao 채널/비즈메시지 연동
- 승인 워크플로우
- 다중 사용자/다중 조직
- 분석 리포트
- 유료 SaaS 과금

## 3. 현재 구현 상태

### 3.1 배포/인프라

완료:

- Cloudflare Pages 배포
- Pages Functions 라우팅
- D1 데이터베이스 생성
- D1 스키마 적용
- R2 바인딩 확인
- `ADMIN_SETUP_KEY` 등록
- `TOKEN_ENCRYPTION_KEY` 등록
- 시스템 준비 상태 API 구현

프로덕션:

```text
https://automatic-posting.pages.dev
```

시스템 준비 상태:

```text
https://automatic-posting.pages.dev/api/system/readiness
```

### 3.2 앱 기능

완료:

- 계정 연결 준비 마법사
- 계정 연결 상태 카드
- OAuth Redirect URI 표시
- 관리자 설정 UI
- Meta App ID/Secret 저장 API
- 게시글 작성 UI
- 이미지 선택/미리보기
- 이미지 R2 업로드 API
- 발행 작업 생성
- 발행 작업 조회
- 실패 작업 재시도

### 3.3 Meta/Instagram

완료:

- Meta OAuth 시작 API
- Meta OAuth 콜백 API
- 연결 계정 저장 구조
- 토큰 암호화 저장
- Instagram Business 계정 조회
- Instagram Graph API 단일 이미지 게시 코드

남음:

- Meta Developer App 생성
- Redirect URI 등록
- 앱 관리자 설정에 Meta App ID/Secret 입력
- 실제 Instagram 계정 연결 테스트
- 실제 Instagram 게시 테스트

### 3.4 Threads

완료:

- OAuth 준비 구조
- 연결 카드
- Threads 권한 체크 구조

남음:

- Threads 실제 게시 API 구현
- Threads OAuth 실테스트

### 3.5 Kakao

결론:

- 일반 카카오톡 단체방 완전 자동 발송은 1차 범위에서 제외
- 공식 API 기반 자동 발송은 KakaoTalk Channel, Business Message, Alimtalk, Friendtalk 경로로 검토
- 일반 단체방은 `복사하기`, `공유하기`, `발송 알림` 중심의 반자동 UX만 검토

## 4. 전문가 그룹별 판단

### 4.1 PM 판단

현재 프로젝트는 인프라와 핵심 앱 골격이 준비된 상태다. 다음 병목은 코드가 아니라 Meta Developer App 설정과 실제 계정 연결 테스트다.

우선순위:

1. Instagram 실제 연결 완료
2. Instagram 실제 게시 성공
3. Threads 실제 게시 구현
4. Kakao 공식 발송 경로 확정

### 4.2 아키텍트 판단

Cloudflare Pages + Functions + D1 + R2 구조는 현재 MVP에 적합하다.

유지할 원칙:

- API는 공식 플랫폼 API만 사용
- 계정/토큰은 D1에 암호화 저장
- 이미지 URL은 R2 기반으로 제공
- 플랫폼별 Publisher 어댑터 구조 유지

보완 필요:

- 토큰 만료/재연결 처리
- 운영 로그 상세화
- 예약 발행 자동 실행 방식 정리

### 4.3 보안 담당 판단

현재 보안 방향은 타당하다.

유지:

- `TOKEN_ENCRYPTION_KEY`는 Cloudflare Secret으로만 관리
- Meta App Secret과 OAuth token은 암호화 저장
- 관리자 설정은 `ADMIN_SETUP_KEY`로 보호

추가 필요:

- 관리자 설정 키 교체 절차 문서화
- 토큰 재연결 시 기존 토큰 폐기
- 민감값 로그 출력 금지 검증

### 4.4 QA/검증 판단

현재 자동 검증:

- TypeScript typecheck
- Vite build
- Python compile
- API readiness 수동 확인

다음 검증 필요:

- `/api/system/readiness` 정상
- `/api/admin/settings` 정상
- Meta App ID/Secret 저장 테스트
- Instagram OAuth 성공/실패 케이스
- 이미지 업로드 성공/실패 케이스
- Instagram 게시 성공/실패 케이스

### 4.5 마케팅/광고 담당 판단

Instagram/Threads는 콘텐츠 확산 채널로 우선 가치가 있다.

Kakao는 성격이 다르다.

- 단체방: 커뮤니티 공유, 반자동 지원
- 채널/비즈메시지: 공식 발송, 광고/공지/CRM

Kakao는 메시지 목적을 먼저 구분해야 한다.

```text
공지성
광고성
거래/알림성
커뮤니티 공유
```

### 4.6 Kakao 연동 담당 판단

일반 단체방 자동 주기 발송은 공식 경로가 아니므로 제품 기능으로 잡지 않는다.

대안:

- 카카오 공유 버튼
- 메시지 복사 버튼
- 예약 알림
- KakaoTalk Channel 발송
- Alimtalk/Friendtalk 연동

## 5. 확정 결정

### 결정 1. Instagram을 1차 실제 게시 성공 목표로 한다

이유:

- 코드 경로가 가장 많이 구현됨
- 사용자 계정이 Business로 전환됨
- 이미지 게시 요구와 현재 R2 구조가 맞음

### 결정 2. Meta App ID/Secret은 앱 관리자 설정에서 나중에 입력한다

이유:

- 사용자가 Meta App 생성 전에도 앱을 배포/확인 가능
- Cloudflare 콘솔 접근 부담 감소
- Secret은 암호화 저장

### 결정 3. Kakao 일반 단체방 자동 발송은 제외한다

이유:

- 공식 API 부재
- 약관/계정/보안 리스크
- 유지보수 불안정

대신 반자동 공유 UX와 공식 채널 발송을 병행 검토한다.

### 결정 4. 다음 개발은 Threads 실제 게시보다 Instagram 실테스트를 먼저 한다

이유:

- 이미 Instagram 게시 코드가 구현됨
- 실제 토큰/권한/이미지 URL 검증이 먼저 필요
- 이 결과가 Threads/Kakao 구현에도 영향을 줌

## 6. 다음 실행 계획

### Phase 1. Meta App 설정 및 Instagram 연결

담당:

- 사용자: Meta Developer App 생성/승인
- 개발자: 앱 설정 저장, 오류 대응

작업:

1. Meta Developer App 생성
2. 제품/권한에 Instagram Graph API 추가
3. Redirect URI 등록

```text
https://automatic-posting.pages.dev/api/auth/meta/callback
```

4. 앱 관리자 설정에 Meta App ID/Secret 저장
5. Instagram 연결하기 클릭
6. OAuth 승인
7. 앱에서 `연결됨` 상태 확인

완료 기준:

- `/api/social-accounts`에 Instagram 계정 저장
- 앱 계정 카드에 `연결됨` 표시

### Phase 2. Instagram 실제 게시 테스트

작업:

1. 이미지 1장 선택
2. 게시글 본문/해시태그 입력
3. Instagram만 선택
4. 즉시 발행
5. 발행 작업 상태 확인

완료 기준:

- `publish_jobs.status = success`
- `external_post_url` 저장
- 실제 Instagram 계정에서 게시물 확인

실패 시 확인:

- 이미지 URL 접근 가능 여부
- Instagram Business 계정과 Facebook Page 연결 여부
- Meta App 권한
- 토큰 권한
- Instagram Graph API 오류 코드

### Phase 3. Threads 실제 게시 구현

작업:

1. Threads token 저장 흐름 실검증
2. Threads text post API 구현
3. Threads image/link post 확장
4. 실패 로그 정리

완료 기준:

- Threads 텍스트 게시 성공
- Threads 이미지 게시 가능 여부 확인

### Phase 4. Kakao 방향 확정

작업:

1. Kakao 사용 목적 분류

```text
일반 단체방 공유
채널 공지
광고성 메시지
알림성 메시지
```

2. 일반 단체방은 반자동 공유 UX 설계
3. 자동 발송은 Kakao Channel/Business Message로 별도 설계

완료 기준:

- Kakao 공식 발송 방식 1개 확정
- API 제공사/심사/템플릿 필요 여부 정리

### Phase 5. 운영 안정화

작업:

- 토큰 만료 감지
- 재연결 버튼
- 발행 로그 상세화
- 예약 발행 자동 실행
- 관리자 설정 백업/복구 절차
- 에러 메시지 한글화

## 7. 현재 남은 사용자 액션

필수:

1. Meta Developer App 생성
2. Instagram Graph API 권한 확인
3. Redirect URI 등록
4. Meta App ID/Secret 확인
5. 앱 관리자 설정에 값 입력
6. Instagram OAuth 승인

후순위:

1. Threads API 권한 확인
2. Kakao 발송 목적 결정
3. Kakao 공식 채널/비즈메시지 사용 여부 결정

## 8. 현재 남은 개발 액션

필수:

1. Meta 설정 입력 후 연결 오류 대응
2. Instagram 게시 실테스트 오류 대응
3. 게시 결과 UI 개선

후순위:

1. Threads 실제 Publisher 구현
2. Kakao 반자동 공유 UX 구현
3. Kakao 공식 발송 API 조사 및 연동
4. 예약 실행 자동화 고도화

## 9. 최종 PM 결론

현재 프로젝트는 기획 단계가 아니라 실제 배포된 MVP 상태다.

지금 가장 중요한 다음 목표는 `Instagram 실제 게시 1건 성공`이다.

그 다음에 Threads 실제 게시, Kakao 방향 확정, 예약/운영 안정화를 순서대로 진행한다.

Kakao 일반 단체방 완전 자동 발송은 공식 API/정책 리스크 때문에 제외하고, 반자동 공유 또는 공식 채널/비즈메시지로 대체한다.
