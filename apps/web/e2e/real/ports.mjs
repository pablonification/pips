/** The web app and the API for `e2e:real`, each on its own port. Override with E2E_REAL_WEB_PORT and E2E_REAL_API_PORT. */
export const REAL_WEB_PORT = Number(process.env.E2E_REAL_WEB_PORT ?? 4690);
export const REAL_API_PORT = Number(process.env.E2E_REAL_API_PORT ?? 4691);
export const REAL_WEB_URL = `http://127.0.0.1:${REAL_WEB_PORT}`;
export const REAL_API_URL = `http://127.0.0.1:${REAL_API_PORT}`;
