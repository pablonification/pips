/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormAccess } from './FormAccess';
import type { FormManageStatus } from './FormManageStatus';
export type ManageFormListItem = {
  id: string;
  slug: string;
  title: string;
  status: FormManageStatus;
  eligibleAngkatan: Array<number>;
  opensAt: string | null;
  closesAt: string | null;
  questionCount: number;
  responseCount: number;
  owner: {
    id: string;
    fullName: string;
    nim: string;
    picture: string | null;
  } | null;
  access: FormAccess;
  updatedAt: string;
};

