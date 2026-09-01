import { mkdir, readFile, writeFile } from "node:fs/promises";
import icons from "simple-icons/icons.json" with { type: "json" };

const services = [
  ["youtube-premium", "YouTube", "youtube.com"],
  ["live-stream-sports", null, null],
  ["nordvpn", "NordVPN", "nordvpn.com"],
  ["datacamp-premium", "DataCamp", "datacamp.com"],
  ["dazn", "DAZN", "dazn.com"],
  ["figma-professional", "Figma", "figma.com"],
  ["codecademy-pro", "Codecademy", "codecademy.com"],
  ["perplexity-pro-shared", "Perplexity", "perplexity.ai"],
  ["f1-tv-pro", null, "formula1.com"],
  ["venice-ai-pro", null, "venice.ai"],
  ["tennis-tv-premium", null, "tennistv.com"],
  ["copy-ai-chat", null, "copy.ai"],
  ["audible-premium", "Audible", "audible.com"],
  ["eset-internet-security-nod32-1-device", null, "eset.com"],
  ["capcut-pro", null, "capcut.com"],
  ["spotify-premium-family", "Spotify", "spotify.com"],
  ["tidal-dj-hifi-dj-access", "TIDAL", "tidal.com"],
  ["crunchyroll-mega-fan", "Crunchyroll", "crunchyroll.com"],
  ["deezer-premium", "Deezer", "deezer.com"],
  ["meshy-pro", null, "meshy.ai"],
  ["brain-fm", null, "brain.fm"],
  ["ipvanish", null, "ipvanish.com"],
  ["nba-league-pass-premium-nba-tv", "NBA", "nba.com"],
  ["mobbin-pro", null, "mobbin.com"],
  ["bypassgpt-unlimited", null, "bypassgpt.ai"],
  ["yousician-premium", null, "yousician.com"],
  ["ccleaner-professional-1-pc", "CCleaner", "ccleaner.com"],
  ["udemy-business", "Udemy", "udemy.com"],
  ["flutterflow-edu-pro", null, "flutterflow.io"],
  ["plex-tv-premium-pass", "Plex", "plex.tv"],
  ["studocu-premium-shared", null, "studocu.com"],
  ["super-duolingo-family-member", "Duolingo", "duolingo.com"],
  ["cluely-pro-shared", null, "cluely.com"],
  ["study-com-premium-private", null, "study.com"],
  ["bolt-new-pro", null, "bolt.new"],
  ["crunchyroll-ultimate-fan", "Crunchyroll", "crunchyroll.com"],
  ["curiositystream-standard", null, "curiositystream.com"],
  ["shahid-vip", null, "shahid.mbc.net"],
  ["chess-com-diamond", "Chess.com", "chess.com"],
  ["stan-premium-4k", null, "stan.com.au"],
  ["gamma-ai-plus", null, "gamma.app"],
  ["hulu-live-tv-ultimate", null, "hulu.com"],
  ["curiositystream-smart-bundle", null, "curiositystream.com"],
  ["motion-array-everything-pro", null, "motionarray.com"],
  ["myfitnesspal-premium", null, "myfitnesspal.com"],
  ["save-my-exams-premium", null, "savemyexams.com"],
  ["scribd-slideshare-premium", null, "scribd.com"],
  ["skillshare-premium", "Skillshare", "skillshare.com"],
  ["speechify-premium", null, "speechify.com"],
  ["microsoft-365-personal", null, "microsoft365.com"],
  ["supergrok", null, "grok.com"],
  ["todoist-pro", "Todoist", "todoist.com"],
  ["ufc-fight-pass", "UFC", "ufcfightpass.com"],
  ["v0-dev-premium", "Vercel", "v0.dev"],
  ["avira-prime-phantom-vpn-pro", "Avira", "avira.com"],
  ["discovery-ad-free", null, "discoveryplus.com"],
  ["google-ai-pro-5tb", "Google Gemini", "gemini.google.com"],
  ["hulu-no-ads-vpn", null, "hulu.com"],
  ["prime-gaming-games-with-prime", null, "amazon.com"],
  ["quillbot-premium", null, "quillbot.com"],
  ["splice-creator", null, "splice.com"],
  ["peacock-premium-plus-vpn", null, "peacocktv.com"],
  ["directv-stream-ultimate", null, "directv.com"],
  ["leonardo-ai-essential", null, "leonardo.ai"],
  ["exitlag-premium", null, "exitlag.com"],
  ["edx-premium-full-catalogue", "edX", "edx.org"],
  ["adobe-creative-cloud", null, "adobe.com"],
  ["prime-video", null, "primevideo.com"],
  ["espn-select-espn", null, "espn.com"],
  ["britbox-vpn", null, "britbox.com"],
  ["hulu-ultimate-entertainment-vpn", null, "hulu.com"],
  ["mgm-vpn", null, "mgmplus.com"],
  ["pandora-premium-vpn", "Pandora", "pandora.com"],
  ["disney-premium-vpn", null, "disneyplus.com"],
  ["hbo-max-vpn", "HBO Max", "max.com"],
  ["apple-tv", "Apple TV", "tv.apple.com"],
  ["fubo-vpn", "Fubo", "fubo.tv"],
  ["invideo-studio-unlimited", null, "invideo.io"],
  ["linkedin-premium-career", null, "linkedin.com"],
  ["norton-360-3-devices", "Norton", "norton.com"],
  ["study-com-premium-shared", null, "study.com"],
  ["norton-360-1-device", "Norton", "norton.com"],
  ["paramount-premium-vpn", "Paramount+", "paramountplus.com"],
  ["starz-vpn", "STARZ", "starz.com"],
  ["malwarebytes-premium-1-pc", "Malwarebytes", "malwarebytes.com"],
  ["microsoft-power-bi-pro", null, "app.powerbi.com"],
  ["chatgpt-plus", null, "chatgpt.com"],
  ["apple-music", "Apple Music", "music.apple.com"],
  ["wondershare-filmora", "Wondershare Filmora", "filmora.wondershare.com"],
  ["amc-premium", null, "amcplus.com"],
  ["netflix", "Netflix", "netflix.com"],
  ["canva-pro", null, "canva.com"]
];

