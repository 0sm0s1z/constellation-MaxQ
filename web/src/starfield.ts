type Star = { x: number; y: number; z: number; tw: number; rgb: [number, number, number] };
type Edge = [number, number];
const TINTS: [number, number, number][] = [[203,166,247],[250,179,135],[137,220,235],[180,190,254]];
export function mountStarfield(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  let w = 0, h = 0, stars: Star[] = [], nodes: { x: number; y: number }[] = [], edges: Edge[] = [], raf = 0, t = 0, mx = 0, my = 0, tx = 0, ty = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); seed();
  };
  const seed = () => {
    const count = Math.floor((w * h) / 11000);
    stars = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, z: 0.25 + Math.random() * 0.75, tw: Math.random() * Math.PI * 2, rgb: TINTS[Math.floor(Math.random() * TINTS.length)] }));
    nodes = Array.from({ length: 16 }, () => ({ x: Math.random() * w, y: Math.random() * h }));
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      const dists = nodes.map((n, j) => ({ j, d: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) })).filter((d) => d.j !== i).sort((a, b) => a.d - b.d);
      for (const near of dists.slice(0, 2)) { if (near.d < Math.min(w, h) * 0.28) edges.push([i, near.j]); }
    }
  };
  const onMove = (e: MouseEvent) => { if (reduced) return; tx = (e.clientX / w - 0.5) * 6; ty = (e.clientY / h - 0.5) * 6; };
  const frame = () => {
    t += reduced ? 0 : 0.002; mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    ctx.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.18, 20, w * 0.5, h * 0.45, Math.max(w, h));
    g.addColorStop(0, "#1e1e2e"); g.addColorStop(0.55, "#181825"); g.addColorStop(1, "#11111b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(mx, my);
    ctx.strokeStyle = "rgba(203,166,247,0.10)"; ctx.lineWidth = 1;
    for (const [a, b] of edges) { ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y); ctx.stroke(); }
    for (const n of nodes) { ctx.fillStyle = "rgba(180,190,254,0.55)"; ctx.beginPath(); ctx.arc(n.x, n.y, 1.4, 0, Math.PI * 2); ctx.fill(); }
    for (const s of stars) {
      const twinkle = reduced ? 0.7 : 0.4 + 0.6 * Math.abs(Math.sin(t * 0.9 + s.tw));
      const [r, gch, b] = s.rgb;
      ctx.fillStyle = `rgba(${r},${gch},${b},${0.16 + s.z * 0.5 * twinkle})`;
      ctx.fillRect(s.x, s.y, s.z * 1.5, s.z * 1.5);
    }
    ctx.restore(); raf = requestAnimationFrame(frame);
  };
  resize(); frame();
  window.addEventListener("resize", resize); window.addEventListener("mousemove", onMove);
  return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
}
