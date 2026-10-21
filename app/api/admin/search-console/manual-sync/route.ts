import { NextResponse } from "next/server";

export async function POST() {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/cron/search-console-sync`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`,
            },
        });

        // Try to parse JSON safely
        let data: any = {};
        try {
            data = await res.json();
        } catch {
            data = { error: "No JSON returned", status: res.status };
        }

        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
