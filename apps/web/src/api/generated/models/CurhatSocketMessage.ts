/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CurhatSocketMessage = {
  id: string;
  chatroomId: string;
  replyId: string | null;
  content: string;
  createdAt: string;
  isSender: boolean;
  clientMessageId: string | null;
  reply?: {
    id: string;
    chatroomId: string;
    replyId: string | null;
    content: string;
    createdAt: string;
  };
};

