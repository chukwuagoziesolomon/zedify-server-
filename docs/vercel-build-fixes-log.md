# Vercel Deployment — Build Fix Log

**Date:** 2026-06-29  
**Project:** `wt-payments-server` (AdonisJS v5 / TypeScript)  
**Goal:** Resolve all TypeScript build errors preventing Vercel deployment.

---

## 1. Package / Install Issues

### 1.1 SSH auth failure for `contract-wallet-sdk`
- **Symptom:** Vercel build failed with `Host key verification failed` when Yarn tried to fetch `theiceeman/contract-wallet-sdk` via SSH.
- **Root cause:** The dependency in `package.json` was a bare GitHub shorthand (`theiceeman/contract-wallet-sdk`), which Yarn resolves over SSH by default.
- **Fix:** Changed to an explicit HTTPS URL in `package.json`:
  ```json
  "contract-wallet-sdk": "git+https://github.com/theiceeman/contract-wallet-sdk.git"
  ```

### 1.2 Mixed lockfiles warning
- **Symptom:** Vercel warned about `package-lock.json` alongside `yarn.lock`.
- **Fix:** Removed `package-lock.json` to avoid resolution inconsistencies.

### 1.3 .adonisrc.json missing at runtime
- **Symptom:** Vercel returns 500 with `Error: AdonisJS expects ".adonisrc.json" file to exist in the application root`.
- **Root cause:** `ace build --production` compiles source to `build/` but does not copy `.adonisrc.json`. Without `vercel.json`, Vercel served from the project root where `server.js` is absent; with `outputDirectory: "build"`, the runtime looks inside `build/` but the rc file was missing.
- **Fix:**
  - Added `metaFiles` entry for `.adonisrc.json` in `.adonisrc.json` so it is copied into `build/` during production builds.
  - Added `vercel.json` with `"outputDirectory": "build"` so Vercel runs the app from the compiled output.

---

## 2. TypeScript / Toolchain Upgrades

### 2.1 Outdated TypeScript (4.6) vs @types/node v20+
- **Symptom:** Multiple `TS1005: ';' expected` errors in `node_modules/@types/node/http2.d.ts` on method overloads using `string | symbol`.
- **Root cause:** `@types/node@^20.x` uses syntax that TypeScript 4.6 cannot parse.
- **Fix:**
  - Upgraded `typescript` from `~4.6` to `~5.3` in `package.json`
  - Added explicit `"@types/node": "^20.11"` to `devDependencies`
  - Added `"skipLibCheck": true` in `tsconfig.json` to trust `.d.ts` files from `node_modules`

### 2.2 Invalid library entry in tsconfig types
- **Symptom:** `Entry point of type library 'adonis5-scheduler'` error.
- **Root cause:** `adonis5-scheduler` was listed in `tsconfig.json` `compilerOptions.types` but the package is not installed.
- **Fix:** Removed `"adonis5-scheduler"` from the `types` array in `tsconfig.json`.

---

## 3. Route Definitions

### 3.1 Controller array syntax not matching typed RouteHandler
- **File:** `routes/webhooks.ts`
- **Symptom:** `TS2345: Argument of type '(string | typeof PaymentWebhookController)[]' is not assignable to parameter of type 'RouteHandler'.`
- **Root cause:** The array syntax `[PaymentWebhookController, 'method']` is not the correct typed overload in this version of AdonisJS.
- **Fix:** Changed to the string shorthand used throughout the rest of the codebase:
  ```ts
  // Before
  Route.post('/api/webhooks/payment', [PaymentWebhookController, 'handlePaymentEvent'])
  // After
  Route.post('/api/webhooks/payment', 'Http/PaymentWebhookController.handlePaymentEvent')
  ```

---

## 4. Validator API Usage

