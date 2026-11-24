import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Avatar,
  Button,
  Checkbox,
  Modal,
  RowButton,
  RuledList,
  Searchbox,
  Tag,
  toast,
} from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconLonceng } from '~/components/icons/lonceng';
import { fill } from '~/copy/fill';
import { tautan as copy } from '~/copy/tautan';
import { useDebounced } from '~/features/layanan-svc/parts';
import { rankMembers } from '~/features/nim/rules';
import { initialsOf } from '~/lib/shell/names';
import {
  giveLink,
  keepLink,
  refreshAll,
  searchMembers,
  type Link,
} from './queries';

/**
 * "Berikan ke anggota" (a link nobody holds) or "Pindahkan" (someone's link): find the member by name or NIM, as NIM
 * Finder does, from 3 characters. An old account's other untaken links can go along. When the link is someone
 * else's, one line says they will be told by a notification.
 */
export function GiveDialog({
  link,
  open,
  onOpenChange,
  ownerTold,
}: {
  link: Link;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ownerTold: string | null;
}) {
  const client = useQueryClient();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<{ nim: string; name: string } | null>(null);
  // An old account's other links go along only while nobody holds this one.
  const others = link.owner ? 0 : (link.oldAccount?.otherUnclaimed ?? 0);
  const [all, setAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const term = useDebounced(q.trim(), 300);
  const found = useQuery({
    queryKey: ['short-links', 'members', term],
    queryFn: () => searchMembers(term),
    enabled: term.length >= 3,
    select: (rows) =>
      rankMembers(rows, term).filter((m) => m.nim !== link.owner?.nim),
  });
  const moving = !!link.owner;
  const g = copy.beri;

  const give = async () => {
    if (!pick || busy) return;
    setBusy(true);
    try {
      const r = await giveLink(link.id, pick.nim, others > 0 && all);
      keepLink(client, r.link as Link);
      void refreshAll(client);
      onOpenChange(false);
      toast.success(
        r.moved > 1
          ? fill(g.banyak, { jumlah: r.moved, pemilik: pick.name })
          : fill(g.satu, { nama: link.name, pemilik: pick.name }),
      );
    } catch {
      toast.error(g.gagal);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={fill(moving ? g.judulPindahkan : g.judulBerikan, {
        nama: link.name,
      })}
      footer={
        <>
          <Button variant="paper" onClick={() => onOpenChange(false)}>
            {copy.tautan.batal}
          </Button>
          <Button
            variant="gold"
            aria-disabled={!pick || busy || undefined}
            onClick={() => void give()}
          >
            {moving ? g.pindahkan : g.berikan}
          </Button>
        </>
      }
    >
      <Searchbox
        label={g.cari}
        placeholder={g.cari}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {term.length >= 3 ? (
        found.isError ? (
          <p className="t-cap text-fg-3" role="status">
            {g.gagalCari}
          </p>
        ) : !found.data || term !== q.trim() ? (
          <p className="t-cap text-fg-3" role="status">
            {g.mencari}
          </p>
        ) : found.data.length === 0 ? (
          <p className="t-cap text-fg-3" role="status">
            {fill(g.tidakAda, { q: term })}
          </p>
        ) : (
          <RuledList className="sl-give-res">
            {found.data.map((m) => {
              const on = pick?.nim === m.nim;
              return (
                <li key={m.nim}>
                  <RowButton
                    aria-pressed={on}
                    onClick={() =>
                      setPick(on ? null : { nim: m.nim, name: m.fullName })
                    }
                  >
                    <span className="g-svc-row">
                      <Avatar
                        initials={initialsOf(m.fullName)}
                        picture={m.picture}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block t-sub">{m.fullName}</span>
                        <span className="block t-cap text-fg-2 num">
                          {fill(g.nimProgram, {
                            nim: m.nim,
                            program: g.program[m.major],
                          })}
                        </span>
                      </span>
                      {on ? (
                        <Tag tone="success" icon={<IconCentang size={16} />}>
                          {g.dipilih}
                        </Tag>
                      ) : null}
                    </span>
                  </RowButton>
                </li>
              );
            })}
          </RuledList>
        )
      ) : null}
      {ownerTold ? (
        <p className="sl-note t-cap text-fg-3">
          <IconLonceng size={16} />
          <span>{fill(g.diberiTahu, { nama: ownerTold })}</span>
        </p>
      ) : null}
      {others > 0 && link.oldAccount ? (
        <Checkbox
          className="sl-all"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
        >
          {fill(g.jugaLainnya, {
            jumlah: others,
            akun: link.oldAccount.username,
          })}
        </Checkbox>
      ) : null}
    </Modal>
  );
}
