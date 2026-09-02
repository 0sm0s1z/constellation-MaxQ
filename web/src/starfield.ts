type Star = {
  x: number;
  y: number;
  z: number;
  tw: number;
};

type Edge = [number, number];

export function mountStarfield(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;

  let w = 0;
  let h = 0;
  let stars: Star[] = [];
  let nodes: { x: number; y: number }[] = [];
  let edges: Edge[] = [];
  let raf = 0;
  let t = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  };

  const seed = () => {
    const count = Math.floor((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.25 + Math.random() * 0.75,
      tw: Math.random() * Math.PI * 2,
    }));
    nodes = Array.from({ length: 18 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
    }));
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      const dists = nodes
        .map((n, j) => ({ j, d: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
        .filter((d) => d.j !== i)
        .sort((a, b) => a.d - b.d);
      for (const near of dists.slice(0, 2)) {
        if (near.d < Math.min(w, h) * 0.28) edges.push([i, near.j]);
      }
    }
  };

  const frame = () => {
    t += 0.004;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.18, 20, w * 0.5, h * 0.45, Math.max(w, h));
    g.addColorStop(0, "#1e1e2e");
    g.addColorStop(0.55, "#181825");
    g.addColorStop(1, "#11111b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(203,166,247,0.10)";
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(nodes[a].x, nodes[a].y);
      ctx.lineTo(nodes[b].x, nodes[b].y);
      ctx.stroke();
    }

    for (const n of nodes) {
      ctx.fillStyle = "rgba(180,190,254,0.55)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of stars) {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + s.tw));
      ctx.fillStyle = `rgba(205,214,244,${0.18 + s.z * 0.55 * twinkle})`;
      ctx.fillRect(s.x, s.y, s.z * 1.6, s.z * 1.6);
    }

    const ox = w * 0.86;
    const oy = h * 0.16;
    ctx.strokeStyle = "rgba(108,112,134,0.45)";
    ctx.beginPath();
    ctx.ellipse(ox, oy, 54, 18, -0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fab387";
    ctx.beginPath();
    ctx.arc(ox + 48 * Math.cos(t), oy + 16 * Math.sin(t) - 8, 2.4, 0, Math.PI * 2);
    ctx.fill();

    raf = requestAnimationFrame(frame);
  };

  resize();
  frame();
  window.addEventListener("resize", resize);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  };
}
