import { useEffect } from 'react';
// Straight from their files, not the barrel: /login is the first page a new member loads, and the barrel's chunk
// brings the overlays' dialog library along.
import { Button } from '~/components/garis/Button';
import { HmifLogo } from '~/components/garis/HmifLogo';
import { Wordmark } from '~/components/garis/Wordmark';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconUlang } from '~/components/icons/ulang';
import { common } from '~/copy/common';
import { masuk as copy } from '~/copy/masuk';
import useLogin from '~/hooks/auth/useLogin';
import { TestLoginForm } from './TestLoginForm';

const MESSAGES = {
  'bukan-anggota': copy.bukanAnggota,
  gagal: copy.gagal,
  'popup-diblokir': copy.popupDiblokir,
} as const;

/**
 * Sign-in (`/login`, outside the shell; no locked design, OPEN-QUESTIONS D3): the official logo and the wordmark as
 * the desktop sidebar shows them, the page title, one gold Masuk dengan Google, and what went wrong right below it.
 * Staging builds add the test login.
 */
export function LoginScreen({ redirectTo }: { redirectTo: string | null }) {
  const { login, retry, pending, problem, devLogin } = useLogin(redirectTo);

  useEffect(() => {
    document.title = `${copy.judul} · ${common.app.name}`;
  }, []);

  return (
    <div className="grid min-h-dvh place-items-center bg-app px-5 py-10 text-fg">
      <main id="isi" className="grid w-full max-w-100 gap-6">
        <div className="g-side-brand">
          <HmifLogo width={54} />
          <div>
            <Wordmark size={20} />
            <p className="sub">{common.app.org}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <h1 className="t-display-l" tabIndex={-1}>
            {copy.judul}
          </h1>
          <p className="t-body text-fg-2">{copy.isi}</p>
        </div>
        <div className="grid gap-3">
          <Button
            variant="gold"
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) login();
            }}
          >
            {pending ? copy.memproses : copy.google}
          </Button>
          <div role="alert" className="empty:hidden">
            {problem ? (
              <div className="grid gap-3">
                <p className="g-err t-sm">
                  <IconPeringatan size={16} />
                  {MESSAGES[problem]}
                </p>
                {problem === 'gagal' ? (
                  <Button
                    variant="paper"
                    size="sm"
                    className="justify-self-start"
                    onClick={retry}
                  >
                    <IconUlang size={16} />
                    {common.actions.cobaLagi}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {__TEST_LOGIN_ENABLED__ ? (
          <TestLoginForm
            onSubmit={(c) => devLogin.mutate(c)}
            pending={devLogin.isPending || devLogin.isSuccess}
            error={devLogin.error}
          />
        ) : null}
      </main>
    </div>
  );
}
