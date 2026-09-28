# User Management & Email Invitations

The User Management workspace at `/app/settings/users` allows administrators to control team access, assign roles, and enforce security policies.

---

## 1. Inviting a New User

1. Navigate to **Settings > Users**.
2. Click **+ Invite User**.
3. Fill out:
   - **Full Name**: The user's name.
   - **Email Address**: The destination work email.
   - **Role**: Assign an initial system or custom role.
   - **Team**: Optionally assign the user to a departmental team.
4. Click **Send Invitation**.

### What happens behind the scenes:
- A cryptographically secure 32-byte token is generated.
- A **SHA-256 hash** of the token is saved in the database with a **7-day expiration**.
- An email is dispatched via `EmailService` with a link to `/invite/[token]`.
- The user is created in `INVITED` status with no password hash.

---

## 2. Disabling & Re-enabling Accounts

If an employee departs or an account is compromised:
1. Click the action menu (`...`) on the user's row and choose **Deactivate User**.
2. Confirm the action.

### Immediate Session Invalidation:
- When a user is `DISABLED`, their status is updated in the database.
- **All active DB sessions are immediately purged**.
- If the user attempts any API call or page navigation, edge middleware and server session validation reject the request with HTTP 401/403.

---

## 3. Admin Password Reset

If a user is locked out:
1. Click **Reset Password** on the user row.
2. Enter a new compliant temporary password.
3. Click **Reset Password**.
4. The password is encrypted with bcrypt (12 rounds), and all existing active sessions for that user are immediately revoked.
