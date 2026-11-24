/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShortLinkForm } from './ShortLinkForm';
import type { ShortLinkPerson } from './ShortLinkPerson';
export type ShortLink = {
  state: 'own' | 'moved' | 'deleted';
  id: string;
  name: string;
  olderNames: Array<string>;
  destination: string | null;
  form: ShortLinkForm;
  clicks: number;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  owner: ShortLinkPerson;
  oldAccount: {
    username: string;
    otherUnclaimed: number;
  } | null;
  movedTo: string | null;
};

