# Credential rotation — procedure for an automated operator

A Supabase personal access token, a Supabase `service_role` key, the Postgres
password and a Vercel token were all exposed in a chat transcript. They must be
replaced. This file is the procedure, written to be executed by an agent with
access to the machine and the credentials, one phase at a time.

Nothing here is urgent enough to justify skipping a verification gate. The site
is live and working; a bad rotation is the only thing in this document that can
take it down.

---

## Rules that hold for every phase

1. **Never revoke or disable an old credential before the new one is proven
   live.** Every phase below creates, deploys, verifies, and only then removes.
2. **`npm run health` is the gate.** Run it after every write. Exit code 1 means
   stop — do not start the next phase, roll back instead.
3. **Never print a secret value** to stdout, to a log, or to any file that is not
   already gitignored. Write new values straight into the tool that needs them.
4. **One phase per run.** Do not batch. Report the result of each phase before
   starting the next.
5. **If a response does not match what this file describes, stop and report it.**
   The Supabase Management API request bodies below were taken from the published
   reference, not executed — treat a mismatch as new information, not as an
   obstacle to work around.
6. **Do not touch `AUTH_SECRET` or `NEXTAUTH_SECRET`.** They are not part of this
   rotation. They must hold identical values, and changing either logs out every
   user and breaks Google sign-in until both are updated everywhere.
7. **Do not touch `SUPABASE_ANON_KEY`.** It is public by design — it ships to
   every browser — and row-level security is now enabled on all 22 tables, so it
   grants no read access to data.

---

## Constants

```
SUPABASE_PROJECT_REF   wcmldqrlppclprpcyjso
VERCEL_TEAM_ID         team_ryKYqIymO5qzIwVsGIe70b76
VERCEL_TEAM_SLUG       roonie76s-projects
BUYER_PROJECT_ID       prj_7kiIDzxUu1ZaAEaPdvXnd8b0CfmX      (name: seyon)
SELLER_PROJECT_ID      prj_fb40cyXU2I8x6yDPrOH8UdV6prDM      (name: seyon-seller)
BUYER_URL              https://seyon-pied.vercel.app
SELLER_URL             https://seyon-seller.vercel.app
```

Both projects need the same values for `SUPABASE_SERVICE_ROLE_KEY` and
`DATABASE_URL`. Updating only one is the most likely way to half-break the site.

---

## Inputs — three different credentials, easily confused

Supabase issues two kinds of token that both start with `sb_`, and they are not
interchangeable. Passing one where the other is expected returns
`JWT could not be decoded`, which reads like a corrupted token rather than the
wrong kind of token. Check the prefix before starting.

| Variable | Prefix | What it opens | Where it comes from |
| --- | --- | --- | --- |
| `SUPABASE_PAT` | `sbp_` | The **Management API** — creating keys, resetting the database password. Account-wide, across every project you own. | supabase.com/dashboard/account/tokens → Generate new token |
| *(the key being rotated)* | `sb_secret_` | **One project's data**, as an admin. Bypasses row-level security entirely. This is what lives in `SUPABASE_SERVICE_ROLE_KEY`. | Project → Settings → API Keys |
| `VERCEL_TOKEN` | — | The Vercel account: environment variables and deployments. | vercel.com/account/tokens |

Only `SUPABASE_PAT` authenticates against `api.supabase.com`. A `sb_secret_` key
authenticates against `https://<ref>.supabase.co` and will always be rejected by
the Management API.

Set all three as environment variables in the shell that runs this procedure.
Never paste them into a chat, a file inside the repository, or a command that
gets echoed to a log.

---

## Phase 0 — baseline

Read-only. Establishes that the site is healthy *before* anything changes, so a
later failure can be attributed to this procedure rather than to something that
was already broken.

```bash
cd D:\Projects\Seyon
npm run health
```

All 7 checks must pass. If any fail now, stop: fix that first, and do not begin
the rotation.

Record, in a file that is gitignored or outside the repository:

