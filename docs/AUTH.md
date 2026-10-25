# Authentication

Primary sign-in is email/password. Secondary sign-in is phone OTP delivered over WhatsApp using a replaceable Supabase-compatible Twilio/Twilio Verify configuration. Hosted secrets stay outside the client.

React Native sessions use an appropriate persistent adapter, automatic token refresh follows app foreground/background state, and the web uses browser-compatible persistence. Email confirmation/reset links require configured deep links and web redirect URLs.

Password registration enters the app immediately when Supabase returns a session. If a hosted project requires email confirmation, the registration screen explains that the confirmation link completes sign-in automatically; it does not send the user back to re-enter credentials.

Independent phone signup remains release-blocked until the single-account linking question in `OPEN_QUESTIONS.md` is resolved and tested.
