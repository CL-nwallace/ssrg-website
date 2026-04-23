"use client";

import { useState } from "react";

type Props = {
  name: string;
  initialUrl?: string | null;
};

export default function CoverImageInput({ name, initialUrl }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl ?? null);

  return (
    <div>
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Cover preview"
          className="mb-2 h-40 w-full rounded object-cover"
        />
      )}
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setPreviewUrl(URL.createObjectURL(file));
        }}
      />
    </div>
  );
}
