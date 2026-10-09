/* Concept map modal, SVG rendering, D3 */
// ============ Concept Map ============
function openConceptMapModal() {
  document.getElementById('concept-map-modal').classList.add('active');
  // Pre-fill with last topic if available
  const recentInput = inputEl.value.trim();
  if (recentInput) document.getElementById('cmTopic').value = recentInput;
  document.getElementById('cmTopic').focus();
}

function closeConceptMapModal(event) {
  if (event && event.target !== document.getElementById('concept-map-modal')) return;
  document.getElementById('concept-map-modal').classList.remove('active');
  document.getElementById('cm-svg-wrap').style.display = 'none';
  document.getElementById('cm-loading').style.display = 'none';
  document.getElementById('cm-legend').style.display = 'none';
}

async function generateConceptMap() {
  const topic = document.getElementById('cmTopic').value.trim();
  if (!topic) { alert('Please enter a topic'); return; }

  const btn = document.getElementById('cm-generate-btn');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  document.getElementById('cm-loading').style.display = 'block';
  document.getElementById('cm-svg-wrap').style.display = 'none';
  document.getElementById('cm-legend').style.display = 'none';

  try {
    const res  = await fetch('/concept-map', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, level: levelEl.value })
    });
    const data = await res.json();

    document.getElementById('cm-loading').style.display = 'none';

    if (!data.success) {
      toast('Could not generate concept map. Try a different topic.', 'error');
    } else {
      const svgWrap = document.getElementById('cm-svg-wrap');
      svgWrap.innerHTML = '';
      buildConceptMapSVG(data, svgWrap);
      svgWrap.style.display = 'block';
      document.getElementById('cm-legend').style.display = 'flex';
    }
  } catch (err) {
    document.getElementById('cm-loading').style.display = 'none';
    toast('Server error generating concept map.', 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Generate Map';
}

function buildConceptMapSVG(data, container) {
  // Guard: D3 must be loaded for rendering
  if (typeof d3 === 'undefined') {
    container.textContent = 'Concept Map needs network on first load.';
    return;
  }

  const W = 640, H = 460;

  // ── Build node & link arrays for D3 ──
  const nodeColors = {
    central: { fill: '#6C63FF', text: '#ffffff', r: 46 },
    main:    { fill: '#A78BFA', text: '#ffffff', r: 36 },
    related: { fill: '#2a2a3a', text: '#f0f0f5', r: 30, stroke: '#555570' },
    example: { fill: '#10B981', text: '#ffffff', r: 28 }
  };

  const nodes = [];
  const links = [];

  // Central node
  nodes.push({
    id: 'central',
    label: data.central || 'Topic',
    type: 'central',
    ...nodeColors.central
  });

  // Other nodes
  (data.nodes || []).forEach(n => {
    const c = nodeColors[n.type] || nodeColors.related;
    nodes.push({ id: n.id, label: n.label, type: n.type, ...c });
  });

  // Links
  (data.edges || []).forEach(e => {
    links.push({ source: e.from, target: e.to, label: e.label || '' });
  });

  // ── Clear container & create SVG via D3 ──
  container.innerHTML = '';
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('width', '100%')
    .style('font-family', 'inherit');

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arr-d3')
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('refX', 5).attr('refY', 3)
    .attr('orient', 'auto')
    .append('path').attr('d', 'M0,0 L6,3 L0,6 Z').attr('fill', '#9ca3af');

  // ── Force simulation ──
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collide', d3.forceCollide(d => d.r + 5));

  // ── Links (edges) ──
  const linkGroup = svg.append('g');
  const link = linkGroup.selectAll('line')
    .data(links).enter().append('line')
    .attr('stroke', '#555570')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3')
    .attr('marker-end', 'url(#arr-d3)');

  // Edge labels
  const edgeLabel = linkGroup.selectAll('text')
    .data(links).enter().append('text')
    .attr('text-anchor', 'middle')
    .attr('font-size', 9)
    .attr('fill', '#9ca3af')
    .text(d => d.label);

  // ── Nodes ──
  const node = svg.append('g').selectAll('g')
    .data(nodes).enter().append('g')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
    )
    .style('cursor', 'grab');

  // Circles
  node.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => d.fill)
    .attr('stroke', d => d.stroke || 'none')
    .attr('stroke-width', d => d.stroke ? 1.5 : 0);

  // foreignObject for text wrapping
  node.append('foreignObject')
    .attr('width', d => d.r * 2)
    .attr('height', d => d.r * 2)
    .attr('x', d => -d.r)
    .attr('y', d => -d.r)
    .append('xhtml:div')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('justify-content', 'center')
    .style('width', '100%')
    .style('height', '100%')
    .style('text-align', 'center')
    .style('word-wrap', 'break-word')
    .style('overflow', 'hidden')
    .style('font-size', d => d.type === 'central' ? '12px' : '10px')
    .style('font-weight', d => d.type === 'central' ? '700' : '500')
    .style('color', d => d.text)
    .style('padding', '4px')
    .style('box-sizing', 'border-box')
    .style('line-height', '1.2')
    .style('pointer-events', 'none')
    .text(d => d.label);

  // ── Tick: update positions each frame ──
  simulation.on('tick', () => {
    // Keep nodes within bounds
    nodes.forEach(d => {
      d.x = Math.max(d.r, Math.min(W - d.r, d.x));
      d.y = Math.max(d.r, Math.min(H - d.r, d.y));
    });

    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return d.target.x - (dx / dist) * d.target.r;
      })
      .attr('y2', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return d.target.y - (dy / dist) * d.target.r;
      });

    edgeLabel
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2 - 6);

    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // ── Drag handlers ──
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
}

function trunc(str, len) {
  return str && str.length > len ? str.slice(0, len) + '…' : (str || '');
}
