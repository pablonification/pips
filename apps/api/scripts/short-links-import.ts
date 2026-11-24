/**
 * Moves the old s.hmif.dev (Lynx) into PIPS!: its links and accounts, from `mongoexport` JSON, in one transaction
 * (docs/adr/0024-*). It can run again: keyed by Lynx ids, it adds what is new, updates a link changed on the old
 * service only when PIPS! hasn't changed it, adds only the clicks that grew, and never undoes a claim.
 *
 *   DATABASE_URL=… tsx scripts/short-links-import.ts --links links.json --accounts accounts.json --dry-run
 *   DATABASE_URL=… tsx scripts/short-links-import.ts --links links.json --accounts accounts.json [--list]
 *   DATABASE_URL=… tsx scripts/short-links-import.ts --forget-passwords
 *
 * `--dry-run` does everything and rolls it back, printing counts only. `--list` also prints the names no browser can
 * open and the links that don't lead to an http(s) address. `--forget-passwords` deletes the old accounts' password
 * hashes once claiming has ended (`SHORTLINK_CLAIM_UNTIL`). It reads `DATABASE_URL` from the environment only, never a
 * `.env` file, so it can't reach a database nobody named. It never prints a password, a hash or an email.
 */
import fs from 'node:fs';
import postgres from 'postgres';
import { createId } from '../src/db/schema';
import {
  foldName,
  isSafeDestination,
  nameProblem,
  nimFromAccount,
  unreachableReason,
} from '../src/lib/short-link';

// Reading mongoexport.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** mongoexport's Extended JSON, plain: `{"$oid": …}`, `{"$date": …}` and `{"$numberInt": …}` become their values. */
function plain(v: Json): unknown {
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') {
    if ('$oid' in v) return String(v.$oid);
    if ('$date' in v) {
      const d = v.$date;
      const raw =
        d && typeof d === 'object' && !Array.isArray(d) && '$numberLong' in d
          ? Number(d.$numberLong)
          : (d as string | number);
      return new Date(raw);
    }
    for (const k of ['$numberInt', '$numberLong', '$numberDouble'])
      if (k in v) return Number(v[k]);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

/** A mongoexport file: one document per line (its default), or one array (`--jsonArray`). */
export function readExport(text: string): Array<Record<string, unknown>> {
  const t = text.trim();
  if (!t) return [];
  const docs: Json[] = t.startsWith('[')
    ? (JSON.parse(t) as Json[])
    : t
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as Json);
  return docs.map((d) => plain(d) as Record<string, unknown>);
}

export interface LynxLink {
  lynxId: string;
  slug: string;
  destination: string;
  author: string | null;
  createdAt: Date;
  modifiedAt: Date;
  visits: number;
}

export interface LynxAccount {
  lynxId: string;
  username: string;
  email: string | null;
  passwordHash: string | null;
  twoFactor: boolean;
}

const str = (v: unknown) =>
  v === null || v === undefined ? null : String(v as string);
const date = (v: unknown, fallback: Date) => {
  const d = v instanceof Date ? v : v ? new Date(String(v as string)) : null;
  return d && !Number.isNaN(d.getTime()) ? d : fallback;
};

export function toLinks(docs: Array<Record<string, unknown>>, now: Date) {
  return docs.map((d): LynxLink => {
    const createdAt = date(d.creationDate, now);
    return {
      lynxId: String((d.id ?? d._id) as string),
      slug: String((d.slug ?? '') as string),
      destination: String((d.destination ?? '') as string),
      author: str(d.author),
      createdAt,
      modifiedAt: date(d.modifiedDate, createdAt),
      visits: Math.max(0, Math.trunc(Number(d.visits ?? 0)) || 0),
    };
  });
}

/** Two-step sign-in is on when the field is true, or holds a secret or an `enabled: true`. Its secret is never kept. */
function twoFactorOn(v: unknown) {
  if (v === true) return true;
  if (typeof v === 'string') return v !== '' && v !== 'false';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return o.enabled === true || (!('enabled' in o) && !!o.secret);
  }
  return false;
}

export function toAccounts(docs: Array<Record<string, unknown>>) {
  return docs.map((d): LynxAccount => ({
    lynxId: String((d.id ?? d._id) as string),
    username: String((d.username ?? '') as string),
    email: str(d.email),
    passwordHash: str(d.password),
    twoFactor: twoFactorOn(d.twoFactorAuthentication),
  }));
}

// The import.

