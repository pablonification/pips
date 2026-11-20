/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ListConnectedApps } from '../models/ListConnectedApps';
import type { OAuthApprove } from '../models/OAuthApprove';
import type { OAuthDecision } from '../models/OAuthDecision';
import type { OAuthRequest } from '../models/OAuthRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class OauthService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * An app asking to act as the signed-in member through MCP, as the consent page shows it. 404 once decided or expired.
   * @returns OAuthRequest The request
   * @throws ApiError
   */
  public getOAuthRequest({
    requestId,
  }: {
    /**
     * The id the consent page got in its address
     */
    requestId: string,
  }): CancelablePromise<OAuthRequest> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/oauth/requests/{requestId}',
      path: {
        'requestId': requestId,
      },
      errors: {
        404: `Error`,
      },
    });
  }
  /**
   * The member lets the app act as them, with the scopes they chose: only what the app asked for or fewer, and always reading. Answers where to send the browser: the app, with a code it exchanges once.
   * @returns OAuthDecision Approved
   * @throws ApiError
   */
  public approveOAuthRequest({
    requestId,
    requestBody,
  }: {
    /**
     * The id the consent page got in its address
     */
    requestId: string,
    requestBody?: OAuthApprove,
  }): CancelablePromise<OAuthDecision> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/oauth/requests/{requestId}/approve',
      path: {
        'requestId': requestId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `A scope the app did not ask for`,
        404: `Error`,
      },
    });
  }
  /**
   * The member refuses. Answers where to send the browser: the app, with error=access_denied.
   * @returns OAuthDecision Denied
   * @throws ApiError
   */
  public denyOAuthRequest({
    requestId,
  }: {
    /**
     * The id the consent page got in its address
     */
    requestId: string,
  }): CancelablePromise<OAuthDecision> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/oauth/requests/{requestId}/deny',
      path: {
        'requestId': requestId,
      },
      errors: {
        404: `Error`,
      },
    });
  }
  /**
   * The apps the signed-in member has connected through MCP and not revoked.
   * @returns ListConnectedApps Connected apps, newest first
   * @throws ApiError
   */
  public listConnectedApps(): CancelablePromise<ListConnectedApps> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/oauth/apps',
    });
  }
  /**
   * Revokes every token the member gave this app. 404 when it was not connected.
   * @returns any Revoked
   * @throws ApiError
   */
  public revokeConnectedApp({
    clientId,
  }: {
    /**
     * A connected app
     */
    clientId: string,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/api/oauth/apps/{clientId}',
      path: {
        'clientId': clientId,
      },
      errors: {
        404: `Error`,
      },
    });
  }
}
