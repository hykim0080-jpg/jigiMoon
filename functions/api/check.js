// GET /api/check?site=<id>&date=YYYY-MM-DD[&mission=14|6][&mast=m][&sun=%&earth=%&dark=h] — see api/core.js
import { check } from '../../api/core.js';
import { assetLoader, handle } from '../../api/http.js';

export const onRequestGet = ({ request, env }) => {
  const url = new URL(request.url);
  return handle(() => check(assetLoader(env, request), url.searchParams, url.origin));
};
