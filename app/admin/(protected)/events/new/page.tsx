"use client";

import { useFormState, useFormStatus } from "react-dom";
import TiptapEditor from "@/components/admin/TiptapEditor";
import CoverImageInput from "@/components/admin/CoverImageInput";
import { createEvent } from "../actions";

export const dynamic = "force-dynamic";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-white font-medium disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create"}
    </button>
  );
}

export default function NewEventPage() {
  const [state, formAction] = useFormState(createEvent, null);

  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl font-serif mb-6">New event</h2>

      {state && !state.ok && (
        <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <form action={formAction} className="space-y-4" encType="multipart/form-data">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input name="title" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input name="event_date" type="datetime-local" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Price (USD)</span>
          <input name="price_dollars" type="number" min="0" step="0.01" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <TiptapEditor name="description_html" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cover image</span>
          <CoverImageInput name="cover_image" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Status</span>
          <select name="status" defaultValue="draft" className="mt-1 w-full rounded border border-gray-300 px-3 py-2">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <SubmitButton />
      </form>
    </div>
  );
}
