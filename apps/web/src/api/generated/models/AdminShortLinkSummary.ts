/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShortLinkPerson } from './ShortLinkPerson';
import type { ShortLinkSummary } from './ShortLinkSummary';
export type AdminShortLinkSummary = (ShortLinkSummary & {
  owner: ShortLinkPerson;
  oldAccount: string | null;
});

