# Authentication

Sign-in and account creation use email/password only. Phone numbers are collected as contact and delivery details and are not accepted as account identifiers or OTP destinations.

React Native sessions use an appropriate persistent adapter, automatic token refresh follows app foreground/background state, and the web uses browser-compatible persistence. Email confirmation/reset links require configured deep links and web redirect URLs.

Password registration enters the app immediately when Supabase returns a session. If a hosted project requires email confirmation, the registration screen explains that the confirmation link completes sign-in automatically; it does not send the user back to re-enter credentials.

Password recovery uses the verified email address. No WhatsApp or phone authentication route is exposed by the Doctor client.
