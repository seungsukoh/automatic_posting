# Automatic Posting

텍스트와 이미지를 한 번 작성해 Instagram, Threads, Kakao 계열 채널에 발행하는 자동 포스팅 시스템입니다.

이 프로젝트의 1차 목표는 공식 API와 정책을 준수하는 MVP를 만드는 것입니다. 특히 KakaoTalk 일반 개인/단체 채팅방 자동 발송은 공식 API로 허용되지 않을 가능성이 높으므로, KakaoTalk Channel, Kakao Business Message, Alimtalk/Friendtalk 같은 공식 발송 경로를 우선 검토합니다.

## 현재 산출물

- `docs/01-prd.md`: 제품 요구사항 정의서
- `docs/02-platform-feasibility.md`: 플랫폼별 API/정책 검토
- `docs/03-architecture.md`: 권장 시스템 아키텍처
- `docs/04-data-model.md`: 핵심 데이터 모델
- `docs/05-mvp-backlog.md`: MVP 개발 백로그
- `docs/06-test-strategy.md`: 검증 전략
- `docs/07-risk-register.md`: 주요 리스크와 대응책
- `docs/08-team-and-operating-model.md`: 전문가 그룹과 운영 방식
- `docs/09-login-and-automation-boundary.md`: 로그인/OAuth 기반 자동화 가능 범위
- `docs/10-project-execution-plan.md`: PM 관점 프로젝트 실행 계획
- `docs/11-account-readiness-checklist.md`: Instagram Creator 전환과 플랫폼 계정 준비 체크리스트
- `app/`: Python 표준 라이브러리 기반 로컬 MVP 앱
- `cloudflare/`: TypeScript + Cloudflare Workers/Pages/D1/R2 기반 운영형 MVP 뼈대

## 로컬 MVP 실행

```powershell
python app/server.py
```

브라우저에서 `http://127.0.0.1:8000`을 엽니다.

기본 SQLite 파일은 `data/automaticposting.db`입니다. 개발 중 DB 파일을 분리하려면 다음처럼 실행합니다.

```powershell
$env:AUTOMATICPOSTING_DB="data/dev.db"
python app/server.py
```

현재 앱은 실제 SNS API 호출 전 단계의 mock 발행 흐름입니다. Instagram/Threads는 성공 mock 결과를 만들고, Kakao는 공식 발송 방식이 설정되지 않았다는 실패 결과를 남깁니다.

## MATLAB Toolbox 판단

핵심 자동 포스팅 엔진에는 MATLAB이 필수는 아닙니다. OAuth, API 연동, 예약 발행, 감사 로그, 운영 UI는 Python/웹 스택이 더 직접적입니다.

MATLAB은 후속 단계에서 이미지 전처리, 콘텐츠 성과 분석, 리포트 자동 생성, 통계 모델링이 필요할 때 보조 도구로 검토하는 것이 적절합니다. 예를 들어 Image Processing Toolbox, Computer Vision Toolbox, Statistics and Machine Learning Toolbox, Database Toolbox, Report Generator 계열은 분석/리포팅 영역에서 도움이 될 수 있습니다.

## 권장 MVP

1. 사용자 로그인과 조직 단위 계정 관리
2. 게시글 작성, 이미지 1장 첨부, 플랫폼별 문구 수정
3. Instagram Graph API 기반 게시
4. Threads API 기반 게시
5. Kakao는 공식 API 가능 범위 확인 후 KakaoTalk Channel 또는 Business Message로 제한
6. 즉시 발행, 예약 발행, 실패 재시도
7. 발행 결과와 감사 로그 저장

## 개발 전 필수 결정

- Kakao 대상이 일반 채팅방인지, KakaoTalk Channel/Business Message인지
- Instagram 계정을 Business 또는 Creator 계정으로 운영 가능한지
- Threads 공식 API 사용 권한 확보 가능 여부
- 광고성 메시지 발송 여부와 수신 동의 관리 방식

## 자동화 경계

로그인을 통해 가능한 자동화는 공식 OAuth와 API 권한 범위 안에서만 추진합니다. 브라우저나 PC 앱에 로그인된 화면을 자동 조작하는 방식은 계정 제재, 약관 위반, 보안 사고 가능성이 커서 MVP 범위에서 제외합니다.

## 1차 제품 범위

초기 버전은 외부 고객용 SaaS가 아니라, 운영자 본인이 소유하거나 운영 권한을 가진 계정만 연결하는 내부용 자동 포스팅 도구로 진행합니다.

- 운영자 본인의 Instagram/Threads/Kakao 공식 계정만 연결
- 타인 계정 대행 운영 기능 제외
- 고객용 SaaS, 결제, 멀티테넌트 과금 제외
- 팀 승인 워크플로우는 후순위
- 공식 OAuth/API 기반 게시만 지원
