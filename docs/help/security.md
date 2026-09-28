# Account Security & Active Session Management

Universal CRM provides self-service security tools at `/app/settings/security` so every user can monitor and protect their account.

---

## 1. Changing Your Password

1. Navigate to **Settings > Security**.
2. In the **Change Password** card:
   - Enter your **Current Password** (verified on the server).
   - Enter a **New Password** (minimum 8 characters, must contain uppercase, lowercase, number, and special character).
   - Confirm the new password.
3. Click **Update Password**.

> [!IMPORTANT]
> Changing your password automatically revokes all other active sessions across your other computers, phones, and tablets.

---

## 2. Active Session Viewer

The **Active Sessions** card displays every browser currently logged into your account:
- **Device & Browser**: Parsed User-Agent details (e.g. "Chrome on macOS", "Safari on iOS").
- **IP Address**: Origin IP address of the login.
- **Current Session Badge**: A green indicator marking the session you are currently using.
- **Last Active**: Timestamp of the most recent request.

---

## 3. Remote Session Revocation

If you suspect an unauthorized device or forgot to log out of a public computer:
- **Revoke Single Session**: Click the red **Revoke** button beside any specific session.
- **Sign Out All Other Devices**: Click **Sign Out All Other Devices** at the top of the session list to immediately invalidate every session except your current one.
