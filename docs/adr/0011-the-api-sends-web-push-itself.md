# 11. The API sends web push itself, with the app's own keys

Status: accepted.

## Context

Members should be told about a new announcement without opening the app. A phone's browser can receive a "web push" even
when the app is closed, if the server asks the browser maker's push service to deliver it.

## Decision

- Standard web push with the app's own key pair (called VAPID keys: they prove to a browser's push service that a push
  comes from this app). The API talks to each browser's push service directly with the `web-push` package:
  `apps/api/src/lib/push-manager.ts`.
- Pushes go out 50 at a time with a 10-second limit each. A text is cut to fit the 3,000-byte limit. Devices the push
  service reports as gone (404, 410) are deleted; a timeout does not prove a device is gone, so those stay.
- A device registers after a tap on the notification prompt (`apps/web/src/lib/push.ts`,
  `apps/web/src/components/push/`). A signed-in device registers its existing subscription again at each start and
  unlinks it when the session ends. The service worker shows the notification and opens the right page when it is tapped
  (`apps/web/src/sw.ts`).
- A device's address must be an https address at a browser push service (Google, Apple, Mozilla or Windows), read the
  same way by the URL standard and by the push library, so a member cannot make the server call another machine
  (`apps/api/src/lib/push-service.ts`). A member keeps at most 20 devices; the least recently registered go first
  (`MAX_DEVICES_PER_MEMBER` in `apps/api/src/repositories/push.repo.ts`).
- Which members are notified (the chosen angkatan, minus those who muted the post's categories) is decided in
  `notifyNewInfo` in `apps/api/src/repositories/info.repo.ts`.

## What else was possible

- A push company (OneSignal, Firebase): less code and nicer delivery reports, but a third party would know which member
  got which message, and it is another account and bill for HMIF.

## What it costs

- On iPhone, push works only after the app is added to the home screen, and the app has to explain that.
- The text of an announcement travels through Google's and Apple's push services. Curhat Yuk! notifications carry a
  fixed line only (see 0009).
- Nothing is queued: a restart during a send loses the rest of that send (see 0010).
- The push code is ours to maintain, including every limit above.

## When to revisit

When delivery problems become common (a delivery log would be the first thing to add) or when HMIF wants campaigns or
scheduled sends, which a push company already provides.
