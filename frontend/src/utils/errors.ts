import { ApiError } from "../services/api";

export function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}
