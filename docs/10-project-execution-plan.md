# 프로젝트 실행 계획

## 1. 프로젝트 방향성

본 프로젝트는 외부 고객용 SaaS나 대행사용 대량 계정 운영 도구가 아니라, 운영자 본인이 소유하거나 명확한 운영 권한을 가진 계정만 연결하는 내부용 자동 포스팅 도구로 시작한다.

1차 목표는 하나의 작성 화면에서 텍스트와 이미지를 작성하고, Instagram, Threads, Kakao 공식 채널 계열에 즉시 또는 예약 발행하는 MVP를 구현하는 것이다.

핵심 원칙:

- 공식 OAuth/API 기반 자동화만 지원한다.
- 플랫폼 비밀번호와 로그인 세션 쿠키를 저장하지 않는다.
- 로그인된 브라우저나 PC 앱 화면 조작 방식은 MVP에서 제외한다.
- 운영자 본인 계정 전용으로 범위를 제한한다.
- Kakao는 일반 개인/단체 채팅방 자동 발송이 아니라 공식 채널/비즈메시지 계열로 검증한다.
- Instagram은 운영자 개인계정을 Creator 계정으로 전환하는 전제로 진행한다.

## 2. 전문가 그룹 합의 사항

### PM/PO 관점

- MVP 범위를 작게 유지한다.
- 가장 먼저 Instagram OAuth/API 게시 가능성을 검증한다.
- Kakao 일반 채팅방 자동화는 제품화 대상에서 제외하고 공식 발송 방식으로 전환한다.
- 외부 고객용 SaaS 요구사항은 2차 이후로 분리한다.

### SW 아키텍트 관점

- 플랫폼별 발행 로직은 Adapter 구조로 분리한다.
- 예약 발행과 즉시 발행은 Queue/Worker 기반으로 처리한다.
- 발행 성공/실패는 플랫폼별로 독립 저장한다.
- 실패한 플랫폼만 재시도할 수 있게 설계한다.

### 백엔드 개발 관점

- 사용자/계정/게시글/발행 작업/결과 로그 모델을 우선 구현한다.
- OAuth 토큰은 암호화 저장한다.
- 외부 API 오류는 내부 표준 오류 코드로 정규화한다.
- 실제 API 연동 전 Mock Adapter로 발행 엔진을 검증한다.

### 프론트엔드/UX 관점

- 첫 화면은 게시 작성 화면으로 한다.
- 플랫폼 선택, 플랫폼별 미리보기, 즉시 발행, 예약 발행을 한 흐름에서 처리한다.
- 실패 사유와 재시도 버튼을 명확하게 보여준다.
- 본인 운영 계정 전용 도구임을 계정 연결 화면에 명시한다.

### QA/검증 관점

- 예약 발행 중복 실행 방지를 핵심 테스트로 둔다.
- OAuth 만료, API rate limit, 이미지 규격 오류, 부분 실패를 필수 시나리오로 검증한다.
- 실제 플랫폼 API 테스트는 별도 테스트 계정으로 제한 수행한다.

### 법무/정책 관점

- 운영자 본인 계정 전용이라도 플랫폼 약관은 준수해야 한다.
- Kakao 메시지가 고객에게 발송되는 경우 광고성 메시지, 수신 동의, 수신 거부, 야간 발송 제한을 검토한다.
- 외부 고객 계정 위임 기능을 넣는 순간 개인정보/계약/보안 요구사항이 크게 증가한다.

## 3. MVP 범위

### 포함

- 운영자 로그인
- 운영자 본인 Instagram 계정 OAuth 연결
- 운영자 본인 Threads 계정 OAuth/API 연결
- Kakao 공식 발송 방식 검증
- 게시글 작성
- 이미지 1장 첨부
- 플랫폼별 문구 수정
- 즉시 발행
- 예약 발행
- 발행 결과 저장
- 실패 사유 표시
- 실패 플랫폼 재시도
- 감사 로그

### 제외

- 외부 고객용 SaaS
- 타인 계정 대행 운영
- 다수 고객 계정 관리
- 결제/과금
- 고급 권한/승인 워크플로우
- AI 문구 생성
- 댓글/DM 관리
- 브라우저/PC 앱 화면 조작 자동화
- 플랫폼 비밀번호 저장
- 로그인 세션 쿠키 저장

## 4. 구현 전략

## 4.1 전체 구조

```text
Web App
  -> Backend API
  -> PostgreSQL
  -> Redis Queue
  -> Worker
  -> Platform Adapter
  -> Instagram / Threads / Kakao APIs
```

