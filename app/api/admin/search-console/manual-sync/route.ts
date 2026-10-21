import { NextResponse } from "next/server";

export async function POST() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/cron/search-console-sync`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`,
        },
    });

    const data = await res.json();
    return NextResponse.json(data);
}
