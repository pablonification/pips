/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShortLinkSummary } from './ShortLinkSummary';
export type ShortLinkList = {
  links: Array<ShortLinkSummary>;
  total: number;
  claim: {
    open: boolean;
    until: string | null;
  };
};

