// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// GET /api/sites — the 12 candidate sites with ids for /api/check
import { listSites } from '../../api/core.js';
import { assetLoader, handle } from '../../api/http.js';

export const onRequestGet = ({ request, env }) => handle(() => listSites(assetLoader(env, request)));
