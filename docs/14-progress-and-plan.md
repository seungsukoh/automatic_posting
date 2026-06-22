# Progress and Plan

Last updated: 2026-06-23 01:07 KST

## Current Status

- Production app: `https://automatic-posting.pages.dev`
- Cloudflare Pages project: `automatic-posting`
- Instagram OAuth start endpoint is responding with a Facebook OAuth redirect.
- Meta OAuth readiness is configured in production.
- Current Instagram account record exists for `careerengineeringlab`, but its status is `disconnected`; the user must complete the Facebook approval flow again.
- R2 is not enabled on the current Cloudflare account, so media storage now uses `MEDIA_KV`.
- PNG upload and public media URL serving were verified in production.
- Admin setup key has been rotated in Cloudflare Pages Secret and was not printed in chat.
- User-reported product issues are now the active priority: weak layout/design, poor UX/UI, no actual posting, Instagram reconnect failure, and confusion after admin key rotation.
- Meta OAuth/Graph endpoints were updated from v21.0 to v25.0 and deployed.
- Immediate publish diagnostic reached the Instagram publisher path. With a JPG image, the current failure is `Instagram account is not connected.`
- Facebook Login for Business `config_id` support was added and deployed. Current production settings do not yet have a config ID, so OAuth URLs do not include `config_id` yet.

## Active Issues

- Instagram reconnect flow reaches Facebook, but Facebook shows: "사용할 수 없는 기능 현재 이 앱에서 Facebook 로그인을 사용할 수 없습니다."
- No OAuth callback has been observed in audit logs after the user's attempts.
- Product UI still needs stronger PM/design cleanup so the normal user path is separated from admin setup.
- Admin setup guidance must not expose real App IDs, secrets, or setup keys.
- README and docs need cleanup where old assumptions mention R2 as the active storage.
- The app has not yet proven the end-to-end production path because Instagram is disconnected: reconnect Instagram, upload image, publish immediately, create scheduled job, and publish successfully.
- Admin key rotation did not directly change Instagram OAuth, but it created operational confusion because the key was not preserved for later admin edits.

## Next Plan

1. Stabilize Instagram OAuth first; production now emits v25.0 OAuth URLs.
2. Add the Facebook Login for Business Configuration ID to admin settings if Meta requires it; this will append `config_id` to the OAuth URL.
3. Resolve Facebook-side "사용할 수 없는 기능" block so the callback reaches `/api/auth/meta/callback`.
4. Once Instagram is connected, run a real image upload and immediate Instagram publish test.
5. Redesign the product surface around the core user flow: connect/reconnect account, choose channel, upload folder, create schedule, monitor result.
6. Hide admin setup from the normal operating path and expose it only through an explicit admin entry.
7. Replace admin-key memory burden with a documented reset process and later Cloudflare Access or account-based admin auth.
8. Update docs after each significant change, and during active work at least every 10 minutes.

## Update Rule

- During active implementation/debugging, update this document every 10 minutes or at each material state change.
- If the work stops or the session ends, no background updates run automatically.
- Each update should include current status, blocker if any, and the next concrete action.
