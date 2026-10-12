/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormStatus } from './FormStatus';
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
  status: FormStatus;
  sectionCount: number;
};

