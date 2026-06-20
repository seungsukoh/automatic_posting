# 계정 준비 체크리스트

## 1. 결정된 전제

Instagram은 Business 계정으로 전환된 상태를 기준으로 진행한다.

이 프로젝트는 로그인 세션 자동조작이 아니라 공식 OAuth/API 기반 자동 포스팅 도구로 구현한다.

## 2. Instagram Business 준비

필수 확인:

- Instagram 계정이 Business 계정으로 전환되어 있다.
- Facebook Page를 생성하거나 기존 Page를 연결할 수 있다.
- Instagram Business 계정과 Facebook Page를 Meta 계정 센터 또는 Meta Business Suite에서 연결할 수 있다.
- Meta for Developers에서 앱을 만들 수 있다.
- Instagram Graph API 관련 권한을 요청할 수 있다.
- 테스트 게시에 사용할 이미지와 문구를 준비한다.

초기 PoC 성공 기준:

- OAuth로 계정 권한을 받을 수 있다.
- 연결된 Instagram 계정 ID를 조회할 수 있다.
- 이미지 1장과 본문으로 테스트 게시를 생성할 수 있다.
- 발행 결과로 게시 ID 또는 URL을 저장할 수 있다.

## 3. Threads 준비

필수 확인:

- Meta for Developers 앱에서 Threads API를 사용할 수 있다.
- `threads_basic` 권한을 확인한다.
- `threads_content_publish` 권한을 확인한다.
- OAuth 또는 Access Token 테스트로 Threads 계정 ID와 username을 조회할 수 있다.

초기 PoC 성공 기준:

- Threads 계정 정보를 조회할 수 있다.
- 텍스트 게시를 발행할 수 있다.
- 이미지 첨부 게시 가능 여부를 확인하고 문서화한다.

## 4. Kakao 준비

현재 전제:

- 일반 카카오톡 개인/단체 채팅방 자동 발송은 MVP에서 제외한다.
- KakaoTalk Channel, Business Message, Alimtalk, Friendtalk 중 공식 발송 경로를 선택한다.

필수 확인:

- 발송 대상이 친구, 구독자, 고객 중 무엇인지 정의한다.
- 광고성 메시지 여부를 정한다.
- 수신 동의와 수신 거부 처리 방식이 필요한지 확인한다.
- 메시지 템플릿 사전 승인 또는 계약이 필요한지 확인한다.
- 이미지 첨부 가능 여부와 비용을 확인한다.

## 5. 다음 개발 액션

1. Instagram Business 계정과 Facebook Page 연결을 완료한다.
2. Meta Developer 앱을 생성한다.
3. Threads 권한이 보이는지 확인한다.
4. 로컬 MVP의 mock Publisher를 실제 API Publisher로 하나씩 교체한다.
5. 가장 먼저 Instagram 게시 PoC를 구현한다.
