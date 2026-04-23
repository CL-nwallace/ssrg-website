export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export type ValidatedImage = {
  file: File;
  extension: "jpg" | "png" | "webp";
};

export function validateImage(file: File | null): ValidatedImage | { error: string } {
  if (!file || file.size === 0) {
    return { error: "No file uploaded." };
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { error: "Image must be JPEG, PNG, or WebP." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image must be 8 MB or smaller." };
  }

  const extension =
    file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  return { file, extension };
}

export function uuidFilename(ext: string): string {
  return `${crypto.randomUUID()}.${ext}`;
}
