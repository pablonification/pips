/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShortLinkNameProblem } from './ShortLinkNameProblem';
export type ShortLinkNameCheck = {
  name: string;
  available: boolean;
  problem: ShortLinkNameProblem;
  heldAs: string | null;
  heldBy: 'link' | 'form' | null;
};

