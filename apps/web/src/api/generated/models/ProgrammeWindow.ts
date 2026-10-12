/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ProgrammeWindow = {
  id: string;
  slug: string;
  kind: 'programme' | 'campaign';
  label: string;
  /**
   * An app path (starting with /) or an https:// address
   */
  route: string;
  opensAt: string;
  closesAt: string | null;
};

