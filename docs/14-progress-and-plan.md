# Progress and Plan

Last updated: 2026-06-23 KST

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
- UX issue reopened: the normal posting screen still mixed user posting flow with admin/operator readiness concepts.
- Main app layout was reworked into a user-only posting flow: Instagram account connection, writing, date-folder scheduling, and job monitoring.
- Admin/operator/system readiness panels, summary blocks, hidden admin styles, and normal-bundle admin wording were removed from the public app surface.
- User-only layout cleanup was deployed to production. Production now serves `/assets/index-O8GS0dtt.js` and `/assets/index-D15iZJHN.css`.
- Production bundle verification found no admin/operator/system-mode strings in the public app assets.
- Korean text corruption was found in the public app JavaScript bundle and repaired at source.
- Single-post submission now shows a confirmation summary before creating the publish job.
- Failed jobs now expose an expandable failure detail block instead of only a cramped inline message.
- PM/design review reopened: panel sizing, button placement, visible progress indicators, and empty channel states were still not strong enough.
- Added a sticky four-step flow rail, clearer step panel markers, top quick navigation, better connected-account emphasis, clearer empty channel notice, and stronger spacing/box sizing for compose/schedule/job areas.
- Threads was restored as a first-class connection and text-only posting channel.
- Threads publisher was changed from mock success to the official Threads container + publish API flow.
- Text-only single posts can use Threads without generating an Instagram text image; Instagram still generates/uses JPG when selected.
- Date-folder scheduling now rejects the whole folder selection when any file is outside the required date-folder/image/caption rules, and shows correction guidance instead of partially accepting valid files.
- The public app now allows Instagram and Threads to be selected together.
- The API no longer rejects multi-platform post creation; one post can create platform-specific publish jobs.
- Compose UX was tightened: campaign tracking is collapsed by default, media and preview are grouped, and platform status labels are consistent.
- Root Pages Functions route imports `cloudflare/src/index`, so server changes in that module affect the production Pages API.
- Root README and current system guide were updated to match the current Instagram + Threads product state.

## Active Issues

- Production deployment must be checked after each push because old assets can remain visible until Cloudflare Pages finishes deployment or browser cache clears.
- Live Threads publishing still needs verification with the connected Threads account.
- Multi-platform post creation should be verified in production by confirming separate Instagram and Threads jobs in `작업 현황`.
- Failure UX should be improved further after collecting real Meta API errors from live posting.
- Future rare settings changes should use Cloudflare/operator tooling or real admin auth, not normal posting flow prompts.

## Next Plan

1. Confirm latest commit is deployed to `https://automatic-posting.pages.dev`.
2. Create one single post with Instagram and Threads both selected.
3. Verify `작업 현황` shows separate platform jobs and captures any Meta API failure details.
4. Test media cases: no media, valid image, Instagram ratio adjustment, short video, long video.
5. Improve retry/failure UX based on live error messages.

## Update Rule

- During active implementation/debugging, update this document every 10 minutes or at each material state change.
- If the work stops or the session ends, no background updates run automatically.
- Each update should include current status, blocker if any, and the next concrete action.
