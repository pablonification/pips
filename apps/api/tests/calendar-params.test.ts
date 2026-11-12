import { strict as assert } from 'node:assert';
import { mock, test } from 'node:test';
import { currentWibMonthYear } from '../src/lib/wib';
import { PersonalCalendarParamSchema } from '../src/types/calendar.types';

test('this month in WIB, whatever the server time zone', () => {
  // 30 September 2026, 18.00 UTC is already 1 October 01.00 WIB.
  assert.deepEqual(currentWibMonthYear(Date.UTC(2026, 8, 30, 18)), {
    month: 10,
    year: 2026,
  });
  assert.deepEqual(currentWibMonthYear(Date.UTC(2026, 8, 30, 16)), {
    month: 9,
    year: 2026,
  });
  assert.deepEqual(currentWibMonthYear(Date.UTC(2026, 11, 31, 17)), {
    month: 1,
    year: 2027,
  });
});

// The default must be read per request: a default read once when the module loads (`new Date().getMonth() + 1`)
// would make a server started in September answer September for the rest of its life.
test('a request without month or year gets the month it is made in, not the month the server started', () => {
  mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 8, 15, 5) });
  try {
    assert.deepEqual(PersonalCalendarParamSchema.parse({}), {
      month: 9,
      year: 2026,
    });
    mock.timers.setTime(Date.UTC(2026, 9, 8, 6));
    assert.deepEqual(PersonalCalendarParamSchema.parse({}), {
      month: 10,
      year: 2026,
    });
  } finally {
    mock.timers.reset();
  }
});

test('month and year from the query are kept and checked', () => {
  assert.deepEqual(
    PersonalCalendarParamSchema.parse({ month: '2', year: '2025' }),
    { month: 2, year: 2025 },
  );
  assert.equal(
    PersonalCalendarParamSchema.safeParse({ month: '13' }).success,
    false,
  );
});

test('a year past what a date can hold is refused, not sent to the database', () => {
  for (const year of ['999999', '10000', '0']) {
    assert.equal(
      PersonalCalendarParamSchema.safeParse({ month: '1', year }).success,
      false,
      year,
    );
  }
  assert.equal(
    PersonalCalendarParamSchema.parse({ month: '1', year: '9999' }).year,
    9999,
  );
});
