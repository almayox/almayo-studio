/**
 * Works out what a client did on a campaign since the studio last looked.
 * The studio's visits are stored in the activity record itself, as events of
 * kind SEEN_EVENT, so no extra "last seen" column is needed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignEvent } from "@/lib/types";

/** Name the dashboard signs its own events with. */
const STUDIO_ACTOR = "Studio";
/** Logged when the studio opens a campaign that has unseen client activity. */
export const SEEN_EVENT = "studio_viewed";

type EventLike = Pick<CampaignEvent, "kind" | "actor_name">;

/** Client events newer than the studio's last visit. `events` must be newest first. */
export function unseenClientEvents<T extends EventLike>(events: T[]): T[] {
  const unseen: T[] = [];
  for (const event of events) {
    if (event.kind === SEEN_EVENT) break;
    if (event.actor_name !== STUDIO_ACTOR) unseen.push(event);
  }
  return unseen;
}

/**
 * Number of unseen client events per campaign, for the campaigns that have any.
 * Returns an empty object when the activity table does not exist yet.
 */
export async function unseenCountsByCampaign(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("campaign_events")
    .select("campaign_id, kind, actor_name")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return {};

  const byCampaign = new Map<string, EventLike[]>();
  for (const row of data) {
    const list = byCampaign.get(row.campaign_id) ?? [];
    list.push(row);
    byCampaign.set(row.campaign_id, list);
  }
  const counts: Record<string, number> = {};
  for (const [campaignId, events] of byCampaign) {
    const unseen = unseenClientEvents(events).length;
    if (unseen) counts[campaignId] = unseen;
  }
  return counts;
}
