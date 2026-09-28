import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const brandDir = path.join(publicDir, 'brand');

if (!fs.existsSync(brandDir)) {
  fs.mkdirSync(brandDir, { recursive: true });
}

// 1. Generate 512x512 Brand Icon (SVG -> PNG)
const iconSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="128" fill="#09090b" />
  <circle cx="256" cy="256" r="180" fill="#25D366" />
  <!-- WhatsApp / CRM Speech bubble with quotes -->
  <path d="M256 140C192.487 140 141 191.487 141 255C141 278.435 147.962 300.273 160.038 318.571L148 372L203.429 360.286C219.467 369.714 237.143 375 256 375C319.513 375 371 323.513 371 260C371 196.487 319.513 140 256 140Z" fill="white" />
  <!-- CRM Inner message dots / quote marks -->
  <circle cx="215" cy="255" r="14" fill="#09090b" />
  <circle cx="256" cy="255" r="14" fill="#09090b" />
  <circle cx="297" cy="255" r="14" fill="#09090b" />
</svg>
`;

// 2. Generate 1200x630 Open Graph Image (SVG -> PNG)
const ogSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#09090b" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#25D366" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#25D366" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect width="1200" height="630" fill="url(#glow)" />

  <!-- Grid decoration -->
  <g stroke="rgba(255,255,255,0.05)" stroke-width="1">
    <line x1="80" y1="0" x2="80" y2="630" />
    <line x1="240" y1="0" x2="240" y2="630" />
    <line x1="400" y1="0" x2="400" y2="630" />
    <line x1="560" y1="0" x2="560" y2="630" />
    <line x1="720" y1="0" x2="720" y2="630" />
    <line x1="880" y1="0" x2="880" y2="630" />
    <line x1="1040" y1="0" x2="1040" y2="630" />
    <line x1="0" y1="120" x2="1200" y2="120" />
    <line x1="0" y1="280" x2="1200" y2="280" />
    <line x1="0" y1="440" x2="1200" y2="440" />
  </g>

  <!-- Logo & Badge -->
  <g transform="translate(80, 80)">
    <rect width="72" height="72" rx="20" fill="#25D366" />
    <path d="M36 18C26.0589 18 18 26.0589 18 36C18 39.6617 19.0878 43.0739 20.9747 45.9329L19 54L27.242 52.1287C29.7448 53.6067 32.7723 54.4355 36 54.4355C45.9411 54.4355 54 46.3766 54 36.4355C54 26.4944 45.9411 18 36 18Z" fill="#09090b" />
    <circle cx="29" cy="36" r="2.5" fill="#25D366" />
    <circle cx="36" cy="36" r="2.5" fill="#25D366" />
    <circle cx="43" cy="36" r="2.5" fill="#25D366" />
    <text x="92" y="48" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="800" fill="#ffffff" letter-spacing="-0.03em">WaCRM</text>
  </g>

  <!-- Pill Badge -->
  <g transform="translate(940, 80)">
    <rect width="180" height="38" rx="19" fill="rgba(37, 211, 102, 0.15)" stroke="rgba(37, 211, 102, 0.4)" stroke-width="1.5" />
    <circle cx="24" cy="19" r="5" fill="#25D366" />
    <text x="38" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#25D366">Meta Cloud API</text>
  </g>

  <!-- Main Headline -->
  <text x="80" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="54" font-weight="800" fill="#ffffff" letter-spacing="-0.03em">
    Official WhatsApp CRM,
  </text>
  <text x="80" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="54" font-weight="800" fill="#25D366" letter-spacing="-0.03em">
    Automation &amp; Multi-Agent Inbox
  </text>

  <!-- Description -->
  <text x="80" y="415" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="400" fill="#9ca3af" letter-spacing="-0.01em">
    Broadcast bulk notifications, build automated chatbots, and empower your support
  </text>
  <text x="80" y="450" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="400" fill="#9ca3af" letter-spacing="-0.01em">
    team with a unified multi-agent WhatsApp conversation platform.
  </text>

  <!-- Feature Tags at bottom -->
  <g transform="translate(80, 520)">
    <!-- Item 1 -->
    <rect x="0" y="0" width="220" height="42" rx="10" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.1)" />
    <text x="20" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#e5e7eb">Multi-Agent Inbox</text>

    <!-- Item 2 -->
    <rect x="235" y="0" width="220" height="42" rx="10" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.1)" />
    <text x="255" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#e5e7eb">Visual Flow Builder</text>

    <!-- Item 3 -->
    <rect x="470" y="0" width="220" height="42" rx="10" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.1)" />
    <text x="490" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#e5e7eb">Bulk Broadcasts</text>

    <!-- Item 4 -->
    <rect x="705" y="0" width="220" height="42" rx="10" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.1)" />
    <text x="725" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#e5e7eb">Developer REST API</text>
  </g>
</svg>
`;

// 3. Generate Logo with text (500x120 SVG -> PNG)
const logoSvg = `
<svg width="500" height="120" viewBox="0 0 500 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="15" width="90" height="90" rx="26" fill="#25D366" />
  <path d="M55 35C42.5736 35 32.5 45.0736 32.5 57.5C32.5 62.0771 33.8598 66.3424 36.2184 69.9161L33.75 80L44.0525 77.6609C47.181 79.5084 50.9654 80.5444 55 80.5444C67.4264 80.5444 77.5 70.4708 77.5 58.0444C77.5 45.618 67.4264 35 55 35Z" fill="#09090b" />
  <circle cx="46" cy="57.5" r="3" fill="#25D366" />
  <circle cx="55" cy="57.5" r="3" fill="#25D366" />
  <circle cx="64" cy="57.5" r="3" fill="#25D366" />
  <text x="120" y="78" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="800" fill="#09090b" letter-spacing="-0.03em">WaCRM</text>
</svg>
`;

async function main() {
  console.log('Generating production brand and social assets...');

  // 1. OG Image (1200x630)
  await sharp(Buffer.from(ogSvg))
    .png({ quality: 95, compressionLevel: 8 })
    .toFile(path.join(publicDir, 'og.png'));
  console.log('✓ public/og.png (1200x630)');

  // 2. Icon 512x512
  await sharp(Buffer.from(iconSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ public/icon-512.png (512x512)');

  // 3. Apple Touch Icon 180x180
  await sharp(Buffer.from(iconSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ public/apple-touch-icon.png (180x180)');

  // 4. Favicon 32x32 & 48x48
  await sharp(Buffer.from(iconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(Buffer.from(iconSvg))
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('✓ public/favicon.png (48x48)');

  // 5. Brand logo
  await sharp(Buffer.from(logoSvg))
    .png()
    .toFile(path.join(brandDir, 'logo.png'));
  console.log('✓ public/brand/logo.png (500x120)');

  console.log('All public brand assets generated successfully!');
}

main().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
