import { supabase } from "@/lib/supabaseClient";

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
  const { data: { session }, error: sErr } = await supabase.auth.getSession();
  if (sErr) {
    const err = new Error(sErr.message);
    (err as any).code = "SESSION_READ_FAILED";
    throw err;
  }
  if (!session?.access_token) {
    const err = new Error("No active session / access_token");
    (err as any).code = "NO_SESSION";
    throw err;
  }

  const { data, error } = await supabase.functions.invoke<ApiResponse<T>>(
    functionName,
    {
      body: payload,
    }
  );

  if (error) {
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