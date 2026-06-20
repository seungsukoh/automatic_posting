# 데이터 모델 초안

## 1. Organization

조직 또는 고객사를 나타낸다.

- id
- name
- plan
- created_at
- updated_at

## 2. User

시스템 사용자를 나타낸다.

- id
- organization_id
- email
- name
- role
- status
- created_at
- updated_at

## 3. SocialAccount

연동된 외부 플랫폼 계정이다.

- id
- organization_id
- platform
- display_name
- external_account_id
- access_token_encrypted
- refresh_token_encrypted
- token_expires_at
- scopes
- status
- created_at
- updated_at

## 4. Post

게시글의 원본 콘텐츠다.

- id
- organization_id
- author_user_id
- title
- body
- link_url
- status
- created_at
- updated_at

## 5. PostAsset

게시글에 첨부된 이미지 또는 파일이다.

- id
- post_id
- file_url
- file_type
- file_size
- width
- height
- sort_order
- alt_text
- created_at

## 6. PostTarget

플랫폼별 게시 설정과 변형 콘텐츠다.

- id
- post_id
- social_account_id
- platform
- body_override
- hashtags
- status
- validation_errors
- created_at
- updated_at

## 7. PublishJob

발행 작업이다.

- id
- post_target_id
- scheduled_at
- started_at
- finished_at
- status
- retry_count
- next_retry_at
- created_by_user_id
- created_at
- updated_at

## 8. PublishResult

플랫폼 API 호출 결과다.

- id
- publish_job_id
- platform
- status
- external_post_id
- external_post_url
- error_code
- error_message
- raw_response_summary
- created_at

## 9. Campaign

마케팅 캠페인 단위로 게시글을 묶는다.

- id
- organization_id
- name
- start_at
- end_at
- created_at
- updated_at

## 10. Template

자주 쓰는 문구나 해시태그 세트다.

- id
- organization_id
- name
- body
- hashtags
- created_at
- updated_at

## 11. AuditLog

감사 로그다.

- id
- organization_id
- actor_user_id
- action
- target_type
- target_id
- metadata
- created_at

