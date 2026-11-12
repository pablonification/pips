import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { refetchFailed } from '../src/api/reconnect';

/*
 * A page that failed while offline loads by itself when the connection returns: the pages on screen whose data
 * failed are asked again. Pages that loaded, and failures no page shows any more, are left alone.
 */
test('back online, the failed queries on screen are asked again, and only those', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let online = false;
  const calls: Record<string, number> = { form: 0, kredit: 0, old: 0 };
  const fn = (key: string) => async () => {
    calls[key]++;
    if (!online && key !== 'kredit') throw new Error('offline');
    return key;
  };
  const watch = (key: string) => {
    const o = new QueryObserver(qc, { queryKey: [key], queryFn: fn(key) });
    return o.subscribe(() => undefined);
  };
  const stopForm = watch('form');
  const stopKredit = watch('kredit');
  const stopOld = watch('old');
  await new Promise((r) => setTimeout(r, 10));
  stopOld();
  assert.equal(qc.getQueryState(['form'])?.status, 'error');
  assert.equal(qc.getQueryState(['kredit'])?.status, 'success');

  online = true;
  await refetchFailed(qc);
  assert.equal(qc.getQueryState(['form'])?.status, 'success');
  assert.deepEqual(calls, { form: 2, kredit: 1, old: 1 });
  stopForm();
  stopKredit();
  qc.clear();
});
