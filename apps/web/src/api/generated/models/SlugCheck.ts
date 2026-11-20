/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SlugCheck = {
  slug: string;
  available: boolean;
  problem: 'too_short' | 'too_long' | 'characters' | 'hyphens' | 'taken' | null;
};

