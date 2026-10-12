/**
 * Generated images for the fixtures, so no test fetches a photo from Google or a CDN:
 * - `/__e2e__/avatar/<nim>.svg`: initials on a tinted circle (the prototype draws initials, not photos);
 * - `/__e2e__/media/poster-<id>.svg`: a 3:4 competition poster;
 * - `/__e2e__/media/<name>.svg`: a 4:3 post photo.
 */
import type { Route } from '@playwright/test';
import { initialsFor } from '../fixtures/api';

const TINTS = [
  '#E8C55F',
  '#9CC5A1',
  '#A9B8E0',
  '#E7A7A1',
  '#C9B2E3',
  '#F0C08A',
];
const tint = (key: string) =>
  TINTS[[...key].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function avatarSvg(nim: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${tint(nim)}"/><text x="48" y="58" font-family="sans-serif" font-size="34" font-weight="600" text-anchor="middle" fill="#1B1508">${esc(initialsFor(nim))}</text></svg>`;
}

export function mediaSvg(name: string): string {
  const poster = name.startsWith('poster-');
  const [w, h] = poster ? [600, 800] : [800, 600];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${tint(name)}"/><rect x="24" y="24" width="${w - 48}" height="${h - 48}" fill="none" stroke="#1B1508" stroke-width="4"/><text x="${w / 2}" y="${h / 2}" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#1B1508">${esc(name)}</text></svg>`;
}

export async function serveMedia(
  route: Route,
  pathname: string,
): Promise<void> {
  const m = /^\/__e2e__\/(avatar|media)\/([\w.-]+)\.svg$/.exec(pathname);
  if (!m)
    return route.fulfill({ status: 404, body: 'e2e: unknown fixture media' });
  const body = m[1] === 'avatar' ? avatarSvg(m[2]) : mediaSvg(m[2]);
  return route.fulfill({ status: 200, contentType: 'image/svg+xml', body });
}
