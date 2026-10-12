/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormSection } from './FormSection';
import type { FormStatus } from './FormStatus';
export type FormDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  eligibleAngkatan: Array<number>;
  sections: Array<FormSection> | null;
  opensAt: string;
  closesAt: string | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  status: FormStatus;
};

