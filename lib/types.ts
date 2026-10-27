import type { AttachmentType } from "./files.ts";
import type { Mood } from "./moods.ts";
import type { Role } from "./permissions.ts";

export type Profile = {
  id: string;
  display_name: string;
  role: Role;
  language: "vi" | "en";
  theme: "light" | "dark" | "system";
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DiaryEntry = {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  mood: Mood | null;
  diary_date: string;
  created_at: string;
  updated_at: string;
};

export type DiaryAttachment = {
  id: string;
  diary_id: string;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  attachment_type: AttachmentType;
  duration_ms: number | null;
  created_at: string;
};

/** An attachment plus a short-lived signed URL for display/download. */
export type SignedAttachment = DiaryAttachment & { url: string | null; downloadUrl: string | null };

export type EntryListItem = Pick<DiaryEntry, "id" | "title" | "content" | "mood" | "diary_date" | "created_at"> & {
  diary_attachments: { attachment_type: AttachmentType }[];
};

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
