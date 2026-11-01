import { NextResponse } from "next/server";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { planTrip } from "@/lib/plan-trip";
import { getWebPush } from "@/lib/push-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Importance, TravelMode, TripRequest, WeatherStatus } from "@/lib/trip";

export const runtime = "nodejs";
export const maxDuration = 60;

type Recheck = {
  id: string;
  trip_id: string;
  checkpoint_minutes: number;
  baseline_leave_at: string;
  baseline_duration_minutes: number;
  baseline_weather_penalty_minutes: number;
  attempts: number;
};

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

function updateMessage(input: {
  oldLeaveAt: string;
  oldDuration: number;
  oldWeatherPenalty: number;
  destination: string;
  timeZone: string;
  plan: Awaited<ReturnType<typeof planTrip>>;
}) {
  const newLeave = Date.parse(input.plan.leaveAt);
  const earlierMinutes = Math.round((Date.parse(input.oldLeaveAt) - newLeave) / 60_000);
  if (newLeave <= Date.now()) {
    return { title: "Time to leave", body: `Head to ${input.destination} now to stay on time.` };
  }
  if (earlierMinutes > 0) {
    if (input.plan.durationMinutes > input.oldDuration) {
      return { title: "Traffic is heavier", body: `Leave ${earlierMinutes} min earlier to stay on time.` };
    }
    if (input.plan.weatherPenaltyMinutes > input.oldWeatherPenalty) {
      return { title: "Rain could slow you down", body: `Leave ${earlierMinutes} min earlier to stay on time.` };
    }
    return { title: "Your trip changed", body: `Leave ${earlierMinutes} min earlier to stay on time.` };
  }
  if (earlierMinutes < 0) {
    return { title: "Good news, traffic improved", body: `Your updated leave time is ${formatTime(input.plan.leaveAt, input.timeZone)}.` };
  }
  return { title: "You're on track", body: `Leave at ${formatTime(input.plan.leaveAt, input.timeZone)} for ${input.destination}.` };
}

