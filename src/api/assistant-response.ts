/**
 * Standardized response envelope for assistant tool endpoints.
 * Optimized for LLM tool-calling: typed payloads, predictable errors.
 */

export type AssistantSuccessResponse<T> = {
  ok: true;
  data: T;
  meta?: {
    count?: number;
    limit?: number;
    offset?: number;
    [key: string]: unknown;
  };
};

export type AssistantErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type AssistantResponse<T> = AssistantSuccessResponse<T> | AssistantErrorResponse;

export function success<T>(data: T, meta?: AssistantSuccessResponse<T>["meta"]): AssistantSuccessResponse<T> {
  return { ok: true, data, ...(meta && { meta }) };
}

export function failure(
  code: string,
  message: string,
  details?: Record<string, unknown>
): AssistantErrorResponse {
  return { ok: false, error: { code, message, ...(details && { details }) } };
}

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
