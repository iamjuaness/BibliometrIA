import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const flowiseUrl = process.env.FLOWISE_API_URL || "http://localhost:3000/api/v1/prediction/8e8ea8f5-42dc-4e78-8e6f-e83315dde5d8";
    const response = await fetch(flowiseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in Flowise proxy:", error);
    return NextResponse.json(
      { error: "Error communicating with the prediction engine." },
      { status: 500 }
    );
  }
}
