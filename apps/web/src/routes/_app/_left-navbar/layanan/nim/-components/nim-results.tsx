import type { NimFinderResult } from '~/api/generated';
import UserInfo from '~/components/user/user-info';

/** NIM Finder's result rows: name, programme, photo and NIM, keyed by NIM (the API sends no id). */
export function NimResults({ results }: { results: NimFinderResult[] }) {
  return (
    <ul className="flex w-full flex-col gap-3 overflow-auto pb-28 lg:pb-6">
      {results.map((user) => (
        <div
          key={user.nim}
          className="flex w-full items-center justify-between rounded-lg bg-white p-3 lg:px-5"
        >
          <UserInfo
            name={user.fullName}
            nameClassName="leading-tight text-body-md"
            email={
              user.major === 'IF'
                ? 'Teknik Informatika'
                : 'Sistem dan Teknologi Informasi'
            }
            emailClassName="text-body-sm mt-1"
            imageURL={user.picture}
            avatarClassName="size-10"
          />
          <p className="self-end pl-1.5 text-xs text-muted-foreground lg:text-body-md">
            {user.nim}
          </p>
        </div>
      ))}
    </ul>
  );
}
