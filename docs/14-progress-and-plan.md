# Progress and Plan

Last updated: 2026-06-28 KST

## Current Status

- Production app: `https://automatic-posting.pages.dev`
- Latest implementation commit before this PM update: `7ca9caa Align scheduler layout and add user guide`
- Local dev server was responding at `http://127.0.0.1:5180/` during the latest verification.
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

## 2026-06-28 PM Handoff

Recent user requests focused on finishing the posting UI as a usable Instagram/Threads publishing workspace, aligning it with the supplied brand system, and documenting usage for future users.

### Completed Product Changes

- Workspace tabs are now organized around `게시물 작성 및 게시`, `예약 게시`, `계정 연결`, and `작업 현황`.
- `게시물 작성 및 게시` and `예약 게시` use the same main horizontal layout pattern: left-side input/editor column and right-side preview column.
- The latest layout adjustment aligned the internal `예약 게시` channel/copy grid ratio with the single-post compose grid.
- `작성내용 초기화` is placed in the top action area of the single-post section.
- `예약내용 전체 초기화` is placed in the top action area of the scheduled-post section.
- Single-post submit text changes by mode: `바로 작성 후 게시` for immediate publishing and `예약 게시` for scheduled publishing.
- Instagram and Threads can be selected together for single-post publishing.
- Instagram and Threads can also be selected in `예약 게시`.
- Account connection cards now include `연결 정보 확인` details in addition to connect/reconnect/disconnect actions.
- Job cards can show posted or scheduled content preview, including image/video and text.

### Preview and Media Work

- Single-post media selection supports multiple files.
- Right-side media preview supports carousel-style previous/next buttons and index dots.
- The final publish preview shows platform-specific output text.
- Scheduled-post candidates can be clicked to show a right-side preview using the same left/editor and right/preview layout pattern as single-post authoring.
- Scheduled preview supports previous/next navigation across registered candidates.
- Scheduled jobs created from folders include both media and text when caption files or common scheduled copy are present.

### Scheduled Posting Work

- Folder auto-registration remains the primary flow.
- Date folders are read from `YYYYMMDD`, `YYYY-MM-DD`, or similar date-folder names.
- Supported caption sources include same-name `.txt`/`.md`, date-folder `caption.txt`, and `captions.csv`.
- `예약 공통 문구` applies to images without a matching caption file.
- Users can delete unwanted scheduled candidates before creating jobs.
- Users can add individual files through `개별 등록` with a selected reservation date.
- Deletion and individual addition are restricted after successful scheduled jobs exist to avoid client/server state mismatch.

### Brand and UI System

- CSS uses the supplied brand palette: Heritage Navy, Signal Gold, Paper Cream, Deep Ink, Mid Navy, Steel, Gold Deep, Paper, Ink, white, and black.
- Instagram logo colors are intentionally allowed as original Instagram brand colors.
- Fonts are wired through CSS tokens: Pretendard Variable/Pretendard for UI, Noto Serif KR for serif use, and JetBrains Mono for mono/caption/code use.
- CSS hex extraction was checked: only official colors, official alpha variants, and Instagram logo color exceptions remain.
- Gold is used as an accent, not as the base surface.

### Documentation

- Added Word user guide: `docs/automatic-posting-user-guide.docx`.
- The guide covers quick start, account connection, single-post publishing, hashtag entry, media preview, scheduled posting, folder/caption rules, individual registration, deletion, job status, and troubleshooting.
- DOCX uses the official color palette and a Word-compatible `맑은 고딕` theme/font setup.

### Verification Completed

- `node --check cloudflare/public/app.js`
- `npm.cmd --prefix cloudflare run typecheck`
- `npm.cmd --prefix cloudflare run build`
- `git diff --check`
- CSS color validation: `OK`
- DOCX zip/package validation: `OK`
- DOCX XML parsing validation: `OK`
- DOCX internal color validation: `OK`
- DOCX font/theme check confirmed `맑은 고딕` usage.

### Verification Limitations

- Playwright layout verification could not run fully because the installed Playwright browser executable was missing, and launching local Chrome/Edge failed with `spawn EPERM`.
- DOCX PNG render QA could not run because the Documents renderer dependency `pdf2image` was missing and `soffice` was not available on PATH.
- The DOCX was therefore structurally validated, but still should be opened once in Word for visual QA before external distribution.

### Repository State Notes

- Latest committed and pushed implementation work before this PM update: `7ca9caa`.
- Previous relevant commits:
  - `349c851 Add scheduled post item management`
  - `c3883a2 Refine workspace layout and tab navigation`
  - `ef9dcbe Add carousel previews for scheduled posts`
  - `e8d5c2d Support multi media previews and account details`
  - `1bbe800 Complete publish control updates`
- Unrelated dirty/untracked files were intentionally left untouched during the latest work:
  - `README.md`
  - `.tmp-chrome-docs/`
  - `.tmp-chrome-ui/`
  - `.tmp-ui-desktop.png`
  - `.tmp-ui-mobile.png`
  - `docs/16-settings-guide.md`
  - `docs/17-usage-guide.md`
  - `docs/18-app-setup-usage-guide.md`
  - `docs/assets/`

### Recommended Next Checks

1. Confirm Cloudflare Pages has deployed commit `7ca9caa`.
2. Open the production app and verify the single-post and scheduled-post layouts at desktop and mobile widths.
3. Run live single-post tests for Instagram only, Threads only, and Instagram + Threads together.
4. Run a scheduled-post test with a folder containing images plus `.txt` captions and another test using `개별 등록`.
5. Open `docs/automatic-posting-user-guide.docx` in Word and visually confirm page layout, tables, and Korean font rendering.

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
