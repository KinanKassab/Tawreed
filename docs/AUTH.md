# Authentication

Sign-in and account creation use email/password only. Phone numbers are collected as contact and delivery details and are not accepted as account identifiers or OTP destinations.

React Native sessions use an appropriate persistent adapter, automatic token refresh follows app foreground/background state, and the web uses browser-compatible persistence. Email confirmation/reset links require configured deep links and web redirect URLs.

Password registration enters the app immediately when Supabase returns a session. When email confirmation is enabled, registration opens a six-digit activation-code step and verifies the Supabase signup OTP without asking the user to re-enter the password. The code can be resent and expires after one hour.

Password recovery uses the verified email address. No WhatsApp or phone authentication route is exposed by the Doctor client.
