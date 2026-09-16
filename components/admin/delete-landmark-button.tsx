"use client";

import { useState } from "react";

export function DeleteLandmarkButton({ id }: { id: string }) {
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        const confirmed = window.confirm(
            "Are you sure you want to delete this landmark?"
        );

        if (!confirmed) return;

        setDeleting(true);

        try {
            const response = await fetch("/api/admin/landmarks", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id }),
            });

            if (!response.ok) {
                throw new Error("Failed to delete landmark");
            }

            window.location.reload();
        } catch (error) {
            console.error(error);
            alert("Failed to delete landmark.");
            setDeleting(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
        >
            {deleting ? "Deleting..." : "Delete"}
        </button>
    );
}