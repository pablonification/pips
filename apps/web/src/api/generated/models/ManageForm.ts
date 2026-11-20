/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormAccess } from './FormAccess';
import type { FormManageStatus } from './FormManageStatus';
import type { FormSection } from './FormSection';
import type { ProfileField } from './ProfileField';
export type ManageForm = {
  id: string;
  slug: string;
  slugCustom: boolean;
  title: string;
  description: string | null;
  sections: Array<FormSection>;
  requestedFields: Array<ProfileField>;
  eligibleAngkatan: Array<number>;
  opensAt: string | null;
  closesAt: string | null;
  isActive: boolean;
  allowEdit: boolean;
  thanks: string | null;
  status: FormManageStatus;
  publishedAt: string | null;
  owner: {
    id: string;
    fullName: string;
    nim: string;
    picture: string | null;
  } | null;
  access: FormAccess;
  responseCount: number;
  audience: number;
  createdAt: string;
  updatedAt: string;
};

