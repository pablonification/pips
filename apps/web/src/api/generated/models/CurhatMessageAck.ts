/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CurhatSocketError } from './CurhatSocketError';
import type { CurhatSocketMessage } from './CurhatSocketMessage';
export type CurhatMessageAck = ({
  ok: boolean;
  message: CurhatSocketMessage;
} | {
  ok: boolean;
  error: CurhatSocketError;
});

