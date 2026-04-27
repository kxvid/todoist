import { NextResponse } from "next/server";
import { checkPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { password } = body;
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }
  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  return NextResponse.json({ token: password });
}
