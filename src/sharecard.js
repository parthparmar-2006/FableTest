// Renders a shareable score-card PNG on a plain 2D canvas (no Phaser needed)
// and opens the native share sheet on mobile; caller handles fallback.
export async function shareScoreCard({ score, best, tierName, tierColor, nearMiss, mode }) {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 720;
  const x = c.getContext('2d');

  const grad = x.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, '#1a1a3e');
  grad.addColorStop(1, '#0b0b1e');
  x.fillStyle = grad;
  x.fillRect(0, 0, 600, 720);
  for (let i = 0; i < 70; i++) {
    x.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.5})`;
    x.beginPath();
    x.arc(Math.random() * 600, Math.random() * 720, 1 + Math.random() * 2, 0, 7);
    x.fill();
  }

  x.textAlign = 'center';
  x.fillStyle = '#ffd54f';
  x.font = '800 52px "Baloo 2", sans-serif';
  x.fillText('JAR OF STARS', 300, 90);
  if (mode) {
    x.fillStyle = '#80deea';
    x.font = '600 26px "Baloo 2", sans-serif';
    x.fillText(mode, 300, 130);
  }

  x.fillStyle = '#ffffff';
  x.font = '800 110px "Baloo 2", sans-serif';
  x.fillText(`${score}`, 300, 260);
  x.fillStyle = '#9aa7c7';
  x.font = '600 26px "Baloo 2", sans-serif';
  x.fillText(`best ${best}`, 300, 300);

  // biggest piece with its face
  const cy = 430;
  const r = 85;
  x.fillStyle = tierColor;
  x.beginPath();
  x.arc(300, cy, r, 0, 7);
  x.fill();
  x.fillStyle = 'rgba(255,255,255,0.28)';
  x.beginPath();
  x.arc(300 - r * 0.32, cy - r * 0.35, r * 0.34, 0, 7);
  x.fill();
  x.fillStyle = '#2b2b40';
  x.beginPath();
  x.arc(300 - r * 0.3, cy - r * 0.08, r * 0.09, 0, 7);
  x.arc(300 + r * 0.3, cy - r * 0.08, r * 0.09, 0, 7);
  x.fill();
  x.strokeStyle = '#2b2b40';
  x.lineWidth = r * 0.06;
  x.beginPath();
  x.arc(300, cy + r * 0.18, r * 0.22, Math.PI * 0.15, Math.PI * 0.85);
  x.stroke();

  x.fillStyle = '#cfd8ff';
  x.font = '600 30px "Baloo 2", sans-serif';
  x.fillText(`Biggest: ${tierName}`, 300, 560);
  x.fillStyle = '#80deea';
  x.font = '600 28px "Baloo 2", sans-serif';
  x.fillText(nearMiss, 300, 605);

  x.fillStyle = '#ffd54f';
  x.font = '600 24px "Baloo 2", sans-serif';
  x.fillText('▶ play: parthparmar06.itch.io/jar-of-stars', 300, 680);

  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'jar-of-stars-score.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'Jar of Stars',
      text: `I scored ${score} in Jar of Stars! ${nearMiss}`,
    });
    return true;
  }
  return false; // caller falls back to clipboard text
}
