/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShortLinkNameProblem } from './ShortLinkNameProblem';
export type ShortLinkProblem = {
  error: string;
  problem?: ShortLinkNameProblem;
  heldAs?: string;
  heldBy?: 'link' | 'form';
  destination?: 'invalid' | 'self';
};

