#!/usr/bin/env node

/**
 * Icon Generator for StudyBuddy PWA
 * 
 * Generates three PNG icons from code (no Photoshop/Figma needed):
 * - icon-192.png (small device icon)
 * - icon-512.png (large/high-res icon)
 * - icon-maskable.png (Android adaptive icon)
 * 
 * Requires: npm install canvas
 * Run: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Dynamically import canvas (only required when this script runs)
let Canvas;
try {
  Canvas = require('canvas');
  console.log('✓ Canvas library loaded');
} catch (err) {
  console.error('✗ Canvas library not found. Install with: npm install canvas --save-dev');
  process.exit(1);
}

const { createCanvas } = Canvas;

/**
 * Create an icon image with the StudyBuddy design
 * @param {number} size - Canvas size (192 or 512)
 * @param {boolean} maskable - Whether this is a maskable icon (for Android adaptive icons)
 * @returns {Canvas} Canvas object with the icon drawn
 */
function createIcon(size, maskable = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');    // Blue-purple
  gradient.addColorStop(1, '#764ba2');    // Purple
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Maskable icons need safe area (center circle)
  // Regular icons can use full canvas
  if (maskable) {
    // For Android adaptive icons, draw in the safe area
    // The safe area is a circle in the center
    ctx.save();
    const safeRadius = size * 0.45; // Android guideline: 45% of icon size
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, safeRadius, 0, Math.PI * 2);
    ctx.clip();
  }

  // Draw the StudyBuddy logo: a stylized lightbulb
  // Lightbulb represents learning/ideas
  const bulbRadius = size * 0.22;
  const bulbX = size / 2;
  const bulbY = size / 2.2;

  // Bulb glow
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(bulbX, bulbY, bulbRadius * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Bulb (white)
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(bulbX, bulbY, bulbRadius, 0, Math.PI * 2);
  ctx.fill();

  // Bulb filament (simple)
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = Math.max(2, size / 100);
  ctx.beginPath();
  ctx.moveTo(bulbX - bulbRadius * 0.3, bulbY);
  ctx.quadraticCurveTo(bulbX, bulbY + bulbRadius * 0.3, bulbX + bulbRadius * 0.3, bulbY);
  ctx.stroke();

  // Base of bulb (socket)
  const baseHeight = bulbRadius * 0.5;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(bulbX - bulbRadius * 0.3, bulbY + bulbRadius, bulbRadius * 0.6, baseHeight);

  // Screw threads (3 horizontal lines)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = Math.max(1, size / 150);
  for (let i = 0; i < 3; i++) {
    const yOffset = bulbY + bulbRadius + (i + 1) * (baseHeight / 4);
    ctx.beginPath();
    ctx.moveTo(bulbX - bulbRadius * 0.25, yOffset);
    ctx.lineTo(bulbX + bulbRadius * 0.25, yOffset);
    ctx.stroke();
  }

  // Stars around bulb (representing learning/magic)
  const starCount = 5;
  for (let i = 0; i < starCount; i++) {
    const angle = (i / starCount) * Math.PI * 2;
    const distance = bulbRadius * 1.5;
    const starX = bulbX + Math.cos(angle) * distance;
    const starY = bulbY + Math.sin(angle) * distance;
    drawStar(ctx, starX, starY, 5, size / 50, size / 120, 'white');
  }

  if (maskable) {
    ctx.restore();
  }

  return canvas;
}

/**
 * Draw a star at the given position
 */
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, fillStyle) {
  let rot = Math.PI / 2 * 3;
  let step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

/**
 * Save canvas to PNG file
 */
async function saveIcon(canvas, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(__dirname, 'public', filename);
    const stream = fs.createWriteStream(filepath);
    canvas.createPNGStream().pipe(stream);
    stream.on('finish', () => {
      console.log(`✓ ${filename} (${canvas.width}×${canvas.height})`);
      resolve();
    });
    stream.on('error', reject);
  });
}

/**
 * Main: Generate all icons
 */
async function main() {
  console.log('\n📱 Generating StudyBuddy PWA icons...\n');

  try {
    // Create and save each icon
    const icon192 = createIcon(192, false);
    await saveIcon(icon192, 'icon-192.png');

    const icon512 = createIcon(512, false);
    await saveIcon(icon512, 'icon-512.png');

    const iconMaskable = createIcon(512, true);
    await saveIcon(iconMaskable, 'icon-maskable.png');

    console.log('\n✨ All icons generated successfully!\n');
    console.log('Files created:');
    console.log('  • public/icon-192.png');
    console.log('  • public/icon-512.png');
    console.log('  • public/icon-maskable.png\n');
  } catch (err) {
    console.error('\n✗ Error generating icons:', err.message);
    process.exit(1);
  }
}

main();
