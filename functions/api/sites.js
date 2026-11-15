// GET /api/sites — the 12 candidate sites with ids for /api/check
import { listSites } from '../../api/core.js';
import { assetLoader, handle } from '../../api/http.js';

export const onRequestGet = ({ request, env }) => handle(() => listSites(assetLoader(env, request)));
