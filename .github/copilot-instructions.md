<!-- .github/copilot-instructions.md -->
# Quick instructions for AI coding agents

This repository is a Next.js 14 self-hosted Wix app template (Custom Shipping Rates). The goal of these notes is to get an AI coding agent immediately productive by calling out the project's architecture, conventions, critical developer workflows, and concrete examples.

Keep the guidance concise and always reference the exact files below when making changes.

1) Big picture
 - Next.js 14 app using the App Router. Server and client code live in `src/app/`.
 - Wix integration: code uses both the Wix Dashboard SDK and the Wix JavaScript SDK. Server-side requests use `src/app/utils/wix-sdk.ts` and client-only SDK helper is `src/app/utils/wix-sdk.client-only.ts`.
 - No DB included: app-data actions are stubbed in `src/app/actions/app-data.ts` and return test data via `src/app/utils/mocks-server.ts`.
 - Shipping Rates SPI and webhooks are implemented as API routes under `src/app/api/` (look at `src/app/api/shipping-rates/v1/getRates/route.ts` and `src/app/api/webhooks/v1/*`).

2) Where to change server vs client logic
 - Server actions are supported but disabled by default. To move logic to server actions, uncomment the top line `// 'use server';` in `src/app/actions/app-data.ts` and `src/app/actions/orders.ts` and redeploy.
 - If server actions are disabled, server-like code is implemented in API routes and utilities such as `createSdk` in `src/app/utils/wix-sdk.ts` which expects an access token.

3) Auth / tokens / middleware
 - Environment variables required: `WIX_APP_ID`, `WIX_APP_SECRET`, `WIX_APP_JWT_KEY` (see `next.config.js` and `.env.template`).
 - `src/middleware.ts` will copy an `accessToken` URL param into the `Authorization` header for requests. This is used by client-side flows that proxy requests to server logic.

4) SDK usage patterns and examples
 - For server-side SDK: `createSdk(accessToken)` in `src/app/utils/wix-sdk.ts` returns a `@wix/sdk` client with `orders` and `products` modules.
   Example: `src/app/actions/orders.ts` calls `createSdk(accessToken).orders.searchOrders(...)` and then maps results to `OrderSummary`.
 - For client-side only UI interactions inside the Wix dashboard iframe, use `useSDK()` in `src/app/utils/wix-sdk.client-only.ts`. It guards against SSR and iframe absence.

5) Mocks & testing shortcuts
 - The project includes `src/app/utils/mocks-server.ts` with `getTestOrders()` and `getTestingShippingAppData()`; code paths often check `isTestingToken(accessToken)` to switch to mocks (see `src/app/actions/orders.ts`).
 - Playwright is configured for E2E and screenshot tests. Scripts:
   - `npm run dev` — dev server (Next.js experimental https flag is used)
   - `npm run build` / `npm run start` — build/start
   - `npm run e2e` — runs Playwright tests
   - `npm run e2e:update` — update snapshots
 - CI workflows for Netlify and Vercel live in `.github/workflows/{netlify-e2e.yml,vercel-e2e.yml}` — they expect `ci.config.json` to include provider site names or a `deploymentUrl` input.

6) Project-specific conventions and patterns
 - Path alias `@/` is configured in `tsconfig.json` and used throughout imports (e.g. `@/app/actions/orders`). Use this alias for consistency.
 - Error handling style: prefer graceful fallbacks (see `getLastOrders` which logs and returns an empty array on failure).
 - Strict TypeScript is enabled. Keep exported shapes in `src/app/types/` (for example `src/app/types/order.ts` and `src/app/types/app-data.model.ts`). Update types when changing external shapes.
 - Keep bundle size down: prefer server-side code (server actions / API routes) for heavy SDK usage. Client helpers like `wix-sdk.client-only.ts` explicitly avoid initializing SDK during SSR.

7) Quick editing checklist for common tasks
 - Add a server API that calls Wix SDK: modify/create `src/app/api/.../route.ts`, use `createSdk(authorizationHeader)` and map results to project types.
 - Add dashboard UI: update `src/app/dashboard/page.tsx` and `src/app/dashboard/parts/*`. Use `useSDK()` for dashboard-hosted interactions.
 - Add tests: put Playwright tests under `tests/e2e/` and update screenshots under `tests/e2e/__screenshots__/` when `npm run e2e:update` is used in CI.

8) Files to inspect first when assigned a change
 - `README.md` — high-level project goals and local dev steps
 - `package.json` — scripts (dev, build, test, e2e)
 - `next.config.js` and `.env.template` — env var wiring
 - `src/app/utils/wix-sdk.ts` and `src/app/utils/wix-sdk.client-only.ts` — SDK initialization patterns
 - `src/app/actions/*.ts` — server/client action patterns and the optional server-action toggle
 - `src/app/utils/mocks-server.ts` — sample responses used in tests and local dev
 - `.github/workflows/*.yml` — CI expectations for E2E and screenshot updates

9) When making changes, be explicit in PR descriptions about:
 - Whether server actions were enabled/disabled (and why)
 - Any environment variable changes required
 - If snapshots were updated (Playwright screenshot baseline)

If anything in these notes is unclear or you want additional examples (for example, a minimal API route template that calls the Wix SDK and maps types), tell me which example you'd like and I will add it.