### 4.1 Calling `.validate()` on a typed schema
- **File:** `app/Validators/PaymentWebhookValidator.ts`
- **Symptom:** `TS2339: Property 'validate' does not exist on type 'ParsedTypedSchema<...>'`
- **Root cause:** `schema.create(...)` returns a typed schema descriptor, not a validator instance.
- **Fix:** Passed the correct `ValidatorNode` object to the global `validator.validate`:
  ```ts
  // Before
  return await payloadSchema.validate(data, messages)
  // After
  return await validator.validate({ schema: payloadSchema, data, messages })
  ```

### 4.2 Wrong argument count for `validator.validate`
- **Symptom:** `TS2554: Expected 1 arguments, but got 3.`
- **Root cause:** Intermediate fix passed 3 positional args instead of a single object.
- **Fix:** Consolidated into the single-argument form shown in 4.1.

### 4.3 Unused `rules` import in SettingsGeneralValidator
- **File:** `app/Validators/SettingsGeneralValidator.ts`
- **Fix:** Removed unused `rules` from the import.

---

## 5. Unused Variables / Dead Code

### 5.1 Unused local variables / parameters / imports (TS6133)
The project has `noUnusedLocals` and `noUnusedParameters` enabled. The following were removed or renamed:

| File | Issue | Resolution |
|---|---|---|
| `app/Services/WithdrawalService.ts` | `const fees` declared but value never read | Removed; recalculated per branch below |
| `app/Services/PayoutService.ts` | `paystackId` parameter never read | Renamed to `_paystackId` (underscore prefix is exempted by `noUnusedParameters`) |
| `app/Services/SseService.ts` | `heartbeatTimer` property never read | Removed property; `setInterval` expression left untracked |
| `app/Services/PayoutService.ts` | `_MONIEPOINT_API_KEY` / `_MONIEPOINT_BASE_URL` unused | Removed both fields entirely |
| `app/Services/PaymentIndexerService.ts` | Unused `BusinessSetting` import | Removed import |
| `app/Controllers/Http/PaymentStatusController.ts` | Unused `CryptoNetwork` import | Removed import |
| `app/Controllers/Http/ShopBuilderController.ts` | Unused `User` import | Removed import |
| `app/Controllers/Http/CryptoNetworkController.ts` | Unused `formatSuccessMessage` import | Removed import |
| `app/Controllers/Http/AuthUserController.ts` | Unused `rules` import | Removed import |
| `app/Middleware/Auth.ts` | Unused `token` variable | Removed declaration |

### 5.2 Private methods never referenced
| File | Issue | Resolution |
|---|---|---|
| `app/Controllers/Http/AuthUserController.ts` | Private `validate(request)` method declared but never called | Removed the dead method |

---

## 6. Type Mismatches

### 6.1 `null` vs `undefined` for optional field
- **File:** `app/Controllers/Http/AuthUserController.ts`
- **Symptom:** `TS2322: Type 'string | null | undefined' is not assignable to type 'string | undefined'`
- **Fix:** Changed `cacNumber: ... ? payload.cac_number : null` to `cacNumber: ... ? payload.cac_number : undefined`

### 6.2 String literal union mismatch
- **File:** `app/Controllers/Http/AuthUserController.ts`
- **Symptom:** `TS2322: Type 'string' is not assignable to type '"starter" | "registered" | undefined'`
- **Fix:** Cast `payload.business_type as 'starter' | 'registered'`

### 6.3 `file.mimetype` not on typed contract
- **File:** `app/Services/FileUploadService.ts`
- **Symptom:** `TS2339: Property 'mimetype' does not exist on type 'MultipartFileContract'.`
- **Root cause:** The typed `MultipartFileContract` from `@adonisjs/bodyparser` exposes `type`, not `mimetype`.
- **Fix:** Replaced all 3 occurrences of `file.mimetype` with `file.type`

---

## 7. Third-party API Mismatches

