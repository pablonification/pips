import { useSyncExternalStore } from 'react';
import { IconCentang } from '~/components/icons/centang';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTutup } from '~/components/icons/tutup';
import { IconButton } from './IconButton';
import { GARIS_STRINGS } from './strings';
import { toast, type ToastItem } from './toast-store';

function Item({ t }: { t: ToastItem }) {
  return (
    <div
      className={t.tone === 'error' ? 'g-toast error' : 'g-toast'}
      role={t.tone === 'error' ? 'alert' : 'status'}
    >
      <span className="msg">
        <span className="t-ic">
          {t.tone === 'error' ? (
            <IconPeringatan size={16} />
          ) : (
            <IconCentang size={16} />
          )}
        </span>
        <span>{t.message}</span>
      </span>
      {t.action ? (
        <button
          type="button"
          className="act"
          onClick={() => {
            t.action!.onClick();
            toast.dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      ) : null}
      {t.tone === 'error' ? (
        <IconButton
          label={GARIS_STRINGS.close}
          size="sm"
          onClick={() => toast.dismiss(t.id)}
        >
          <IconTutup size={16} />
        </IconButton>
      ) : null}
    </div>
  );
}

/**
 * Where toasts appear (garis.css `.toast`): bottom centre, above the tab bar on phones, following the theme.
 * Each success is a polite status; each error is an alert and stay until dismissed. Mount once, in the app shell.
 */
export function Toaster() {
  const items = useSyncExternalStore(toast.subscribe, toast.get, toast.get);
  return (
    <div className="g-toasts">
      {items.map((t) => (
        <Item key={t.id} t={t} />
      ))}
    </div>
  );
}
