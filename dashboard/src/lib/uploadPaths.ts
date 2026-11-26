/** The largest file the upload routes accept. */
export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** A file name made safe for a storage path. */
export function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export const UPLOAD_BUCKETS = ["studio-files", "project-media"] as const;

const FOLDER_RE = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i;

/** Folder inside a bucket: plain path segments only, no "..", no leading slash. */
export function isSafeFolder(folder: string) {
  return folder.length <= 200 && FOLDER_RE.test(folder);
}

/** Object path produced by the uploader: safe folder + generated file name. */
export function isSafeObjectPath(path: string) {
  const index = path.lastIndexOf("/");
  if (index <= 0) return false;
  const folder = path.slice(0, index);
  const file = path.slice(index + 1);
  return isSafeFolder(folder) && /^[0-9]{10,}-[a-z0-9]+\.[a-z0-9]{1,10}$/i.test(file);
}

export function isUploadBucket(bucket: string): bucket is (typeof UPLOAD_BUCKETS)[number] {
  return (UPLOAD_BUCKETS as readonly string[]).includes(bucket);
}
