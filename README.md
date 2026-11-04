# QuickHatid

QuickHatid supports a React/Vite exhibition mode and an Express API mode with MySQL persistence, bcrypt password hashes, HTTP-only database-backed sessions, SMTP password recovery, and per-account notification history.

## Local setup

1. Install Node.js 20 or newer.
2. Install project dependencies:

   ```powershell
   npm install
   ```

3. Start the app in exhibition mode:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:5173`. Create Account, Sign In, Sign Out, profile editing, password changes, password recovery, and notifications work without a database. Exhibition accounts and per-account notification history are saved in this browser only, and passwords are PBKDF2-hashed before storage. The demo reset code appears on screen instead of being emailed. Do not use exhibition mode or its browser storage for real accounts.

## Connect MySQL later

When your instructor is ready to configure MySQL:

1. Install/start MySQL 8.
2. Run the setup helper:

   ```powershell
   npm run setup:db
   ```

   Enter the MySQL administrator password in the local terminal prompt. The helper imports `database/schema.sql`, creates a restricted `quickhatid_app` database user, and writes generated credentials to `.env`; it does not save the administrator password. For a different MySQL administrator name, run `npm run setup:db -- -AdminUser your_admin_name`.

3. Add SMTP settings to `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. For Gmail, use an app password, not the regular account password.
4. Set `VITE_AUTH_MODE=mysql` in `.env`, then restart `npm run dev`. The Vite development server proxies `/api` to the Express API.

## Production

Set `VITE_AUTH_MODE=mysql` at build time. Set `NODE_ENV=production`, use HTTPS, set `APP_ORIGIN` to the public site origin, and configure a strong `SESSION_SECRET` plus production MySQL and SMTP credentials. Build the client and start the API/server:

```powershell
npm run build
npm start
```

In production the Express server serves the built `dist` application as well as the API. Place the service behind HTTPS; session cookies are marked `Secure` in production.

## Accounts and roles

Public registration always creates a `customer` account. Rider and administrator roles must be assigned through a trusted administrative process; they cannot be chosen in the public form. Exhibition mode also creates customer-role accounts only. To bootstrap the first administrator in MySQL mode, register that person’s account, then promote the intended account directly in MySQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

In MySQL mode, the application never returns password hashes or session tokens from its API. Session tokens are random, stored in HTTP-only cookies, and stored as keyed hashes in `user_sessions`. Password-recovery codes expire after five minutes, are stored as bcrypt hashes, permit at most five verification attempts, and require a short-lived reset cookie issued only after successful code verification.

Notifications are stored per user in the `notifications` table and remain available after logout. Apply `database/schema.sql` to an existing database with `npm run setup:db` before using MySQL-mode notifications. The app creates notification history for account creation/profile/password changes and ride or errand request status updates.

## Authentication API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/profile`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-code`
- `POST /api/auth/reset-password`
- `GET /api/notifications`
- `POST /api/notifications`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:id/read`

The MySQL credentials, SMTP credentials, and session key are server-only environment variables; none are included in the client bundle.
