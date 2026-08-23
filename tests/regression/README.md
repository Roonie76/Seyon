# Regression suite — August 2026 adversarial audit

These specs assert the **correct** behaviour for each defect confirmed in the
audit. They were red when written and are **green as of the `fix/audit-2026-08`
branch** — from here on, a failure means a fixed bug has come back.

They are deliberately kept out of `npm test` (different file suffix + a
separate config) so the existing 100-test suite stays green while the defects
are still open.

```bash
# unit / schema level — 22 passing
npx vitest run --config vitest.regression.config.ts

# browser level — needs a seeded DB, a seller with a shop, and
# ALLOW_INSECURE_DEV_LOGIN=true for the passwordless test login
SELLER_EMAIL=seller1@audit.test npx playwright test tests/e2e/audit-regression.spec.ts
```

Finding IDs (F-xx) match the audit report.

| File | Guards |
|---|---|
| `product-validation.regression.ts` | F-02, F-04, F-05, F-07, F-17, F-18, F-19 |
| `demo-isolation.regression.ts` | F-01, F-09, F-11 |
| `../e2e/audit-regression.spec.ts` | F-02, F-03, F-07, F-08, F-15 |
