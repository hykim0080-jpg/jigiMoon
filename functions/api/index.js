// GET /api — usage
import { USAGE } from '../../api/core.js';
import { json } from '../../api/http.js';

export const onRequestGet = () => json(USAGE);
