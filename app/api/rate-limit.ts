import arcjet, { slidingWindow } from "@arcjet/next";
import { NextRequest, NextResponse } from "next/server";
import { setRateLimitHeaders } from "@arcjet/decorate";

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      interval: 30, // 30 second window
      max: 10, // 10 requests per interval
    }),
  ],
});

export async function rateLimitRequest(req: NextRequest) {

  const decision = await aj.protect(req);

  const response = NextResponse.next();
  setRateLimitHeaders(response, decision);

  if (decision.isDenied()) {
    return NextResponse.json(
      { error: "Too many requests" },
      { 
        status: 429,
        headers: response.headers,
      }
    );
  }

  return response;
}