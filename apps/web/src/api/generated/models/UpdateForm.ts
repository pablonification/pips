/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormSection } from './FormSection';
import type { ProfileField } from './ProfileField';
export type UpdateForm = {
  title?: string;
  description?: string | null;
  sections?: Array<FormSection>;
  requestedFields?: Array<ProfileField>;
  eligibleAngkatan?: Array<number>;
  opensAt?: string | null;
  closesAt?: string | null;
  allowEdit?: boolean;
  thanks?: string | null;
  confirmBreaking?: boolean;
};

