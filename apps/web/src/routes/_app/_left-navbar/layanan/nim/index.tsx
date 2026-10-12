import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { api } from '~/api/client';
import SearchIcon from '~/assets/icons/textfield/search.svg';
import HeaderTitle from '~/components/header-title';
import { TextField } from '~/components/ui/textfield';
import { DEBOUNCE_TIME } from '~/lib/constants';
import { querySearchSchema } from '~/lib/search-params';
import { NimResults } from './-components/nim-results';

export const Route = createFileRoute('/_app/_left-navbar/layanan/nim/')({
  component: NimFinderPage,
  // `q` is the redesign's search param (P1-A links people results here); today's screen keeps its own state.
  validateSearch: (search) => querySearchSchema.parse(search),
});

function NimFinderPage() {
  const timeoutRef = useRef<number | null>(null);

  const [search, setSearch] = useState<string>('');

  const { data: searchResult } = useQuery({
    queryKey: ['nim', search],
    queryFn: () => api.userFinder.getUser({ search }),
    enabled: search.length > 2,
  });

  return (
    <div className="flex size-full h-screen flex-col overflow-hidden">
      <div className="hidden w-full bg-white lg:block">
        <HeaderTitle />
      </div>

      <main className="flex size-full max-h-screen flex-col items-center gap-3 overflow-hidden bg-[url(/img/login/login-bg.jpg)] px-5 md:bg-[url(/img/login/login-bg-desktop.jpg)] lg:px-[52px]">
        <h1 className="mt-[50px] mb-3 text-4xl text-white italic">
          <span className="font-bold not-italic">NIM</span> Finder
        </h1>

        <TextField
          type="text"
          placeholder="Ketik nama atau NIM"
          onChange={(e) => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            setTimeout(() => setSearch(e.target.value), DEBOUNCE_TIME);
          }}
          className="h-12 w-full rounded-lg font-semibold"
          name="search"
        >
          <img src={SearchIcon} className="size-4" />
        </TextField>

        <p className="text-center text-body-lg text-white">
          {searchResult && `Menampilkan ${searchResult.length} hasil`}
        </p>

        <NimResults results={searchResult ?? []} />
      </main>
    </div>
  );
}
