import { NextResponse } from "next/server";
import { planTrip } from "@/lib/plan-trip";
import { getLearnedSafetyMargin, validResidualsFromRequest } from "@/lib/calibration";
import { getWebPush } from "@/lib/push-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isTripRequest } from "@/lib/validate-trip";

const CHECKPOINTS = [60, 30, 15] as const;

type BrowserSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

function isBrowserSubscription(value: unknown): value is BrowserSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as BrowserSubscription;
  try {
    const url = new URL(subscription.endpoint);
    const hostAllowed = url.protocol === "https:" && (
      url.hostname === "fcm.googleapis.com" ||
      url.hostname === "web.push.apple.com" ||
      url.hostname.endsWith(".push.services.mozilla.com") ||
      url.hostname.endsWith(".notify.windows.com")
    );
    const expirationValid = subscription.expirationTime === undefined || subscription.expirationTime === null ||
      (Number.isFinite(subscription.expirationTime) && subscription.expirationTime > 0 && subscription.expirationTime <= 8.64e15);
    const keysValid = typeof subscription.keys?.p256dh === "string" && /^[A-Za-z0-9_-]{20,256}$/.test(subscription.keys.p256dh) &&
      typeof subscription.keys?.auth === "string" && /^[A-Za-z0-9_-]{16,256}$/.test(subscription.keys.auth);
    return hostAllowed && !url.username && !url.password && !url.port && url.href.length <= 2048 && expirationValid && keysValid;
  } catch {
    return false;
  }
}

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send valid trip details." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Please send valid trip details." }, { status: 400 });
  }
  const input = body as { trip?: unknown; subscription?: unknown; timeZone?: unknown; historyResiduals?: unknown };
  if (!isTripRequest(input.trip) || !isBrowserSubscription(input.subscription) || !isTimeZone(input.timeZone)) {
    return NextResponse.json({ error: "A valid trip, notification permission, and time zone are required." }, { status: 400 });
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return NextResponse.json({ error: "Push notifications are not configured on the server yet." }, { status: 503 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase storage is not configured on the server yet." }, { status: 503 });
  }

  const historyResiduals = validResidualsFromRequest(input.historyResiduals);
  const calibration = getLearnedSafetyMargin(historyResiduals, input.trip.importance);
  const plan = await planTrip(input.trip, calibration);
  const leaveTime = Date.parse(plan.leaveAt);
  if (leaveTime <= Date.now()) {
    return NextResponse.json({ error: "This trip's recommended leave time has already passed." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Supabase storage is not configured on the server yet." }, { status: 503 });
  }

  const subscription = input.subscription;
  const { data: savedSubscription, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .upsert({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      expiration_time: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
      disabled_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" })
    .select("id")
    .single();

  if (subscriptionError || !savedSubscription) {
    console.error("Could not save push subscription", subscriptionError?.message);
    return NextResponse.json({ error: "Could not save this notification subscription." }, { status: 500 });
  }

  const { count: activeTripCount, error: countError } = await supabase.from("trips")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", savedSubscription.id)
    .eq("status", "active");
  if (countError) {
    return NextResponse.json({ error: "Could not check saved trips." }, { status: 500 });
  }
  if ((activeTripCount ?? 0) >= 20) {
    return NextResponse.json({ error: "This browser already has 20 active trips. Finish or cancel one before saving another." }, { status: 429 });
  }

  const trip = input.trip;
  const { data: savedTrip, error: tripError } = await supabase
    .from("trips")
    .insert({
      subscription_id: savedSubscription.id,
      origin_label: trip.origin.label,
      origin_lat: trip.origin.lat,
      origin_lon: trip.origin.lon,
      destination_label: trip.destination.label,
      destination_lat: trip.destination.lat,
      destination_lon: trip.destination.lon,
      arrive_by: trip.arriveBy,
      time_zone: input.timeZone,
      travel_mode: trip.mode,
      importance: trip.importance,
      fixed_buffer_minutes: plan.fixedBufferMinutes,
      recommended_leave_at: plan.leaveAt,
      estimated_duration_minutes: plan.durationMinutes,
      safety_margin_minutes: plan.safetyMarginMinutes,
      safety_margin_method: plan.safetyMarginMethod,
      safety_margin_sample_count: plan.safetyMarginSampleCount,
      weather_penalty_minutes: plan.weatherPenaltyMinutes,
      weather_status: plan.weatherStatus,
    })
    .select("id")
    .single();

  if (tripError || !savedTrip) {
    console.error("Could not save trip", tripError?.message);
    return NextResponse.json({ error: "Could not save this trip." }, { status: 500 });
  }

  const now = Date.now();
  const checkpoints = CHECKPOINTS.map((minutes) => {
    const scheduledAt = leaveTime - minutes * 60_000;
    return {
      trip_id: savedTrip.id,
      checkpoint_minutes: minutes,
      scheduled_at: new Date(scheduledAt).toISOString(),
      baseline_leave_at: plan.leaveAt,
      baseline_duration_minutes: plan.durationMinutes,
      baseline_weather_penalty_minutes: plan.weatherPenaltyMinutes,
      status: scheduledAt > now ? "pending" : "skipped",
    };
  });

  const { error: scheduleError } = await supabase.from("trip_rechecks").insert(checkpoints);
  if (scheduleError) {
    await supabase.from("trips").delete().eq("id", savedTrip.id);
    console.error("Could not schedule trip rechecks", scheduleError.message);
    return NextResponse.json({ error: "Could not schedule the trip reminders." }, { status: 500 });
  }

  const scheduledChecks = checkpoints.filter((checkpoint) => checkpoint.status === "pending").length;
  let confirmationSent = false;
  try {
    await getWebPush().sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    }, JSON.stringify({
      title: "Reminders are on",
      body: "LeaveWise will check your trip and send an update before you leave.",
      tripId: savedTrip.id,
      url: "/",
    }), { TTL: 300 });
    confirmationSent = true;
  } catch (error) {
    console.error("Could not send reminder confirmation", error instanceof Error ? error.message : "Unknown error");
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      const now = new Date().toISOString();
      await supabase.from("push_subscriptions").update({ disabled_at: now }).eq("id", savedSubscription.id);
      await supabase.from("trips").update({ status: "cancelled", updated_at: now }).eq("id", savedTrip.id);
      await supabase.from("trip_rechecks").update({ status: "cancelled", processed_at: now }).eq("trip_id", savedTrip.id).eq("status", "pending");
    }
  }

  return NextResponse.json({
    tripId: savedTrip.id,
    scheduledChecks,
    confirmationSent,
    message: confirmationSent
      ? `Reminders are on. You'll get ${scheduledChecks > 0 ? `${scheduledChecks} trip check${scheduledChecks === 1 ? "" : "s"} before you leave.` : "no further trip checks because the planned leave time is too close."}`
      : "Trip saved, but the confirmation notification could not be sent. Check notification settings before relying on reminders.",
  }, { status: 201 });
}
