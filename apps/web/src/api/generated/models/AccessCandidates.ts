/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormPerson } from './FormPerson';
export type AccessCandidates = {
  people: Array<{
    person: FormPerson;
    isPengurus: boolean;
    role: 'owner' | 'view' | 'edit' | null;
  }>;
};

