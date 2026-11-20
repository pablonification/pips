/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormScale } from './FormScale';
export type FormQuestion = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'rating' | 'date' | 'time' | 'file';
  description?: string;
  options?: Array<string>;
  other?: boolean;
  scale?: FormScale;
  dependsOn?: {
    questionId: string;
    value: string;
  };
  optional?: boolean;
  prefill?: 'fullName' | 'nim';
};

