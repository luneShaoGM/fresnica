# S21 Android dApp local notifications

Phase 2b shell is available. S21 is an Adapt slice in the existing strict dApps/navigation scopes. Reference behavior: Stellar at bd0f4540b2496a57314e4e29bc6fcf8ff691b60f. This is a clean-room implementation. The capability validates and authorizes; the browser manages document lifetime; Android owns system notification delivery.

Only a verified, live top-level HTTPS document with explicit connection consent for the active origin, account and network can request a notification. Catalog display trust does not suffice. The bridge accepts Stellar's SHOW_SYSTEM_NOTIFICATION envelope with bounded nonblank title and body, and rejects duplicate IDs. It replies with the matching ID and shown flag only while the original document is live.

On Android the owner can enable notifications in system App Info. The dApp cannot open the permission prompt. Denied or disabled permissions, lack of foreground window focus, or delivery failures return shown=false. Notifications attribute the verified origin, hide content on the lock screen, replace the prior dApp notification, and can update at most once per ten seconds. iOS returns shown=false, matching the Android-only delivery scope. No push backend, URL tap routing, or signing permission is involved.

Acceptance on physical Android: enable/disable notifications at system level, connect and revoke a dApp, post via a live main-frame session, confirm origin and lock-screen privacy, then repeat after navigation, background or an account/network switch. Record native product acceptance separately from repository tests.
