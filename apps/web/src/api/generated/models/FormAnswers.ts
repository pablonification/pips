/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormAnswer } from './FormAnswer';
import type { ProfileValues } from './ProfileValues';
export type FormAnswers = {
  responses: Array<{
    id: string;
    number: number;
    submittedAt: string;
    updatedAt: string | null;
    profile: ProfileValues;
    answers: Array<FormAnswer>;
  }>;
  total: number;
  page: number;
  limit: number;
};

