# Context landing page

- `/` is the public landing page; dashboard links navigate to the existing `/context` app.
- `app/landing.module.css` scopes the marketing styles separately from the workspace, using its same blue palette (`#2167d5`), cool backgrounds, text, and border colors. The browser check verifies that core palette values match.
- The email form posts to `/api/waitlist`. Success means the email is saved, not that an email was sent.
- Signups are normalized, deduplicated, and stored in `data/waitlist.sqlite`, outside `public/` and ignored by Git. There is no public endpoint for reading the list.
- Set `CONTEXT_WAITLIST_DB_PATH` to override the file location. Use Node 24+ with a writable, persistent disk. Back up this file; ephemeral/serverless storage will not retain the waitlist. Multiple replicas need shared hosted storage before deployment.
- The form explains that addresses will be used for launch updates. No email provider or automated messages are configured. Access or export addresses only through trusted server-side tooling.
- The endpoint validates JSON, email length and format, and same-origin requests. It caps new signups at 100 per rolling hour across the instance. Add edge-level abuse protection before large-scale public promotion; the cap is not per-person verification.
- The product preview uses explicitly labeled sample scenarios, not live operational data.

## Checks

```sh
npm test
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
CONTEXT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-landing.cjs
```

The browser check mocks waitlist submissions to avoid polluting real signups. API tests use a temporary database and cover persistence, deduplication, validation, rate limiting, origin checks, and failed writes. Set `CONTEXT_SCREENSHOT_DIR` to save optional desktop and mobile screenshots.