const iconByTitle = new Map(icons.map((icon) => [icon.title, icon]));
const outputDir = new URL("../public/brands/catalog/", import.meta.url);
await mkdir(outputDir, { recursive: true });

function imageDocument(base64, mimeType) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img"><image width="128" height="128" preserveAspectRatio="xMidYMid meet" href="data:${mimeType};base64,${base64}"/></svg>\n`;
}

function sportsDocument() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img"><circle cx="64" cy="64" r="58" fill="#0f172a"/><path d="M64 24a40 40 0 1 0 0 80 40 40 0 0 0 0-80Zm-9 10h18l8 11-6 15H53l-6-15 8-11Zm-20 27 14 4 7 21-10 10A32 32 0 0 1 35 61Zm47 35-10-10 7-21 14-4a32 32 0 0 1-11 35Z" fill="#fff"/></svg>\n`;
}

for (const [slug, iconTitle, domain] of services) {
  let svg;
  if (slug === "live-stream-sports") {
    svg = sportsDocument();
  } else if (iconTitle && iconByTitle.has(iconTitle)) {
    const icon = iconByTitle.get(iconTitle);
    const source = await readFile(new URL(`../node_modules/simple-icons/icons/${icon.slug}.svg`, import.meta.url), "utf8");
    svg = source.replace("<svg ", `<svg fill="#${icon.hex}" `) + "\n";
  } else {
    const response = await fetch(`https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=128`, {
      headers: { "user-agent": "UniPlug catalog artwork audit/1.0" }
    });
    if (!response.ok) throw new Error(`Could not retrieve ${domain} artwork (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100) throw new Error(`Invalid ${domain} artwork response`);
    svg = imageDocument(bytes.toString("base64"), response.headers.get("content-type") || "image/png");
  }
  await writeFile(new URL(`${slug}.svg`, outputDir), svg);
}

const slugs = services.map(([slug]) => `  ${JSON.stringify(slug)}`).join(",\n");
await writeFile(
  new URL("../lib/service-artwork.generated.ts", import.meta.url),
  `// Generated by scripts/generate-service-artwork.mjs\nexport const serviceArtworkSlugs = new Set([\n${slugs}\n]);\n`
);
console.log(`Generated ${services.length} verified service artwork files.`);
