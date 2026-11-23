import { aplikasi as copy } from '~/copy/aplikasi';
import { fill } from '~/copy/fill';
import { rel } from '~/lib/dates';

/**
 * A connected app's line: what it may do, when it was connected and last used. "Hanya baca · Terhubung kemarin ·
 * Terakhir dipakai 40 menit lalu", or "Baca dan ubah · … · Belum dipakai".
 */
export function appLine(
  app: {
    connectedAt: string | Date;
    lastUsedAt: string | Date | null;
    scopes: readonly string[];
  },
  now: number = Date.now(),
) {
  const akses = app.scopes.includes('pips.write') ? copy.ubah : copy.baca;
  const sejak = fill(copy.sejak, { tanggal: rel(app.connectedAt, now) });
  const dipakai = app.lastUsedAt
    ? fill(copy.dipakai, { tanggal: rel(app.lastUsedAt, now) })
    : copy.belumDipakai;
  return `${akses} · ${sejak} · ${dipakai}`;
}

/** The MCP address members add in their app: the API's own address and `/mcp`. */
export function mcpAddress(apiUrl: string | undefined, origin: string) {
  const base = (apiUrl || origin).replace(/\/+$/, '');
  return `${base}/mcp`;
}

/** The hosts whose apps PIPS! knows by their mark. Only a host proven by every sign-in (the API's `returnHost`). */
const MARKS: Record<string, 'claude' | 'chatgpt'> = {
  'claude.ai': 'claude',
  'chatgpt.com': 'chatgpt',
  'chat.openai.com': 'chatgpt',
};

/** Which mark a connected app shows, by the host its sign-ins return to; null keeps the link icon. */
export function appMark(returnHost: string | null | undefined) {
  return (returnHost && MARKS[returnHost]) || null;
}
