/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SlugProblem = {
  error: string;
  problem: 'too_short' | 'too_long' | 'characters' | 'hyphens' | 'taken' | 'used';
  heldAs?: string;
  heldBy?: 'link' | 'form';
};

