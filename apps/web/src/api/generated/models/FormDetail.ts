/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormSection } from './FormSection';
import type { FormStatus } from './FormStatus';
import type { ProfileField } from './ProfileField';
export type FormDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  eligibleAngkatan: Array<number>;
  opensAt: string;
  closesAt: string | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  requestedFields: Array<ProfileField>;
  allowEdit: boolean;
  sections: Array<FormSection> | null;
  status: FormStatus;
  thanks: string | null;
  owner: {
    fullName: string;
  } | null;
  canChange: boolean;
};

