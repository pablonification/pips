import { useSyncExternalStore } from 'react';
import { IconCentang } from '~/components/icons/centang';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTutup } from '~/components/icons/tutup';
import { IconButton } from './IconButton';
import { common } from '~/copy/common';
import { toast, type ToastItem } from './toast-store';

function Item({ t }: { t: ToastItem }) {
  return (
    <div className={t.tone === 'error' ? 'g-toast error' : 'g-toast'}>
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
          label={common.actions.tutup}
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
 * Mount once, in the app shell. Two live regions are always in the page, like the prototype's one `#toast`
 * (SPEC "Accessibility": toasts announced): errors in an assertive one, successes in a polite one. A toast is added
 * inside them, so screen readers read each new one once. They carry `aria-live` themselves, so they stay readable
 * while a dialog hides the rest of the page.
 */
export function Toaster() {
  const items = useSyncExternalStore(toast.subscribe, toast.get, toast.get);
  return (
    <div className="g-toasts">
      <div
        className="g-toast-region"
        aria-live="assertive"
        aria-relevant="additions text"
      >
        {items
          .filter((t) => t.tone === 'error')
          .map((t) => (
            <Item key={t.id} t={t} />
          ))}
      </div>
      <div
        className="g-toast-region"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {items
          .filter((t) => t.tone !== 'error')
          .map((t) => (
            <Item key={t.id} t={t} />
          ))}
      </div>
    </div>
  );
}
