# MaliPhone Cloudflare platform Worker

This Worker deliberately has two separate responsibilities:

- Existing `/claude`, `/ollama`, and `/nvidia` routes continue to forward a user's own API key unchanged.
- New `/v1/*` routes are the future platform data API. They require a Supabase access token and never accept a `user_id` from the browser.

Supabase remains responsible for account creation, passwords, email confirmation, and OAuth. Cloudflare D1 stores small structured documents; R2 stores media. The app is **not connected to these data routes yet**, so local IndexedDB remains the current source of truth.

## One-time Cloudflare setup

From this folder, sign in and create the two resources:

```powershell
npx wrangler login
npx wrangler d1 create maliphone-data
npx wrangler r2 bucket create maliphone-media
```

Copy `wrangler.toml.example` to `wrangler.toml`, then fill in the D1 `database_id` shown by Cloudflare and the same Supabase URL/publishable key already used by the app. Do not add a Supabase secret or service-role key.

Apply the schema and deploy:

```powershell
npx wrangler d1 migrations apply maliphone-data --remote
npx wrangler deploy
```

## Safe smoke test

After deployment, obtain the current Supabase session access token from the browser application, then call:

```powershell
$token = "PASTE_CURRENT_SUPABASE_ACCESS_TOKEN"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod "https://YOUR_WORKER.workers.dev/v1/me" -Headers $headers
Invoke-RestMethod "https://YOUR_WORKER.workers.dev/v1/documents/test" -Method Put -Headers $headers -ContentType "application/json" -Body '{"message":"hello from MaliPhone"}'
Invoke-RestMethod "https://YOUR_WORKER.workers.dev/v1/documents/test" -Headers $headers
```

Endpoints are deliberately narrow for now:

- `GET /v1/health` verifies bindings without sign-in.
- `GET /v1/me` checks Supabase authentication.
- `GET` / `PUT /v1/documents/<key>` stores an object under the authenticated account (512 KiB maximum).
- `GET` / `PUT /v1/media/<name>` reads or writes a private R2 object for the authenticated account (10 MiB maximum).

The hosted-model route is still disabled by default. It does not implement payments; test credits are a server-side, one-time allowance assigned manually to selected Supabase user IDs.

## Mali model provider pool

The Worker contains a hosted text-model test foundation. It keeps a manually assigned one-time point balance per selected account, a daily safety allowance, a connection-test counter, and a separate daily allowance for each provider. The browser never receives provider keys or controls the model. Text requests are the only supported hosted payload; image and audio generation stay outside this test mode. Accounts can be matched by their verified Supabase user ID or verified email; email allowlist rows start with zero points until an administrator assigns a balance.

To enable it later, add only server-side Cloudflare Secrets:

```powershell
npx wrangler secret put GEMINI_PRIMARY_API_KEY
# Optional, separately authorized fallback provider:
npx wrangler secret put GEMINI_BACKUP_API_KEY
# Optional OpenRouter provider (the key is never exposed to the browser):
npx wrangler secret put OPENROUTER_API_KEY
# Per-account second key (the migration assigns this to rikkakihana@gmail.com):
npx wrangler secret put OPENROUTER_API_KEY_RIKKAKIHANA
```

After applying migrations `0003_mali_test_credits_and_usage.sql`, `0004_mali_provider_secret_slots.sql`, `0005_correct_first_test_email.sql`, `0006_mali_usage_app_actions.sql`, and `0007_set_mali_test_credit_budget.sql`, update the selected rows in `mali_test_accounts` with their one-time `granted_points`, set `MALI_TEST_MODE_ENABLED = "true"`, and deploy the Worker. The current test budget migration sets each approved account to a total of 500 points while preserving already-recorded usage. Hosted text generations cost 2 points for online/group chat, 3 points for reality chat, and 1 point for other AI features. The first five connection tests are free; every fifth test boundary after that costs 1 point. Failed upstream requests are refunded and marked in the usage ledger, so an OpenRouter balance outage does not silently consume test points. The current `OPENROUTER_API_KEY` secret is assigned to `a878799@gmail.com`; `OPENROUTER_API_KEY_RIKKAKIHANA` is assigned to `rikkakihana@gmail.com`. Set `MALI_OPENROUTER_MODELS` in `wrangler.toml` to the comma-separated, server-allowlisted model order; the test screen sends only one of those exact model IDs. The browser never controls a key or arbitrary model. `GET /v1/mali/quota` returns configured provider names/models without secrets, plus the signed-in player's own allowance and usage counters. `GET /v1/mali/usage?limit=50` returns the signed-in player's recent metadata-only request ledger, including `app`, `action`, model, token counts, points, request ID, provider generation ID, and UTC timestamps. The existing bring-your-own-key routes remain separate and do not consume this allowance.

The usage ledger deliberately stores no prompt or generated text. `created_at` is written as an ISO-8601 UTC timestamp at reservation time and `completed_at` at completion. To compare an OpenRouter account's spend with the player action, filter D1 by the same UTC time window and inspect `app_id`, `action_id`, `model`, and `generation_id`:

```sql
SELECT created_at, completed_at, app_id, action_id, model,
       input_tokens, output_tokens, total_tokens, points_charged,
       status, generation_id
FROM ai_usage_requests
WHERE user_id = 'SUPABASE_USER_ID'
ORDER BY created_at DESC;
```

For a first smoke test, a selected account receives five free connection tests; the sixth, eleventh, sixteenth, and later tests at each five-test boundary charge one point. The Worker also enforces a cooldown and daily connection-test cap. Keep the mode disabled until the migration, account rows, and server secrets are ready.
