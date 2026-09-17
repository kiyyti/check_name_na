# Deploy check name na to Vercel

Deploy the `web` directory (not the whole `checkname` folder).
Vercel uses Next.js through `vercel.json` and `npm run build:vercel`.
The existing local preview command `npm run dev` is still available.

## Account and project

From `web`, run `npx vercel login`, then `npx vercel link`.
Create a project named `check-name-na` in your own account and choose this directory (`./`).
If importing a repository containing the whole project instead, set Root Directory to `web`.

## Environment variables

Before the first deployment, add these in the Vercel project settings for Production and Preview:

- `GOOGLE_APPS_SCRIPT_URL`: the existing Apps Script web app URL ending in `/exec`.
- `GOOGLE_APPS_SCRIPT_SECRET`: the same secret as `API_SECRET` in Apps Script, available in the local `web/.env` file.

Never add a `NEXT_PUBLIC_` prefix to these names. Do not upload `.env`, share the secret in chat, or commit it.
`.gitignore` and `.vercelignore` exclude local environment files.
Keep the existing Google Sheet private; its sharing permissions do not need to change.

## Publish and verify

From `web`, run `npx vercel --prod`.
Use the actual production URL returned by Vercel; the project name does not guarantee a particular domain.

1. Open the production URL on a phone and check that the course and class levels load.
2. Open `/qr` on the same production domain to get the QR for students.
3. Test a check-in using a test student during an eligible session, allow location access, and confirm the result in Attendance.
4. Check in again for that same round and verify there is only one Attendance record for the student and session.
5. Check that students can access the production URL without a Vercel account; adjust Production Deployment Protection if it is enabled.

Attendance writes are only confirmed after testing the deployed site against Google Sheets.
This deployment does not change the current shared time/location settings for all sessions.

References: https://vercel.com/docs/projects/deploy-from-cli and https://vercel.com/docs/environment-variables