- the current value of `SUPABASE_SERVICE_ROLE_KEY` in both Vercel projects
- the current value of `DATABASE_URL` in both Vercel projects
- the deployment IDs currently serving production, from:

```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/$BUYER_PROJECT_ID?teamId=$VERCEL_TEAM_ID" \
  | jq '.latestDeployment | {id, url, readyState}'
```

Those recorded values are the rollback. Without them there is no way back from
phase 2.

---

## Phase 1 — create a new Supabase secret key

The new-format secret keys (`sb_secret_…`) exist alongside the legacy
`service_role` key, so this phase adds a credential and removes nothing. The
application reads whichever string is in `SUPABASE_SERVICE_ROLE_KEY` and does not
care about the format.

**1.1 — Discover the shape first.** Do not guess the POST body; read what the
project already has:

```bash
curl -s -H "Authorization: Bearer $SUPABASE_PAT" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys" \
  | jq 'map({id, type, name, description})'
```

This lists existing keys without revealing their values. Note the field names it
returns — the create call mirrors them.

**1.2 — Create the key.**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"type":"secret","name":"vercel-prod","description":"Server-side key for both Vercel projects"}' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys?reveal=true"
```

The response carries the key value once. Capture it into an environment variable
in the current shell — do not echo it, do not write it to a file in the repo.

If this returns 4xx, the body shape differs from the reference. **Stop and
report.** The dashboard equivalent is Settings → API Keys → new secret key, and
is a perfectly good substitute.

**1.3 — Prove the new key works before deploying it.** A key that was created but
is not yet active would fail the next phase in a way that looks like a deployment
problem:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $NEW_SECRET_KEY" \
  -H "Authorization: Bearer $NEW_SECRET_KEY" \
  "https://$SUPABASE_PROJECT_REF.supabase.co/rest/v1/BlogPost?select=id&limit=1"
```

Expect `200`. Anything else means the key is not usable yet — wait a few seconds
and retry once, then stop and report.

Nothing has changed in production at this point. The site is untouched.

---

## Phase 2 — deploy the new key

**2.1 — Update the variable in both projects.** For each of
`$BUYER_PROJECT_ID` and `$SELLER_PROJECT_ID`, find the env var's id, then patch
its value:

```bash
# find the id
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/$PROJECT_ID/env?teamId=$VERCEL_TEAM_ID" \
  | jq -r '.envs[] | select(.key=="SUPABASE_SERVICE_ROLE_KEY") | "\(.id) \(.target|join(","))"'

# patch it
curl -s -X PATCH \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"value\":\"$NEW_SECRET_KEY\"}" \
  "https://api.vercel.com/v9/projects/$PROJECT_ID/env/$ENV_ID?teamId=$VERCEL_TEAM_ID"
```

If the variable exists more than once (separate entries for production, preview
and development), patch the **production** one. Leave the others; they point at
nothing that matters here.

**2.2 — Redeploy both projects.** Env var changes do not apply to a running
deployment. Redeploy the *existing* production deployment rather than deploying
the working tree — the working tree has uncommitted line-ending churn and must
not become a deployment:

```bash
npx vercel redeploy <current-production-deployment-url> \
  --token "$VERCEL_TOKEN" --scope "$VERCEL_TEAM_SLUG"
```

Run once per project, using each project's own deployment URL from phase 0.

**2.3 — Wait for READY,** then gate:

```bash
npm run health
```

- **All 7 pass** → the new key is live. Continue to phase 3.
- **Any fail** → roll back immediately: PATCH both env vars back to the recorded
  old value, redeploy both, run `npm run health` again to confirm recovery, then
  report. Do not continue.

**2.4 — Prove the key is doing real work.** Health checks read the database; they
do not exercise storage, which is what the service key is actually for:

```bash
npx vercel env pull .env.production.local
npm run storage:doctor
```

Expect all buckets to pass. This must be clean before phase 3, because phase 3
removes the fallback.

