export type ReviewMedia = {
  id: string;
  url: string;
  video: boolean;
  /** Link to the original file; only present once the files are released. */
  downloadUrl: string | null;
};

export type ReviewPost = {
  id: string;
  title: string;
  caption: string | null;
  hashtags: string | null;
  publish_date: string | null;
  /** Platforms this post goes to; null when not stated. */
  platforms: string | null;
  type: string;
  approval_status: string;
  media: ReviewMedia[];
};

export type ReviewComment = {
  id: string;
  asset_id: string;
  author_name: string;
  body: string | null;
  audio_url: string | null;
  from_studio: boolean;
  created_at: string;
};

export type ReviewCampaign = {
  title: string;
  clientName: string | null;
  /** The client's logo, shown as the profile picture. */
  clientLogo: string | null;
  month: string;
  platforms: string | null;
  note: string | null;
  status: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** True when the client may download the original files. */
  released: boolean;
};
