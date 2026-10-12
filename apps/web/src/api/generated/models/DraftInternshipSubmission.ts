/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InternshipAnswer } from './InternshipAnswer';
import type { InternshipKesibukan } from './InternshipKesibukan';
export type DraftInternshipSubmission = {
  kelas: string;
  idLine: string;
  pengalamanOrganisasi?: string;
  kesibukan?: Array<InternshipKesibukan>;
  choices: Array<{
    divisionId: string;
    priorityOrder: number;
    answers: Array<InternshipAnswer>;
  }>;
};

