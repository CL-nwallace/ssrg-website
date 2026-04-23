"use client";

import { useFormState, useFormStatus } from "react-dom";
import TiptapEditor from "@/components/admin/TiptapEditor";
import CoverImageInput from "@/components/admin/CoverImageInput";
import { updateEvent } from "../actions";

type Props = {
  event: {
    id: string;
    title: string;
    event_date: string;
    price_cents: number;
    description_html: string;
    status: "draft" | "published";
    coverUrl: string | null;
  };
};

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-white font-medium disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export default function EditEventForm({ event }: Props) {
  const action = updateEvent.bind(null, event.id);
  const [state, formAction] = useFormState(action, null);

  return (
    <>
      {state && !state.ok && (
        <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <form action={formAction} className="space-y-4" encType="multipart/form-data">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input name="title" defaultValue={event.title} required className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input
            name="event_date"
            type="datetime-local"
            defaultValue={toLocalDateTimeInput(event.event_date)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Price (USD)</span>
          <input
            name="price_dollars"
            type="number"
            min="0"
            step="0.01"
            defaultValue={(event.price_cents / 100).toFixed(2)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <TiptapEditor name="description_html" initialHtml={event.description_html} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cover image</span>
          <CoverImageInput name="cover_image" initialUrl={event.coverUrl} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Status</span>
          <select
            name="status"
            defaultValue={event.status}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <SubmitButton />
      </form>
    </>
  );
}
