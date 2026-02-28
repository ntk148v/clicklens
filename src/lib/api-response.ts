import { NextResponse } from "next/server";

export interface ApiResponse<T> {
  success: boolean;
  data?: T | null;
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export function successResponse<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
  });
}

export function errorResponse(
  error: unknown,
  defaultMessage = "An unexpected error occurred"
): NextResponse<ApiResponse<null>> {
  console.error("API Error:", error);

  let errorDetails;
  
  const err = error as { code?: number; message?: string; type?: string; userMessage?: string };

  if (err && typeof err === 'object' && err.type && err.message) {
    errorDetails = {
      code: err.code || 500,
      message: err.message,
      type: err.type,
      userMessage: err.userMessage || err.message,
    };
  } else {
    errorDetails = {
      code: 500,
      message: error instanceof Error ? error.message : String(error),
      type: "INTERNAL_ERROR",
      userMessage: defaultMessage,
    };
  }

  return NextResponse.json(
    {
      success: false,
      error: errorDetails,
      // data is omitted, which is fine for optional property
    },
    { status: 500 }
  );
}

export function unauthorizedResponse(message = "Not authenticated"): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 401,
        message,
        type: "AUTH_REQUIRED",
        userMessage: "Please log in first",
      },
    },
    { status: 401 }
  );
}
