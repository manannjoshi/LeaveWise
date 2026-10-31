import { NextResponse } from "next/server";

// Small offline examples so the form can still be tried without an API key.
function mockPlace(query: string, index: number) {
  const hash = [...query].reduce((sum, char) => sum + char.charCodeAt(0), index * 37);
  return {
    label: `${query} (sample location)`,
    lat: 40 + (hash % 1000) / 100_000,
    lon: -74 + (hash % 1000) / 100_000,
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return NextResponse.json({ places: [] });
  if (query.length > 160) {
    return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
  }

  const key = process.env.TOMTOM_API_KEY;
  if (!key) {
    return NextResponse.json({ places: [mockPlace(query, query.length)], source: "mock" });
  }

  try {
    const url = new URL(`https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`);
    url.searchParams.set("key", key);
    url.searchParams.set("typeahead", "true");
    url.searchParams.set("limit", "5");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error("TomTom Search request failed");

    const data = await response.json();
    const places = (data.results ?? []).flatMap((result: any) => {
      const position = result.position;
      if (!position || typeof position.lat !== "number" || typeof position.lon !== "number") return [];
      return [{ label: result.address?.freeformAddress ?? result.poi?.name ?? query, lat: position.lat, lon: position.lon }];
    });
    return NextResponse.json({ places, source: "tomtom" });
  } catch {
    // A temporary TomTom error should not prevent a student from exploring the app.
    return NextResponse.json({ places: [mockPlace(query, query.length)], source: "mock" });
  }
}