async function processRecheck(admin: ReturnType<typeof getSupabaseAdmin>, check: Recheck) {
  const { data: trip, error: tripError } = await admin.from("trips").select("*").eq("id", check.trip_id).single();
  if (tripError || !trip || trip.status !== "active") {
    await admin.from("trip_rechecks").update({ status: "cancelled", processed_at: new Date().toISOString() }).eq("id", check.id);
    return "cancelled" as const;
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,disabled_at")
    .eq("id", trip.subscription_id)
    .single();
  if (subscriptionError || !subscription || subscription.disabled_at) {
    await admin.from("trip_rechecks").update({ status: "cancelled", processed_at: new Date().toISOString() }).eq("id", check.id);
    return "cancelled" as const;
  }

  const tripRequest: TripRequest = {
    origin: { label: trip.origin_label, lat: trip.origin_lat, lon: trip.origin_lon },
    destination: { label: trip.destination_label, lat: trip.destination_lat, lon: trip.destination_lon },
    arriveBy: trip.arrive_by,
    mode: trip.travel_mode as TravelMode,
    importance: trip.importance as Importance,
    fixedBufferMinutes: trip.fixed_buffer_minutes,
  };
  const learnedSafetyMargin = trip.safety_margin_method === "learned"
    ? { minutes: trip.safety_margin_minutes, sampleCount: trip.safety_margin_sample_count }
    : undefined;
  const plan = await planTrip(tripRequest, learnedSafetyMargin);
  const adminTimeZone = trip.time_zone || "UTC";
  const message = updateMessage({
    oldLeaveAt: check.baseline_leave_at,
    oldDuration: check.baseline_duration_minutes,
    oldWeatherPenalty: check.baseline_weather_penalty_minutes,
    destination: trip.destination_label,
    timeZone: adminTimeZone,
    plan,
  });

  const planPassed = Date.parse(plan.leaveAt) <= Date.now();
  const { error: updateTripError } = await admin.from("trips").update({
    recommended_leave_at: plan.leaveAt,
    estimated_duration_minutes: plan.durationMinutes,
    safety_margin_minutes: plan.safetyMarginMinutes,
    safety_margin_method: plan.safetyMarginMethod,
    safety_margin_sample_count: plan.safetyMarginSampleCount,
    weather_penalty_minutes: plan.weatherPenaltyMinutes,
    weather_status: plan.weatherStatus as WeatherStatus,
    updated_at: new Date().toISOString(),
  }).eq("id", trip.id);
  if (updateTripError) throw updateTripError;

  if (planPassed) {
    await admin.from("trip_rechecks").update({ status: "cancelled" }).eq("trip_id", trip.id).eq("status", "pending");
  } else {
    const { data: pending, error: pendingError } = await admin
      .from("trip_rechecks")
      .select("id,checkpoint_minutes")
      .eq("trip_id", trip.id)
      .eq("status", "pending");
    if (pendingError) throw pendingError;
    for (const next of pending ?? []) {
      const nextTime = Date.parse(plan.leaveAt) - next.checkpoint_minutes * 60_000;
      const { error } = await admin.from("trip_rechecks").update({
        scheduled_at: new Date(nextTime).toISOString(),
        baseline_leave_at: plan.leaveAt,
        baseline_duration_minutes: plan.durationMinutes,
        baseline_weather_penalty_minutes: plan.weatherPenaltyMinutes,
      }).eq("id", next.id);
      if (error) throw error;
    }
  }

  try {
    const pushSubscription: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };
    await getWebPush().sendNotification(pushSubscription, JSON.stringify({
      ...message,
      tripId: trip.id,
      url: "/",
      urgent: planPassed,
    }), { TTL: 3600 });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", trip.subscription_id);
      await admin.from("trips").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", trip.id);
      await admin.from("trip_rechecks").update({ status: "cancelled" }).eq("trip_id", trip.id).eq("status", "pending");
      await admin.from("trip_rechecks").update({ status: "failed", processed_at: new Date().toISOString() }).eq("id", check.id);
      return "failed" as const;
    }

    const retry = check.attempts < 3;
    await admin.from("trip_rechecks").update({
      status: retry ? "pending" : "failed",
      scheduled_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      processed_at: retry ? null : new Date().toISOString(),
      locked_at: null,
    }).eq("id", check.id);
    return "failed" as const;
  }

  const { error: doneError } = await admin.from("trip_rechecks").update({
    status: "sent",
    processed_at: new Date().toISOString(),
    locked_at: null,
  }).eq("id", check.id);
  if (doneError) throw doneError;

  const { count: remaining } = await admin.from("trip_rechecks")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .eq("status", "pending");
  if (planPassed || remaining === 0) {
    await admin.from("trips").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", trip.id);
  }
  return "sent" as const;
}

async function runCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin: ReturnType<typeof getSupabaseAdmin>;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Supabase storage is not configured." }, { status: 503 });
  }

  const { data, error } = await admin.rpc("claim_due_trip_rechecks", { p_limit: 10 });
  if (error) {
    console.error("Could not claim due trip re-checks", error.message);
    return NextResponse.json({ error: "Could not claim due trip re-checks." }, { status: 500 });
  }

  const outcomes = await Promise.all((data ?? []).map(async (check: Recheck) => {
    try {
      return await processRecheck(admin, check);
    } catch (error) {
      console.error("Trip re-check failed", check.id, error instanceof Error ? error.message : "Unknown error");
      const retry = check.attempts < 3;
      await admin.from("trip_rechecks").update({
        status: retry ? "pending" : "failed",
        scheduled_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        processed_at: retry ? null : new Date().toISOString(),
        locked_at: null,
      }).eq("id", check.id);
      return "failed" as const;
    }
  }));

  return NextResponse.json({
    claimed: outcomes.length,
    sent: outcomes.filter((outcome) => outcome === "sent").length,
    cancelled: outcomes.filter((outcome) => outcome === "cancelled").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
  });
}

// Vercel Cron calls GET; other cron services may use POST.
export const GET = runCron;
export const POST = runCron;