---

## Phase 3 — disable the legacy keys

Only after phases 1 and 2 have both passed. This is the step that actually closes
the exposure.

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys/legacy"
```

Then, immediately:

```bash
npm run health
npm run storage:doctor
```

Both must pass. If either fails, re-enable with `{"enabled":true}` on the same
endpoint, verify recovery, and report — something is still reading the old key.

A `404` from this endpoint means the legacy key system has already been retired
for this project. That is a success condition, not an error.

---

## Phase 4 — the database password

This is the only phase with unavoidable downtime, and the only one that cannot be
rolled back: once the password changes, the old connection string is dead. Roll
*forward* only. Do it while someone is watching, not on a schedule.

Minimise the window by preparing everything before the reset.

**4.1 — Generate a password** of at least 32 characters, alphanumeric only. Avoid
`@`, `:`, `/`, `#` and `?`: they have meaning inside a connection URL and will
produce a string that parses wrongly rather than failing loudly.

**4.2 — Build the two new connection strings offline.** Take the recorded
`DATABASE_URL` from phase 0 and substitute only the password segment. Do not
reconstruct the URL from memory — the host, port, pooler mode and query
parameters must be preserved exactly.

**4.3 — Set the password:**

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$NEW_DB_PASSWORD\"}" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/password"
```

The site is now broken. Continue without pausing.

**4.4 — Patch `DATABASE_URL` in both projects** (same PATCH call as 2.1, with the
`DATABASE_URL` env id), then redeploy both as in 2.2.

**4.5 — Gate:**

```bash
npm run health
```

The two database-reading checks and the database-*writing* check are the ones
that matter here. If they fail, the connection string is wrong: check for an
unescaped character in the password, and for the host and port having been
altered rather than only the password.

**4.6 — Update the local `.env`** so scripts keep working, if it holds a
production `DATABASE_URL` or `DIRECT_URL`. The repository's `.env` currently
points at `127.0.0.1`, so this may be a no-op.

---

## Phase 5 — revoke the tokens that were used to do all this

Last, because everything above needed them.

- **Supabase personal access token** — supabase.com → account → Access Tokens →
  revoke the exposed one. Nothing in the deployed application uses it.
- **Vercel token** — vercel.com/account/tokens → delete the exposed one. Nothing
  in the deployed application uses it either.

Then a final gate:

```bash
npm run health
npm run storage:doctor
```

Both clean means the rotation is complete and the site never noticed.

---

## Rollback summary

| Phase | Reversible? | How |
| --- | --- | --- |
| 1 | Yes | Delete the new key: `DELETE /v1/projects/{ref}/api-keys/{id}`. Nothing was deployed. |
| 2 | Yes | PATCH both env vars back to the recorded old value, redeploy both. |
| 3 | Yes | `PUT /api-keys/legacy` with `{"enabled":true}`. |
| 4 | **No** | Roll forward only. Fix the connection string and redeploy. |
| 5 | No | A revoked token cannot be restored; create a new one if needed. |

---

## What was verified, and what was not

Stated plainly, because acting on a guess against production is how this goes
wrong:

**Verified today, by execution:**

- `npm run health` passes all 7 checks against live production, and fails with
  exit code 1 when pointed at a broken host.
- Row-level security is enabled on all 22 `public` tables, none forced.
- The Vercel team is on the `hobby` plan; both projects' latest production
  deployments are `READY`.
- The `avatars` storage bucket was missing and has been created.

**Taken from the published reference, not executed:**

- Every Supabase Management API path and body in phases 1, 3 and 4.
- Every Vercel REST API path and body in phase 2.
- The `vercel redeploy` invocation.

The paths came from Supabase's own API reference and Vercel's documented REST
API, retrieved on 4 September 2026. The **bodies** are the weaker claim — that is
why phase 1 begins by reading the existing shape before writing, and why a 4xx
anywhere is an instruction to stop and report rather than to retry with a
variation.
