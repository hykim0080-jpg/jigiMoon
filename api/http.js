// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Response helpers and the static-asset loader for the Cloudflare Pages Functions in /functions/api.
import { ApiError } from './core.js';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=3600'
};

export const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: HEADERS });

// read the Navigator's own data files from the same deployment
export const assetLoader = (env, request) => async path => {
  const res = await env.ASSETS.fetch(new URL(path, request.url));
  if (!res.ok) throw new ApiError(502, `could not read ${path} (${res.status})`);
  return res.json();
};

export async function handle(fn) {
  try { return json(await fn()); }
  catch (e) {
    if (e instanceof ApiError) return json({ error: e.message, ...e.extra }, e.status);
    return json({ error: 'internal error' }, 500);
  }
}