## 4.2 핵심 모듈

- Auth Module: 운영자 로그인, 세션 관리
- Social Account Module: OAuth 연결, 토큰 저장, 계정 상태 관리
- Content Module: 게시글, 이미지, 플랫폼별 문구 관리
- Publish Module: 즉시/예약 발행 작업 생성
- Worker Module: 큐 작업 실행, 재시도
- Platform Adapter Module: Instagram, Threads, Kakao API 연동
- Audit Module: 사용자 작업과 발행 로그 기록

## 4.3 데이터 모델

우선 구현할 핵심 테이블:

- User
- SocialAccount
- Post
- PostAsset
- PostTarget
- PublishJob
- PublishResult
- AuditLog

초기 버전은 Organization을 단순화하거나 단일 운영자 기준으로 구현할 수 있다. 향후 팀 기능이 필요해지면 Organization과 Role을 확장한다.

## 5. 단계별 실행 계획

### Phase 0. 정책/계정 준비

목표:

- 공식 API 기반으로 가능한 범위를 확정한다.
- 운영자 본인 계정 기준 테스트 환경을 준비한다.

작업:

- Instagram Business 또는 Creator 계정 준비
- Meta App 생성
- Instagram Graph API 권한 확인
- Threads API 사용 가능 범위 확인
- Kakao Channel/Business Message/Alimtalk/Friendtalk 중 후보 결정
- 광고성 메시지 여부 확인

완료 기준:

- Instagram OAuth PoC 가능 상태 확보
- Threads API 검증 방법 확보
- Kakao 공식 발송 방식 후보 1~2개로 축소

### Phase 1. 프로젝트 기반 구현

목표:

- 로컬 개발 환경과 기본 앱 구조를 만든다.

작업:

- Backend API 프로젝트 생성
- Frontend 프로젝트 생성
- PostgreSQL 연결
- Redis 연결
- 환경변수 구조 정리
- 기본 로그인 구현
- 헬스체크 API 구현

완료 기준:

- 로컬에서 Web/API/DB/Queue가 실행된다.
- 운영자 로그인이 가능하다.

### Phase 2. 게시글 작성 기능

목표:

- 사용자가 게시글과 이미지를 저장하고 플랫폼별 문구를 조정할 수 있다.

작업:

- 게시글 CRUD API
- 이미지 업로드
- 플랫폼별 PostTarget 생성
- 게시 작성 UI
- 플랫폼별 미리보기
- 본인 운영 계정 전용 안내 표시

완료 기준:

- 게시글 원본과 플랫폼별 문구가 저장된다.
- 이미지 1장이 첨부된다.
- 미리보기가 동작한다.

### Phase 3. 발행 엔진 구현

목표:

- 실제 플랫폼 연동 전 Mock Adapter로 발행 흐름을 완성한다.

작업:

- PublishJob 생성
- 즉시 발행 큐 처리
- 예약 발행 큐 처리
- Worker 실행
- PublishResult 저장
- 실패 재시도
- 부분 실패 처리

완료 기준:

- Mock Adapter 기준 즉시/예약/실패/재시도 시나리오가 통과한다.

### Phase 4. Instagram 연동 PoC

목표:

- 운영자 본인 Instagram 계정에 실제 테스트 게시를 성공시킨다.

작업:

- Meta OAuth 연결
- SocialAccount 저장
- 토큰 암호화 저장
- Instagram media container 생성
- Instagram publish 호출
- 게시 URL 또는 게시 ID 저장

완료 기준:

- 테스트 이미지와 문구가 Instagram 계정에 게시된다.
- 실패 시 오류 코드와 원인이 저장된다.

### Phase 5. Threads 연동 PoC

목표:

- Threads 공식 API로 가능한 게시 범위를 확인하고 연동한다.

작업:

- Threads 인증 방식 확인
- Threads 계정 연결
- 텍스트 게시 PoC
- 이미지 첨부 게시 PoC
- API 제한 오류 처리

완료 기준:

- Threads에 최소 텍스트 게시가 성공한다.
- 이미지 지원 여부가 명확히 문서화된다.

### Phase 6. Kakao 공식 발송 PoC

목표:

- 일반 채팅방이 아닌 공식 경로로 Kakao 발송 가능성을 검증한다.

작업:

- KakaoTalk Channel 또는 Business Message 방식 확정
- 발송 대상과 메시지 유형 정의
- 광고성 메시지 여부 검토
- API/계약/템플릿 승인 필요 여부 확인
- 테스트 발송

