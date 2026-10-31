// Format a Date for a datetime-local input using the user's local timezone.
export function toLocalDateTimeInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

// Start with a useful default: tomorrow at 9:00 AM in the user's local time.
export function tomorrowAtNineLocal(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return toLocalDateTimeInputValue(tomorrow);
}

// Quick arrival-time choices avoid making the user open and edit both picker sections.
export function arrivalInMinutes(minutes: number, now = new Date()) {
  return toLocalDateTimeInputValue(new Date(now.getTime() + minutes * 60_000));
}

export function arriveByValidationError(value: string, now = Date.now()) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Enter a valid arrive-by time.";
  if (timestamp <= now) return "Arrive-by time must be in the future.";
  return "";
}
