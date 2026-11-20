/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type FormSummary = {
  total: number;
  audience: number;
  questions: Array<{
    questionId: string;
    label: string;
    type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'rating' | 'date' | 'time' | 'file';
    answered: number;
    counts?: Array<{
      value: string;
      count: number;
    }>;
    average?: number | null;
    texts?: Array<string>;
    files?: Array<{
      url: string;
      name: string;
    }>;
  }>;
};

