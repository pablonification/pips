/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NimFinderResult } from '../models/NimFinderResult';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class UserFinderService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @returns NimFinderResult Members whose NIM or name contains the search (taken literally), closest NIM matches first, at most 30. Only name, NIM, programme and photo.
   * @throws ApiError
   */
  public getUser({
    search,
  }: {
    search: string,
  }): CancelablePromise<Array<NimFinderResult>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/user/nim',
      query: {
        'search': search,
      },
      errors: {
        400: `Bad request`,
        404: `User not found`,
      },
    });
  }
}