완료 기준:

- Kakao 공식 경로로 발송 가능 여부가 확정된다.
- 불가능하거나 비용/심사 부담이 크면 Kakao는 MVP에서 보류한다.

### Phase 7. 관리자/운영 기능

목표:

- 운영자가 발행 상태를 확인하고 실패를 처리할 수 있다.

작업:

- 계정 연결 상태 화면
- 발행 이력 화면
- 실패 사유 표시
- 실패 플랫폼 재시도 버튼
- 감사 로그 조회

완료 기준:

- 운영자가 실패 원인을 확인하고 재시도할 수 있다.

### Phase 8. QA와 릴리스 준비

목표:

- 내부 운영에 사용할 수 있는 MVP 품질을 확보한다.

작업:

- 단위 테스트
- Worker 통합 테스트
- 예약 발행 중복 실행 테스트
- OAuth 만료 테스트
- API rate limit 테스트
- 민감 정보 로그 미출력 확인
- 배포 환경 구성

완료 기준:

- 내부 운영자 기준 MVP 릴리스 가능

## 6. 우선순위

1순위:

- 운영자 로그인
- 게시글 작성
- Mock 발행 엔진
- Instagram OAuth/게시 PoC

2순위:

- 예약 발행
- 실패 재시도
- Threads PoC
- 발행 이력 화면

3순위:

- Kakao 공식 발송 PoC
- 이미지 규격 자동 보정
- 감사 로그 고도화

후순위:

- 팀 승인
- 여러 이미지
- 캠페인 관리
- AI 문구 생성
- 성과 분석
- SaaS 전환

## 7. 주요 의사결정 항목

즉시 결정 필요:

- Instagram 계정이 Business/Creator인지
- Meta App을 새로 만들 것인지 기존 앱을 쓸 것인지
- Threads 계정과 Instagram 계정이 같은 Meta 생태계로 연결되어 있는지
- Kakao는 Channel, Business Message, Alimtalk, Friendtalk 중 무엇을 우선 검토할지
- 광고성 메시지를 보낼 예정인지

개발 중 결정:

- 백엔드 기술 스택
- 프론트엔드 기술 스택
- 파일 저장 위치
- 배포 환경
- 예약 발행 허용 오차

2차 이후 결정:

- 팀 사용자 기능
- 승인 워크플로우
- 여러 계정 관리
- SaaS 전환 여부
- 과금 모델

## 8. 일정 초안

실제 API 권한과 심사 상황에 따라 달라질 수 있으나, 내부용 MVP 기준 초안은 다음과 같다.

- 1주차: Phase 0, 계정/API 준비, 기술 스택 확정
- 2주차: Phase 1, 프로젝트 기반과 로그인
- 3주차: Phase 2, 게시글 작성과 미리보기
- 4주차: Phase 3, Mock 발행 엔진과 예약/재시도
- 5주차: Phase 4, Instagram OAuth/게시 PoC
- 6주차: Phase 5, Threads PoC
- 7주차: Phase 6, Kakao 공식 발송 PoC
- 8주차: Phase 7~8, 운영 화면, QA, 내부 릴리스 준비

권장 방식은 8주 전체를 고정 범위로 잡는 것이 아니라, 4주차까지 내부 발행 엔진을 만들고 5주차부터 플랫폼별 API 성공 여부에 따라 범위를 조정하는 것이다.

## 9. 성공 기준

MVP 성공 기준:

- 운영자가 로그인할 수 있다.
- 본인 운영 계정을 OAuth/API로 연결할 수 있다.
- 게시글과 이미지 1장을 작성할 수 있다.
- Instagram에 실제 게시가 가능하다.
- 예약 발행과 즉시 발행이 동작한다.
- 실패 사유가 저장되고 재시도할 수 있다.
- 플랫폼 비밀번호나 세션 쿠키를 저장하지 않는다.
- 화면 조작 자동화 없이 공식 API만 사용한다.

확장 성공 기준:

- Threads 게시 가능
- Kakao 공식 발송 가능
- 내부 운영자가 반복 사용 가능한 수준의 UI/로그/장애 대응 확보

## 10. 다음 액션

가장 먼저 실행할 작업:

1. Instagram Business 또는 Creator 계정 여부 확인
2. Meta Developer App 생성
3. Instagram Graph API 권한 확인
4. 백엔드/프론트엔드 기술 스택 확정
5. OAuth PoC용 최소 앱 구현

이 다섯 가지가 확인되면 실제 개발 착수 리스크가 크게 줄어든다.
