/** In Vite dev, use same-origin `/api` (see vite.config proxy → companion :3001). Otherwise call companion directly. */
export const API_BASE = import.meta.env.DEV ? '/api' : 'http://localhost:3001/api';
