# Progress and Plan

Last updated: 2026-06-23 02:08 KST

## Current Status

- Production app: `https://automatic-posting.pages.dev`
- Cloudflare Pages project: `automatic-posting`
- Instagram OAuth start endpoint is responding with a Facebook OAuth redirect.
- Meta OAuth readiness is configured in production.
- Instagram account connection is confirmed working for the current workspace.
- R2 is not enabled on the current Cloudflare account, so media storage now uses `MEDIA_KV`.
- PNG upload and public media URL serving were verified in production.
- Admin setup key is an operator-only concern and should not appear in the normal posting flow.
- User-reported product issues are now the active priority: weak layout/design, poor UX/UI, no actual posting, Instagram reconnect failure, and confusion after admin key rotation.
- Meta OAuth/Graph endpoints were updated from v21.0 to v25.0 and deployed.
- Immediate publish diagnostic reached the Instagram publisher path. With a JPG image, the current failure is `Instagram account is not connected.`
- Facebook Login for Business `config_id` support was added and deployed. Current production settings do not yet have a config ID, so OAuth URLs do not include `config_id` yet.
- Admin setup key was rotated again during troubleshooting. The preferred operating model is that the user should not need to enter it during normal connection/posting work; direct backend configuration or a future admin-auth flow should handle rare settings changes.
- Alternate Instagram OAuth mode was added and deployed: `/api/auth/meta/start?platform=instagram&variant=basic`. This omits `auth_type=rerequest` and is exposed as "대체 연결 시도" in the connection card.
- User tested both the default reconnect and alternate reconnect paths; both still show the same Facebook "사용할 수 없는 기능" block before callback.
- User cannot save admin settings because the form still requires `ADMIN_SETUP_KEY`, and the rotated key was not preserved in a user-accessible place.
- Instagram reconnect is now confirmed working.
- Publishing is now confirmed working by the user.
- Normal user UI cleanup started: admin settings entry points are being hidden from the main product surface.
- Text-only authoring is being converted into an Instagram-compatible generated JPG image when no image is selected.
- General users should only need to approve their Instagram account and create posts; Meta App ID, App Secret, and admin setup key are workspace/operator setup.
- A future manual should include "new user account connection" steps: open the app, click Instagram connection, approve the Facebook/Instagram Business account, then verify the connected username.
- Admin settings UI and admin-key form handling have been removed from the normal static HTML/JS bundle.
- User manual `docs/15-user-manual.md` has been added for account connection, immediate posting, scheduled posting, and operator escalation.
- Final UI cleanup was built and deployed to production.
- Production now serves `/assets/index-DtpJ1hjr.js`; production HTML/JS verification found no normal-bundle admin settings/admin-key strings.
- Production `/api/social-accounts` still reports Instagram `careerengineeringlab` as connected.
- Exposed admin setup key was rotated in Cloudflare Pages Secret and production was redeployed after rotation.
- Production `/api/admin/settings` still reports all required configured flags without returning raw secret values.

## Active Issues

- Product UI still needs stronger PM/design cleanup so the normal user path is separated from admin setup.
- Admin setup guidance must not expose real App IDs, secrets, or setup keys.
- README and docs need cleanup where old assumptions mention R2 as the active storage.
- End-to-end connection and publishing are now confirmed, but the product surface still needs UX cleanup.
- Admin key rotation did not directly change Instagram OAuth, but it created operational confusion because the key was not preserved for later admin edits.
- Admin-key UX is a product issue: it should not block normal Instagram reconnect or posting.
- Immediate blocker for admin settings has been moved out of the normal UI; future rare changes should use Cloudflare/operator setup or real admin auth.

## Next Plan

1. Do a browser-level UX pass on the production app after the deployed cleanup.
2. Continue redesign around the core flow: connect/reconnect account, choose channel, write post or upload folder, create schedule, monitor result.
3. Add a single-post pre-submit confirmation summary if the current flow still feels risky.
4. Improve job detail failure display.
5. Keep admin settings as operator-managed Cloudflare/D1 configuration for now.
6. Later replace the admin-key memory burden with Cloudflare Access or account-based admin auth.

## Update Rule

- During active implementation/debugging, update this document every 10 minutes or at each material state change.
- If the work stops or the session ends, no background updates run automatically.
- Each update should include current status, blocker if any, and the next concrete action.
