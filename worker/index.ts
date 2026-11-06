import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { allowsPublicForm, preflight } from '../lib/public-cors';

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (request.method === 'OPTIONS') return preflight(request, env.PUBLIC_FORM_ORIGIN);
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const secured = new Response(response.body, response);
    secured.headers.set('X-Content-Type-Options','nosniff');
    secured.headers.set('Referrer-Policy','same-origin');
    secured.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    const path = new URL(request.url).pathname;
    if(path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/')) {
      secured.headers.set('Cache-Control','no-store, private');
      secured.headers.set('Vary','Cookie, oai-authenticated-user-id');
    }
    if (request.method === 'POST' && allowsPublicForm(request, env.PUBLIC_FORM_ORIGIN)) {
      secured.headers.set('Access-Control-Allow-Origin', env.PUBLIC_FORM_ORIGIN!);
      secured.headers.append('Vary', 'Origin');
    }
    if(path === '/admin' || path.startsWith('/admin/')) {
      const frameAncestors = "'self' https://7madybar.github.io" + (import.meta.env.DEV ? ' http://localhost:5484' : '');
      secured.headers.set('Content-Security-Policy', 'frame-ancestors '+frameAncestors);
    }
    return secured;
  },
};

export default worker;
