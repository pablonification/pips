import { arrayOf, literal, number, object, string } from './params';

// The member kept on the device, checked as it is read back (F2-004: plain checks instead of zod; `tests/params.test.ts`
// holds it to the zod schema it replaces). Unknown keys are dropped; a missing or wrong one makes it unreadable.
const userObject = object(
  {
    id: string,
    nim: string,
    email: string,
    fullName: string,
    major: literal('IF', 'STI'),
    region: literal('Ganesha', 'Jatinangor'),
    angkatan: number,
    gender: literal('F', 'M'),
    membershipStatus: string,
    picture: string,
    roles: arrayOf(string),
  },
  { strict: true },
);
export const userSchema = {
  parse: (input: unknown) => (input === null ? null : userObject.parse(input)),
};