export interface ImportReport {
  links: number;
  accounts: number;
  accountsWithLinks: number;
  linksAdded: number;
  linksUpdated: number;
  clicksAdded: number;
  changedOnBothSides: number;
  /** A link whose name another PIPS! link or form already holds exactly: left out. */
  nameHeld: number;
  accountsAdded: number;
  accountsUpdated: number;
  matchedByEmail: { accounts: number; links: number };
  matchedByNim: { accounts: number; links: number };
  unmatched: { accounts: number; links: number };
  twoFactor: number;
  namesBreakingRule: number;
  twinPairs: number;
  unreachable: number;
  nonHttp: number;
  hashes: Record<string, number>;
  inPipsNotInExport: number;
  unreachableNames: Array<{ name: string; why: string }>;
  nonHttpLinks: Array<{ name: string; destination: string }>;
}

export interface ImportOptions {
  sql: postgres.Sql;
  links: LynxLink[];
  accounts: LynxAccount[];
  dryRun: boolean;
  /** Hashes are not kept for new accounts once claiming has ended. */
  claimClosed: boolean;
}

class RollBack extends Error {}

export async function importShortLinks(
  opts: ImportOptions,
): Promise<ImportReport> {
  const { links, accounts } = opts;
  const report: ImportReport = {
    links: links.length,
    accounts: accounts.length,
    accountsWithLinks: new Set(links.map((l) => l.author).filter(Boolean)).size,
    linksAdded: 0,
    linksUpdated: 0,
    clicksAdded: 0,
    changedOnBothSides: 0,
    nameHeld: 0,
    accountsAdded: 0,
    accountsUpdated: 0,
    matchedByEmail: { accounts: 0, links: 0 },
    matchedByNim: { accounts: 0, links: 0 },
    unmatched: { accounts: 0, links: 0 },
    twoFactor: accounts.filter((a) => a.twoFactor).length,
    namesBreakingRule: links.filter((l) => nameProblem(l.slug) !== null).length,
    twinPairs: 0,
    unreachable: 0,
    nonHttp: 0,
    hashes: {},
    inPipsNotInExport: 0,
    unreachableNames: [],
    nonHttpLinks: [],
  };
  const folds = new Map<string, number>();
  for (const l of links)
    folds.set(foldName(l.slug), (folds.get(foldName(l.slug)) ?? 0) + 1);
  for (const n of folds.values()) if (n > 1) report.twinPairs += n - 1;
  for (const l of links) {
    const why = unreachableReason(l.slug);
    if (why) report.unreachableNames.push({ name: l.slug, why });
    if (!isSafeDestination(l.destination))
      report.nonHttpLinks.push({ name: l.slug, destination: l.destination });
  }
  report.unreachable = report.unreachableNames.length;
  report.nonHttp = report.nonHttpLinks.length;
  for (const a of accounts) {
    const m = a.passwordHash?.match(/^\$(2[abxy]?)\$(\d\d)\$/);
    const key = m
      ? `$${m[1]}$ cost ${m[2]}`
      : a.passwordHash
        ? 'other'
        : 'none';
    report.hashes[key] = (report.hashes[key] ?? 0) + 1;
  }

  try {
    await opts.sql.begin(async (tx) => {
      // Accounts.
      const accountIds = new Map<string, string>();
      for (const a of accounts) {
        const nim = nimFromAccount(a.email, a.username);
        const [found] = await tx<
          Array<{
            id: string;
            claimed_by: string | null;
            password_hash: string | null;
          }>
        >`select id, claimed_by, password_hash from short_link_accounts where lynx_id = ${a.lynxId}`;
        if (!found) {
          const id = createId();
          await tx`
            insert into short_link_accounts (id, lynx_id, username, email, nim, password_hash, two_factor)
            values (${id}, ${a.lynxId}, ${a.username}, ${a.email}, ${nim},
                    ${opts.claimClosed ? null : a.passwordHash}, ${a.twoFactor})`;
          accountIds.set(a.lynxId, id);
          report.accountsAdded++;
        } else {
          // A claimed account's hash is no longer needed; a deleted one stays deleted.
          const hash =
            found.claimed_by === null && found.password_hash !== null
              ? a.passwordHash
              : found.password_hash;
          await tx`
            update short_link_accounts set username = ${a.username}, email = ${a.email}, nim = ${nim},
              password_hash = ${hash}, two_factor = ${a.twoFactor}, updated_at = now()
            where id = ${found.id}`;
          accountIds.set(a.lynxId, found.id);
          report.accountsUpdated++;
        }
      }

      // Links.
      for (const l of links) {
        const accountId = l.author ? (accountIds.get(l.author) ?? null) : null;
        const [found] = await tx<
          Array<{
            id: string;
            updated_at: Date | string;
            lynx_modified_at: Date | string | null;
            lynx_visits: number | null;
            deleted_at: Date | null;
            account_id: string | null;
            name: string | null;
          }>
        >`select l.id, l.updated_at, l.lynx_modified_at, l.lynx_visits, l.deleted_at, l.account_id, n.name
          from short_links l left join short_link_names n on n.link_id = l.id and n.is_current
          where l.lynx_id = ${l.lynxId}`;
        if (found) {
          const grew = Math.max(0, l.visits - (found.lynx_visits ?? 0));
          report.clicksAdded += grew;
          await tx`
            update short_links set clicks = clicks + ${grew}, lynx_visits = ${l.visits},
              account_id = coalesce(account_id, ${accountId})
            where id = ${found.id}`;
          // A Date, or a string when the client is shared with drizzle (which turns off the driver's date parsing).
          const ms = (v: Date | string) => new Date(v).getTime();
          const lynxChanged =
            !found.lynx_modified_at ||
            l.modifiedAt.getTime() > ms(found.lynx_modified_at);
          const pipsUnchanged =
            !!found.lynx_modified_at &&
            ms(found.updated_at) === ms(found.lynx_modified_at);
          if (!lynxChanged || found.deleted_at) continue;
          if (!pipsUnchanged) {
            report.changedOnBothSides++;
            continue;
          }
          if (found.name !== l.slug) {
            try {
              await tx.savepoint(async (sp) => {
                await sp`select short_link_set_name(${found.id}, ${l.slug}, true)`;
              });
            } catch {
              report.nameHeld++;
              continue;
            }
          }
          await tx`
            update short_links set destination = ${l.destination}, updated_at = ${l.modifiedAt.toISOString()}::timestamptz,
              lynx_modified_at = ${l.modifiedAt.toISOString()}::timestamptz
            where id = ${found.id}`;
          report.linksUpdated++;
          continue;
        }
        const [held] =
          await tx`select 1 from short_link_names where name = ${l.slug}`;
        if (held || l.slug === '') {
          report.nameHeld++;
          continue;
        }
        const [owner] = accountId
          ? await tx<
              Array<{ claimed_by: string | null }>
            >`select claimed_by from short_link_accounts where id = ${accountId}`
          : [];
        const id = createId();
        await tx`
          insert into short_links (id, destination, owner_id, account_id, lynx_id, lynx_visits, lynx_modified_at,
            clicks, created_at, updated_at)
          values (${id}, ${l.destination}, ${owner?.claimed_by ?? null}, ${accountId}, ${l.lynxId}, ${l.visits},
            ${l.modifiedAt.toISOString()}::timestamptz, ${l.visits}, ${l.createdAt.toISOString()}::timestamptz, ${l.modifiedAt.toISOString()}::timestamptz)`;
        // An old name that differs only in capitals from one already here keeps working by its exact name.
        await tx`
          insert into short_link_names (name, link_id, is_current, holds_fold, created_at)
          values (${l.slug}, ${id}, true,
            not exists (select 1 from short_link_names where folded = lower(${l.slug}) and holds_fold),
            ${l.createdAt.toISOString()}::timestamptz)`;
        report.linksAdded++;
      }

      // Matching: an unclaimed account whose email is a member's, then whose NIM is.
      const matches = await tx<
        Array<{ account_id: string; user_id: string; via: 'email' | 'nim' }>
      >`select distinct on (a.id) a.id as account_id, u.id as user_id,
               case when lower(a.email) = lower(u.email) then 'email' else 'nim' end as via
        from short_link_accounts a
        join users u on lower(a.email) = lower(u.email) or a.nim = u.nim
        where a.claimed_by is null
        order by a.id, (lower(a.email) = lower(u.email)) desc`;
      for (const m of matches) {
        await tx`
          update short_link_accounts set claimed_by = ${m.user_id}, claimed_at = now(), claimed_via = ${m.via},
            updated_at = now()
          where id = ${m.account_id} and claimed_by is null`;
        await tx`
          update short_links set owner_id = ${m.user_id}, updated_at = updated_at
          where account_id = ${m.account_id} and owner_id is null and deleted_at is null`;
      }
      const byVia = await tx<
        Array<{ via: string | null; accounts: number; links: number }>
      >`select a.claimed_via as via, count(distinct a.id)::int as accounts, count(l.id)::int as links
        from short_link_accounts a left join short_links l on l.account_id = a.id
        where a.lynx_id = any(${accounts.map((a) => a.lynxId)})
        group by a.claimed_via`;
      for (const r of byVia) {
        const n = { accounts: r.accounts, links: r.links };
        if (r.via === 'email') report.matchedByEmail = n;
        else if (r.via === 'nim') report.matchedByNim = n;
        else if (r.via === null) report.unmatched = n;
      }
      const [gone] = await tx<Array<{ n: number }>>`
        select count(*)::int as n from short_links
        where lynx_id is not null and not (lynx_id = any(${links.map((l) => l.lynxId)}))`;
      report.inPipsNotInExport = gone.n;

      if (opts.dryRun) throw new RollBack();
    });
  } catch (err) {
    if (!(err instanceof RollBack)) throw err;
  }
  return report;
}

