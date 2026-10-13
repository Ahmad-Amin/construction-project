# Sign-in email templates

Supabase sends the sign-up, password-reset and sign-in-link emails itself, so their look is set in the
Supabase dashboard, not in the app. These files match the app's own notification emails
(`renderNotificationEmail` in `src/lib/email.ts`). Paste each file into the dashboard:

**Authentication → Emails → Templates** (older dashboards: Authentication → Email Templates)

| Supabase template | File | Subject line |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | Confirm your email for BuildPeek |
| Reset password | `reset-password.html` | Reset your BuildPeek password |
| Magic link | `magic-link.html` | Your BuildPeek sign-in link |
| Change email address | `change-email.html` | Confirm your new email for BuildPeek |

The `{{ .ConfirmationURL }}` and `{{ .NewEmail }}` parts are Supabase placeholders; leave them as they are.
"Invite user" and "Reauthentication" are not used by the app (invites go through `/invite/<token>`).
Use **Send test email** or sign up with a fresh address to check the result after saving.
