# Local development and verification

## Requirements
- Node.js 22 LTS and npm
- Git

## Run on Windows PowerShell

```powershell
git clone https://github.com/Adeelijah/greenfield-school-management.git
cd greenfield-school-management
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

Open http://localhost:3000. Check the dashboard and every sidebar route on desktop and mobile.

## Current scope
- The navigation and module routes are functional.
- Module pages are placeholders; approved V26 content will be ported progressively.
- No authentication, database, or production permissions exist yet.
- No actual build or browser test has been completed in the assistant environment; run the commands above and report any errors.
- Never commit credentials, real pupil records or payment information.
