// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// GET /api — usage
import { USAGE } from '../../api/core.js';
import { json } from '../../api/http.js';

export const onRequestGet = () => json(USAGE);
