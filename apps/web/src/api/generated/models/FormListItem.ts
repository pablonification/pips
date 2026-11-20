/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormStatus } from './FormStatus';
import type { ProfileField } from './ProfileField';
export type FormListItem = {
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
  status: FormStatus;
  sectionCount: number;
};

