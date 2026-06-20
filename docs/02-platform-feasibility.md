# 플랫폼별 가능성 검토

## 1. 핵심 원칙

공식 API와 플랫폼 정책을 기준으로 구현한다. 브라우저 자동화, PC 앱 화면 조작, 비공식 API 호출은 계정 제재, 서비스 차단, 법적 위험이 크므로 MVP 범위에서 제외한다.

## 2. Kakao

### 2.1 리스크

KakaoTalk 일반 개인 채팅방 또는 단체 채팅방에 임의 자동 발송하는 기능은 공식적으로 제한될 가능성이 높다. 특히 광고성 메시지나 대량 발송은 수신 동의, 광고 표기, 수신 거부, 야간 발송 제한 등 별도 규제를 받는다.

### 2.2 권장 대안

- KakaoTalk Channel 메시지
- Kakao Business Message
- Alimtalk
- Friendtalk
- KakaoWork, 내부 운영 채널

### 2.3 확인 항목

- 발송하려는 대상이 친구/구독자/고객인지
- 광고성 메시지 여부
- 수신 동의 확보 방식
- 수신 거부 처리 방식
- 이미지 포함 가능 여부
- API 심사와 비용
- 메시지 템플릿 사전 승인 필요 여부

## 3. Instagram

### 3.1 전제

Instagram 자동 게시는 운영자 Instagram Business 계정과 Meta Graph API를 사용하는 방향으로 설계한다.

### 3.2 확인 항목

- Instagram Business/Creator 계정 준비
- Facebook Page 연결 필요 여부
- Meta App 생성과 권한 심사
- 이미지 게시 지원 범위
- 캐러셀, 릴스, 스토리 지원 범위
- 게시물 생성 후 publish 단계 처리
- API 호출 제한

## 4. Threads

### 4.1 전제

Threads 공식 API 사용 가능 범위와 권한 정책을 확인한다.

### 4.2 확인 항목

- 텍스트 게시 지원
- 이미지 첨부 지원
- API 권한 심사
- 계정 인증 방식
- API 호출 제한
- 상업적 사용 정책

## 5. PoC 우선순위

1. Instagram Graph API 게시 PoC
2. Threads API 게시 PoC
3. Kakao 공식 발송 방식 확정
4. Kakao 발송 PoC
5. 예약 발행과 실패 재시도 통합

## 6. 정책상 금지할 구현

- KakaoTalk PC 앱 화면 자동 조작
- 모바일 앱 UI 자동 조작 기반 발송
- 비공식 API 호출
- 사용자의 명시 동의 없는 광고성 메시지 발송
- 플랫폼 API 제한 우회

## 7. 1차 검증 범위

초기 PoC는 운영자 본인이 소유하거나 운영 권한을 가진 계정만 대상으로 한다. 외부 고객 계정 대행 운영, 다수 고객 계정 연결, SaaS형 재판매는 후순위로 분리한다.

PoC 우선순위:

1. 운영자 본인 계정 기준 Instagram Graph API 게시 PoC
2. 운영자 본인 계정 기준 Threads API 게시 PoC
3. Kakao 공식 발송 방식 확정
4. 운영자 본인 채널 기준 Kakao 발송 PoC
5. 예약 발행과 실패 재시도 통합
