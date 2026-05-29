import { supabase } from "@/lib/supabaseClient";
import { FunctionsHttpError } from "@supabase/supabase-js";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: any };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export async function callFunction<T>(
  functionName: string,
  payload: any
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<ApiResponse<T>>(
    functionName,
    {
      body: payload,
    }
  );

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      const apiErr = body?.error;
      const err = new Error(apiErr?.message ?? error.message);
      (err as any).code = apiErr?.code ?? "FUNCTION_INVOKE_FAILED";
      (err as any).details = apiErr?.details;
      throw err;
    }
    const err = new Error(error.message);
    (err as any).code = "FUNCTION_INVOKE_FAILED";
    throw err;
  }

  if (!data) {
    const err = new Error("Empty response from function");
    (err as any).code = "EMPTY_RESPONSE";
    throw err;
  }

  if (!data.ok) {
    const err = new Error(data.error?.message ?? "Request failed");
    (err as any).code = data.error?.code ?? "UNKNOWN";
    (err as any).details = data.error?.details;
    throw err;
  }

  return data.data;
}