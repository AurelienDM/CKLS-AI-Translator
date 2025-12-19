const fs = require('fs');
const { createCanvas } = require('canvas');

// Function to create an icon
function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#4A90E2');
  gradient.addColorStop(1, '#357ABD');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Add rounded corners
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  const radius = size * 0.2;
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
  
  // Reset composite operation
  ctx.globalCompositeOperation = 'source-over';
  
  // Draw translation symbol (A ⇄ B)
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.35}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Draw A
  ctx.fillText('A', size * 0.25, size * 0.5);
  
  // Draw arrows
  const arrowY = size * 0.5;
  const arrowX1 = size * 0.4;
  const arrowX2 = size * 0.6;
  const arrowSize = size * 0.05;
  
  // Right arrow
  ctx.beginPath();
  ctx.moveTo(arrowX1, arrowY - arrowSize);
  ctx.lineTo(arrowX2 - arrowSize, arrowY - arrowSize);
  ctx.lineTo(arrowX2 - arrowSize, arrowY - arrowSize * 2);
  ctx.lineTo(arrowX2, arrowY);
  ctx.lineTo(arrowX2 - arrowSize, arrowY + arrowSize * 2);
  ctx.lineTo(arrowX2 - arrowSize, arrowY + arrowSize);
  ctx.lineTo(arrowX1, arrowY + arrowSize);
  ctx.closePath();
  ctx.fill();
  
  // Draw B
  ctx.fillText('B', size * 0.75, size * 0.5);
  
  return canvas.toBuffer('image/png');
}

// Create the three sizes
['16', '48', '128'].forEach(size => {
  const buffer = createIcon(parseInt(size));
  fs.writeFileSync(`public/icons/icon${size}.png`, buffer);
  console.log(`Created icon${size}.png`);
});

console.log('All icons created successfully!');
