/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ShortLinkClaimLookup = {
  state: 'found' | 'empty' | 'taken' | 'mine' | 'two_factor';
  account: string;
  links: Array<{
    id: string;
    name: string;
    destination: string | null;
    clicks: number;
  }>;
  claimedAt: string | null;
  token: string | null;
};