/** Deletes every old account's password hash. Refused while claiming is still open. */
export async function forgetPasswords(
  sql: postgres.Sql,
  claimUntil: Date | undefined,
  now: Date,
) {
  if (!claimUntil || now < claimUntil)
    throw new Error(
      'Claiming is still open (SHORTLINK_CLAIM_UNTIL is unset or later): the passwords are still needed',
    );
  const rows = await sql`
    update short_link_accounts set password_hash = null, updated_at = now()
    where password_hash is not null returning id`;
  return rows.length;
}

/** The report as printed: counts, and with `list` the names no browser opens and the links that aren't http(s). */
export function formatReport(r: ImportReport, dryRun: boolean, list: boolean) {
  const lines = [
    dryRun ? 'Dry run: nothing was written.' : 'Imported.',
    `Links in the export: ${r.links} (added ${r.linksAdded}, updated ${r.linksUpdated}, clicks added ${r.clicksAdded})`,
    `Accounts in the export: ${r.accounts}, ${r.accountsWithLinks} with links (added ${r.accountsAdded}, updated ${r.accountsUpdated})`,
    `Matched by email: ${r.matchedByEmail.accounts} accounts, ${r.matchedByEmail.links} links`,
    `Matched by NIM: ${r.matchedByNim.accounts} accounts, ${r.matchedByNim.links} links`,
    `Unmatched (to claim): ${r.unmatched.accounts} accounts, ${r.unmatched.links} links`,
    `Accounts with two-step sign-in (an admin moves their links): ${r.twoFactor}`,
    `Names breaking the rule (kept as they are): ${r.namesBreakingRule}`,
    `Names differing only in capitals from another: ${r.twinPairs}`,
    `Names no browser can open: ${r.unreachable}`,
    `Links not to an http(s) address (never redirected): ${r.nonHttp}`,
    `Left out, name already held in PIPS!: ${r.nameHeld}`,
    `Changed on both sides since the last import (PIPS! kept): ${r.changedOnBothSides}`,
    `In PIPS! but gone from the export: ${r.inPipsNotInExport}`,
    `Password hashes: ${Object.entries(r.hashes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k}: ${n}`)
      .join(', ')}`,
  ];
  if (list) {
    for (const u of r.unreachableNames)
      lines.push(`  unreachable: ${JSON.stringify(u.name)} (${u.why})`);
    for (const n of r.nonHttpLinks)
      lines.push(
        `  not http(s): ${JSON.stringify(n.name)} → ${JSON.stringify(n.destination)}`,
      );
  }
  return lines.join('\n');
}

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      'DATABASE_URL is required (it is never read from a .env file)',
    );
  const claimUntilRaw = process.env.SHORTLINK_CLAIM_UNTIL;
  const claimUntil = claimUntilRaw ? new Date(claimUntilRaw) : undefined;
  const now = new Date();
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    if (process.argv.includes('--forget-passwords')) {
      const n = await forgetPasswords(sql, claimUntil, now);
      console.log(`Deleted ${n} password hashes.`);
      return;
    }
    const linksFile = arg('--links');
    const accountsFile = arg('--accounts');
    if (!linksFile || !accountsFile)
      throw new Error(
        'usage: --links links.json --accounts accounts.json [--dry-run] [--list]',
      );
    const dryRun = process.argv.includes('--dry-run');
    const report = await importShortLinks({
      sql,
      links: toLinks(readExport(fs.readFileSync(linksFile, 'utf8')), now),
      accounts: toAccounts(readExport(fs.readFileSync(accountsFile, 'utf8'))),
      dryRun,
      claimClosed: !!claimUntil && now >= claimUntil,
    });
    console.log(formatReport(report, dryRun, process.argv.includes('--list')));
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && /short-links-import\.ts$/.test(process.argv[1])) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
