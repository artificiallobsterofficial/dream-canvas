# Deploying the DreamCanvas API worker

One-time setup (~10 minutes, free Cloudflare account required). Run everything
from this `worker/` directory.

## 1. Log in to Cloudflare

```
npx wrangler login
```

Opens a browser to authorize. If you don't have a Cloudflare account yet,
create one (free tier is plenty: 100k requests/day).

## 2. Create the KV namespace

```
npx wrangler kv namespace create DC_KV
```

Copy the `id` it prints into `wrangler.toml` (replace
`REPLACE_WITH_KV_NAMESPACE_ID`).

## 3. Set secrets

```
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ADMIN_TOKEN
```

- `ANTHROPIC_API_KEY`: your Anthropic key (console.anthropic.com). It lives
  only on Cloudflare — never in the client bundle.
- `ADMIN_TOKEN`: any long random string you make up. It's the password for
  reading tester feedback.

## 4. Deploy

```
npx wrangler deploy
```

Prints your worker URL, e.g. `https://dreamcanvas-api.<your-subdomain>.workers.dev`.

## 5. Point the app at it

In the GitHub repo: **Settings → Secrets and variables → Actions → Variables →
New repository variable**

- Name: `AI_PROXY_URL`
- Value: the worker URL from step 4 (no trailing slash)

Then re-run the Pages deploy (push any commit, or Actions → Deploy to GitHub
Pages → Run workflow). The deployed app now has live AI, feedback, and cloud
backup. For local dev, put the same URL in `.env` as `VITE_AI_PROXY_URL`.

## Reading tester feedback

```
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://<worker-url>/api/feedback
```

## Cost guardrails

- The proxy uses Haiku (cheap, fast) — change `MODEL` in `wrangler.toml` if you
  want a bigger model. BYOK users are unaffected; their own key/model is used.
- Per-IP daily caps: 50 AI calls, 10 feedback posts, 30 backup writes
  (`LIMITS` in `src/index.js`).
- Set a spend limit in the Anthropic console as a backstop.
