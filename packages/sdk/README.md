# @workspace/sdk

Protocol code shared by the API and the web app. Today: the shared-spec constants
and field helpers. Next: commitments, Merkle witnesses, proof generation and the
chain client (`chain/`, owned by @koxyG).

```ts
import { MAX_ALLOCATIONS, generateSecret } from "@workspace/sdk"
```

- **Source-only.** There is no build step; Bun and Vite import the TypeScript directly.
- **Runs in Bun and in the browser.** Use Web APIs only (`crypto.getRandomValues`,
  `TextEncoder`), never `node:` or `bun:` modules outside tests.
- **Mirrors the circuits.** Constants match `shield-contracts/circuits/lib`; change
  both sides together.

```bash
bun test
```
