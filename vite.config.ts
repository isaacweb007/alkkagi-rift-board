import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

/**
 * Three.js creates the global DefaultLoadingManager while its module is being
 * evaluated. Recent Three.js versions also create an AbortController in that
 * constructor. Cloudflare Workers forbid that operation at module scope, even
 * when the arena itself is marked browser-only, because the SSR chunk can be
 * preloaded by the production runtime.
 *
 * Keep the public Three.js API intact while deferring the AbortController until
 * a loader actually asks for it in the browser. The getter is also safe for a
 * custom LoadingManager and the existing abort() setter continues to work.
 */
function cloudflareSafeThreeLoadingManager(): Plugin {
  const eagerController = "this.abortController = new AbortController();";
  const lazyController = `let abortController;
\t\tObject.defineProperty( this, 'abortController', {
\t\t\tconfigurable: true,
\t\t\tget() {
\t\t\t\treturn abortController ??= new AbortController();
\t\t\t},
\t\t\tset( value ) {
\t\t\t\tabortController = value;
\t\t\t}
\t\t} );`;

  return {
    name: "cloudflare-safe-three-loading-manager",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/node_modules/three/") || !code.includes(eagerController)) {
        return null;
      }

      // Only the constructor occurrence is eager. The second occurrence lives
      // inside abort() and must remain an ordinary controller replacement.
      return code.replace(eagerController, lazyController);
    },
  };
}

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      cloudflareSafeThreeLoadingManager(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
