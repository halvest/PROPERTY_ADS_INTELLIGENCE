export interface SelectedAdCopy {
  eyebrow: string;
  headline: string;
  location: string;
  specs: string[];
  proof: string;
  offer: string;
  cta: string;
  keptForCaption: string[];
}

function cleanLine(value: string): string {
  return value.replace(/[^\p{L}\p{N}&.,/+%'’\- ]/gu, " ").replace(/\s+/g, " ").trim();
}

function titleWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function placeCase(value: string): string {
  if (value.length <= 3) return value.toUpperCase();
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function shorten(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

/**
 * Picks the few lines a feed ad can carry in one glance.
 * Everything else stays available for the caption, not the picture.
 */
export function selectAdCopy(raw: string): SelectedAdCopy {
  const text = raw || "";
  const lines = text.split(/\n/).map(cleanLine).filter(Boolean);

  const project =
    text.match(/\b([A-Z0-9][A-Z0-9 &'’.-]*?(?:RESIDENCE|CLUSTER|REGENCY))\b/)?.[1] ||
    "";

  const cityRaw = text.match(/\b(Purwakarta|BSD(?:\s+City)?|Bandung|Jakarta|Tangerang|Bekasi|Depok|Bogor|Surabaya|Semarang|Yogyakarta|Bali|Serpong)\b/i)?.[1] || "";
  const city = cityRaw ? (cityRaw.toLowerCase().startsWith("bsd") ? "BSD" : placeCase(cityRaw)) : "";
  const place = text.match(/\b([A-Z][a-z]+,\s*[A-Z][a-z]+)\b/)?.[1] || "";
  const location = [place, city && !place.toLowerCase().includes(city.toLowerCase()) ? city : ""].filter(Boolean).join(" · ");

  const privateHouse = /private modern house/i.test(text);
  const floors = text.match(/(\d+)\s*lantai/i)?.[1];
  const headline = privateHouse
    ? "Private Modern House"
    : floors
      ? `Rumah ${floors} Lantai`
      : shorten(lines[0] || "Hunian Modern", 32);

  const specs: string[] = [];
  const type = text.match(/type\s*\d+(?:\s*(?:&|dan)\s*type\s*\d+)?/i)?.[0];
  if (type) specs.push(type.replace(/type/i, "Type").replace(/\s+/g, " "));
  const bedrooms = text.match(/(\d+)\s*kamar tidur/i)?.[1];
  const bathrooms = text.match(/(\d+)\s*kamar mandi/i)?.[1];
  if (bedrooms) specs.push(`${bedrooms} KT`);
  if (bathrooms) specs.push(`${bathrooms} KM`);
  if (/carport/i.test(text)) specs.push("Carport");
  else if (/ruang kerja/i.test(text)) specs.push("Ruang kerja");

  const near = [...text.matchAll(/dekat\s+([^\n.]{3,42})/gi)].map((match) => cleanLine(match[1]));
  const price = text.match(/(?:rp\.?\s*)?[0-9.,]+\s*(?:juta|miliar|milyar)/i)?.[0];
  const offer = price ? (price.toLowerCase().startsWith("rp") ? price : `Rp ${price}`) : "";
  const proof = near[0]
    ? `Dekat ${shorten(near[0], 28)}`
    : /dp\s*0/i.test(text)
      ? "DP 0%"
      : /kpr/i.test(text)
        ? "KPR tersedia"
        : "";

  const phone = text.match(/(?:\+62|0)8[0-9][0-9\s-]{7,12}/)?.[0]?.replace(/\s+/g, "");
  const cta = phone ? `WhatsApp ${phone}` : "Konsultasi WhatsApp";

  const keptForCaption = [
    ...near.slice(1).map((item) => `Dekat ${item}`),
    /ruang kerja/i.test(text) && !specs.includes("Ruang kerja") ? "Ruang kerja pribadi" : "",
    /cash keras|cash bertahap|kpr/i.test(text) ? "Pilihan bayar: KPR, cash bertahap, cash keras" : "",
  ].filter(Boolean);

  return {
    eyebrow: shorten(project || headline, 34),
    headline,
    location: location || "Lokasi strategis",
    specs: specs.slice(0, 4),
    proof,
    offer,
    cta: shorten(cta, 28),
    keptForCaption,
  };
}

export interface PosterCopy extends SelectedAdCopy {
  subhead: string;
  benefit: string;
  factRow: string[];
  typeLabel: string;
  proofs: string[];
  nearby: string[];
  payment: string;
}

/**
 * Every line is taken from the brief. Nothing is invented.
 */
export function selectPosterCopy(raw: string): PosterCopy {
  const base = selectAdCopy(raw);
  const text = raw || "";
  const floors = text.match(/(\d+)\s*lantai/i)?.[1];
  const city = text.match(/\b(Purwakarta|BSD(?:\s+City)?|Bandung|Jakarta|Tangerang|Bekasi|Depok|Bogor|Surabaya|Semarang|Yogyakarta|Bali|Serpong)\b/i)?.[1];
  const cityLabel = city ? (city.toLowerCase().startsWith("bsd") ? "BSD" : placeCase(city)) : "";
  const bedroomWords = text.match(/(\d+)\s*kamar tidur/i)?.[1];
  const bathroomWords = text.match(/(\d+)\s*kamar mandi/i)?.[1];
  const bedroomShort = text.match(/(\d+)\s*kt\b/i)?.[1];
  const bathroomShort = text.match(/(\d+)\s*km\b/i)?.[1];
  const bedroomLabel = bedroomWords || bedroomShort ? `${bedroomWords || bedroomShort} Kamar Tidur` : "";
  const bathroomLabel = bathroomWords || bathroomShort ? `${bathroomWords || bathroomShort} Kamar Mandi` : "";
  const type = text.match(/type\s*(\d+(?:\s*(?:&|dan)\s*(?:type\s*)?\d+)?)/i)?.[1]
    ?.replace(/\btype\b/gi, "")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ")
    .trim();
  const nearby = [...text.matchAll(/dekat\s+([^\n.]{3,42})/gi)].map((match) => titleWords(cleanLine(match[1]))).filter(Boolean).slice(0, 5);
  const payments = [
    /kpr/i.test(text) ? "KPR" : "",
    /cash bertahap/i.test(text) ? "Cash Bertahap" : "",
    /cash keras/i.test(text) ? "Cash Keras" : "",
  ].filter(Boolean);

  const factRow = [
    floors && !cityLabel ? `Rumah ${floors} Lantai` : "",
    bedroomLabel,
    bathroomLabel,
    /ruang kerja/i.test(text) ? "Ruang Kerja" : /workspace/i.test(text) ? "Workspace" : "",
    /carport/i.test(text) ? "Carport" : "",
  ].filter(Boolean);

  return {
    ...base,
    subhead: floors && cityLabel ? `${floors} Lantai di ${cityLabel}` : floors ? `${floors} Lantai` : "",
    benefit: /lega|nyaman|fungsional/i.test(text) ? "Ruang lebih lega, nyaman, dan fungsional." : "",
    factRow,
    typeLabel: type ? `Type ${type}` : "",
    proofs: nearby,
    nearby,
    payment: payments.join(" · "),
  };
}

/** One typographic line of facts, for a poster rather than a spec grid. */
export function formatSpecLine(specs: string[]): string {
  return specs
    .slice(0, 4)
    .map((spec) => {
      const type = spec.match(/type\s+(.+)/i);
      if (type) return type[1].replace(/\btype\s*/gi, "").trim();
      if (/^\d+\s*KT$/i.test(spec)) return spec.replace(/KT/i, "Kamar");
      if (/^\d+\s*KM$/i.test(spec)) return spec.replace(/KM/i, "Mandi");
      return spec;
    })
    .join("   ·   ");
}
