/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ListProgrammeWindows } from '../models/ListProgrammeWindows';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ProgrammeWindowService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * The programme windows and campaigns open now for the signed-in member, on the server's clock.
   * @returns ListProgrammeWindows Windows open for you
   * @throws ApiError
   */
  public listProgrammeWindows(): CancelablePromise<ListProgrammeWindows> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/programme-windows',
      errors: {
        401: `Error`,
      },
    });
  }
}
