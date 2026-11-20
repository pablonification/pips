/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormAnswer } from './FormAnswer';
import type { ProfileValues } from './ProfileValues';
export type FormResponse = {
  id: string;
  formId: string;
  userId: string;
  answers: Array<FormAnswer>;
  profile: ProfileValues;
  submittedAt: string;
  updatedAt: string | null;
};

