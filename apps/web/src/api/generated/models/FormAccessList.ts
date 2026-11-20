/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormPerson } from './FormPerson';
export type FormAccessList = {
  owner: {
    id: string;
    fullName: string;
    nim: string;
    picture: string | null;
  } | null;
  people: Array<{
    person: FormPerson;
    role: 'view' | 'edit';
  }>;
};