### 7.1 `hd.key.generatePrivateKey()` does not exist
- **File:** `app/Services/CKBService.ts`
- **Symptom:** `TS2339: Property 'generatePrivateKey' does not exist on type '{ signRecoverable: ...; privateToPublic: ...; ... }'.`
- **Root cause:** The typed `@ckb-lumos/hd` module does not export `generatePrivateKey` despite it being present in documentation/examples.
- **Fix:** Replaced with Node's built-in crypto API:
  ```ts
  // Before
  const privateKey = hd.key.generatePrivateKey()
  // After
  const { randomBytes } = require('crypto')
  const privateKey = randomBytes(32).toString('hex')
  ```

---

## 8. Summary of Files Modified

| # | File | Change type |
|---|---|---|
| 1 | `package.json` | dep URL fix, TS/@types/node upgrade |
| 2 | `package-lock.json` | Removed (file deleted) |
| 3 | `tsconfig.json` | Added `skipLibCheck`, corrected `types` array |
| 4 | `routes/webhooks.ts` | Controller shorthand syntax |
| 5 | `app/Validators/PaymentWebhookValidator.ts` | Validator API fix |
| 6 | `app/Validators/SettingsGeneralValidator.ts` | Removed unused import |
| 7 | `app/Services/WithdrawalService.ts` | Removed unused `fees` |
| 8 | `app/Services/PayoutService.ts` | Renamed `_paystackId`; removed unused MONIEPOINT fields |
| 9 | `app/Services/SseService.ts` | Removed unused `heartbeatTimer` |
| 10 | `app/Services/PaymentIndexerService.ts` | Removed unused import |
| 11 | `app/Services/FileUploadService.ts` | `file.mimetype` → `file.type` (3x) |
| 12 | `app/Services/CKBService.ts` | Switched to `crypto.randomBytes` |
| 13 | `app/Middleware/Auth.ts` | Removed unused `token` |
| 14 | `app/Controllers/Http/PaymentStatusController.ts` | Removed unused import |
| 15 | `app/Controllers/Http/ShopBuilderController.ts` | Removed unused import |
| 16 | `app/Controllers/Http/AuthUserController.ts` | Removed dead method, null→undefined, type cast, unused imports removed |
| 17 | `app/Controllers/Http/CryptoNetworkController.ts` | Removed unused import |
| 18 | `.adonisrc.json` | Added `metaFiles` to copy rc file into production build |
| 19 | `vercel.json` | Created to set `outputDirectory` to `build` for Vercel |

---

After applying all fixes:
- Run `yarn run build` locally to ensure zero TypeScript errors.
- Push to Vercel and confirm the `yarn run build` step succeeds.

---

## 10. Render Deployment via Docker

**Date:** 2026-07-02  
**Goal:** Provide a production-ready Docker setup for deploying to Render.

### 10.1 Files added
- `Dockerfile` — multi-stage build using `node:20-alpine`, installs dependencies, compiles AdonisJS with `--ignore-ts-errors`, installs production deps, and runs `server.js`.
- `docker-compose.yml` — local test harness mapping port `3335`.
- `render.yaml` — Render service definition mapping Dockerfile to a web service on port `3335`.
- `.dockerignore` — excludes `node_modules`, `build`, `.env`, and other non-essential files from the Docker build context.

### 10.2 Notes
- Render sets the `PORT` env var at runtime; AdonisJS reads `process.env.PORT` automatically.
- `APP_KEY` should be generated via Render's `generateValue` feature rather than committed.
- Sensitive values (`PG_*`, `EMAIL_*`, `JWT_KEY`, etc.) should be marked `sync: false` in `render.yaml` and configured directly in the Render dashboard.

### 10.3 Deploy steps
1. Push repo to GitHub/GitLab.
2. In Render, create a new **Web Service**.
3. Connect repo; Render auto-detects `Dockerfile`.
4. Set the Docker start command if needed: `node server.js`.
5. Add environment variables from `render.yaml` via the Render dashboard.
6. Deploy.
