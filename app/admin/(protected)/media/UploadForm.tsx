"use client";

export default function UploadForm({ category }: { category: string }) {
  return (
    <form action="/admin/media/upload" method="post" encType="multipart/form-data" className="flex items-center gap-3">
      <input type="hidden" name="category" value={category} />
      <input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
        className="text-sm"
      />
      <button
        type="submit"
        className="rounded bg-black px-3 py-1.5 text-sm text-white"
      >
        Upload
      </button>
    </form>
  );
}
