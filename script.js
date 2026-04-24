// --- Vector Math Helper ---
class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  add(v) { this.x += v.x; this.y += v.y; }
  sub(v) { this.x -= v.x; this.y -= v.y; }
  mult(n) { this.x *= n; this.y *= n; }
  div(n) { this.x /= n; this.y /= n; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { let m = this.mag(); if (m !== 0) this.div(m); }
  limit(max) { if (this.magSq() > max * max) { this.normalize(); this.mult(max); } }
  copy() { return new Vector(this.x, this.y); }
  distSq(v) { let dx = this.x - v.x; let dy = this.y - v.y; return dx * dx + dy * dy; }
}

// --- Flower Class ---
class Boid {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    this.acc = new Vector(0, 0);
    this.r = 6;
    this.angle = Math.random() * Math.PI * 2;
    const hues = [330, 300, 45, 10, 200]; 
    const hue = hues[Math.floor(Math.random() * hues.length)];
    this.color = `hsla(${hue}, 80%, 75%, 0.9)`;
  }

  edges(width, height) {
    if (this.pos.x > width + this.r) this.pos.x = -this.r;
    else if (this.pos.x < -this.r) this.pos.x = width + this.r;
    if (this.pos.y > height + this.r) this.pos.y = -this.r;
    else if (this.pos.y < -this.r) this.pos.y = height + this.r;
  }

  steer(desired, maxSpeed, maxForce) {
    let dMag = desired.mag();
    if (dMag === 0) return new Vector(0, 0);
    desired.normalize(); desired.mult(maxSpeed);
    let steer = desired.copy(); steer.sub(this.vel); steer.limit(maxForce);
    return steer;
  }

  flock(boids, config) {
    let alignment = new Vector(0, 0);
    let cohesion = new Vector(0, 0);
    let separation = new Vector(0, 0);
    let total = 0;
    let pRadiusSq = config.perceptionRadius * config.perceptionRadius;

    for (let other of boids) {
      if (other === this) continue;
      let dSq = this.pos.distSq(other.pos);
      if (dSq < pRadiusSq) {
        alignment.add(other.vel);
        cohesion.add(other.pos);
        let diff = this.pos.copy(); diff.sub(other.pos);
        let dist = Math.sqrt(dSq) || 1; diff.div(dist); 
        separation.add(diff);
        total++;
      }
    }

    if (total > 0) {
      alignment.div(total); alignment = this.steer(alignment, config.maxSpeed, config.maxForce);
      cohesion.div(total); cohesion.sub(this.pos); cohesion = this.steer(cohesion, config.maxSpeed, config.maxForce);
      separation.div(total); separation = this.steer(separation, config.maxSpeed, config.maxForce);
    }

    alignment.mult(config.alignWeight);
    cohesion.mult(config.cohesionWeight);
    separation.mult(config.separationWeight);

    this.acc.add(alignment); this.acc.add(cohesion); this.acc.add(separation);
  }

  update(config) {
    if (config.flowEnabled) {
      this.acc.x += config.flowStrength * 0.05; // Apply scaled global current
    }
    this.vel.add(this.acc);
    this.vel.limit(config.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  draw(ctx) {
    this.angle += this.vel.mag() * 0.02;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    for(let i=0; i<5; i++) {
      let px = Math.cos((i * Math.PI * 2) / 5) * (this.r * 0.8);
      let py = Math.sin((i * Math.PI * 2) / 5) * (this.r * 0.8);
      ctx.beginPath(); ctx.arc(px, py, this.r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a'; ctx.fill();
    ctx.restore();
  }
}

// --- NPC Koi Class ---
class NPCKoi {
  constructor(x, y, id = 0) {
    this.pos = new Vector(x, y);
    this.vel = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    this.acc = new Vector(0, 0);
    this.maxSpeed = 3.2; 
    this.maxForce = 0.08; 
    this.eatRadiusSq = 30 * 30;
    this.lastMeal = Date.now(); 
    
    const palettes = [
      { body: '#f8fafc', spots: '#ef4444' }, 
      { body: '#1e293b', spots: '#f8fafc' }, 
      { body: '#fbbf24', spots: '#b45309' }, 
      { body: '#7dd3fc', spots: '#ea580c' }, 
      { body: '#f8fafc', spots: '#8b5cf6' }, 
      { body: '#a3e635', spots: '#166534' }  
    ];
    this.palette = palettes[id % palettes.length];
  }

  edges(width, height) {
    const r = 20; 
    if (this.pos.x > width + r) this.pos.x = -r; else if (this.pos.x < -r) this.pos.x = width + r;
    if (this.pos.y > height + r) this.pos.y = -r; else if (this.pos.y < -r) this.pos.y = height + r;
  }

  seek(target) {
    let desired = target.copy(); desired.sub(this.pos);
    desired.normalize(); desired.mult(this.maxSpeed);
    let steer = desired.copy(); steer.sub(this.vel); steer.limit(this.maxForce);
    return steer;
  }

  flee(dragons) {
    let steer = new Vector(0, 0);
    let count = 0;
    const fleeRadiusSq = 120 * 120; 
    
    for (let d of dragons) {
      let dSq = this.pos.distSq(d.pos);
      if (dSq < fleeRadiusSq) {
        let diff = this.pos.copy();
        diff.sub(d.pos);
        diff.normalize();
        diff.div(Math.sqrt(dSq)); 
        steer.add(diff);
        count++;
      }
    }
    
    if (count > 0) {
      steer.div(count);
      steer.normalize();
      steer.mult(this.maxSpeed);
      steer.sub(this.vel);
      steer.limit(this.maxForce * 2); 
      this.acc.add(steer);
    }
  }

  hunt(boids) {
    let eaten = 0; let closestDist = Infinity; let closestBoid = null;
    for (let i = boids.length - 1; i >= 0; i--) {
      let boid = boids[i];
      let dSq = this.pos.distSq(boid.pos);
      if (dSq < this.eatRadiusSq) { boids.splice(i, 1); eaten++; } 
      else if (dSq < closestDist) { closestDist = dSq; closestBoid = boid; }
    }
    
    if (eaten > 0) this.lastMeal = Date.now(); 

    if (closestBoid && this.acc.magSq() === 0) { 
      this.acc.add(this.seek(closestBoid.pos)); 
    }
    return eaten;
  }

  update(config) {
    if (config.flowEnabled) {
      this.acc.x += config.flowStrength * 0.05; // Apply scaled global current
    }
    this.vel.add(this.acc); this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel); this.acc.mult(0);
  }

  draw(ctx) {
    let angle = this.vel.magSq() > 0 ? Math.atan2(this.vel.y, this.vel.x) : 0;
    ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(angle);
    
    ctx.fillStyle = this.palette.body; 
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = this.palette.spots;
    ctx.beginPath(); ctx.ellipse(6, 0, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6, -2, 5, 4, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = this.palette.body;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-35, -10); ctx.lineTo(-35, 10); ctx.fill();
    
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-10, 22); ctx.lineTo(-5, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-10, -22); ctx.lineTo(-5, -10); ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(12, -6, 2, 0, Math.PI * 2); ctx.arc(12, 6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// --- Dragon Apex Predator Class ---
class Dragon {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    this.acc = new Vector(0, 0);
    this.maxSpeed = 2.6; 
    this.maxForce = 0.06; 
    this.eatRadiusSq = 40 * 40; 
    this.history = []; 
    this.lastMeal = Date.now(); 
  }

  edges(width, height) {
    const r = 40; 
    if (this.pos.x > width + r) this.pos.x = -r; else if (this.pos.x < -r) this.pos.x = width + r;
    if (this.pos.y > height + r) this.pos.y = -r; else if (this.pos.y < -r) this.pos.y = height + r;
  }

  seek(target) {
    let desired = target.copy(); desired.sub(this.pos);
    desired.normalize(); desired.mult(this.maxSpeed);
    let steer = desired.copy(); steer.sub(this.vel); steer.limit(this.maxForce);
    return steer;
  }

  hunt(kois) {
    let eaten = 0; let closestDist = Infinity; let closestKoi = null;
    for (let i = kois.length - 1; i >= 0; i--) {
      let koi = kois[i];
      let dSq = this.pos.distSq(koi.pos);
      if (dSq < this.eatRadiusSq) { kois.splice(i, 1); eaten++; } 
      else if (dSq < closestDist) { closestDist = dSq; closestKoi = koi; }
    }
    
    if (eaten > 0) this.lastMeal = Date.now(); 

    if (closestKoi) { this.acc.add(this.seek(closestKoi.pos)); }
    return eaten;
  }

  update(config) {
    if (config.flowEnabled) {
      this.acc.x += config.flowStrength * 0.05; // Apply scaled global current
    }
    this.vel.add(this.acc); this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel); this.acc.mult(0);
    
    this.history.unshift(this.pos.copy());
    if (this.history.length > 25) {
      this.history.pop();
    }
  }

  draw(ctx) {
    let angle = this.vel.magSq() > 0 ? Math.atan2(this.vel.y, this.vel.x) : 0;
    
    ctx.fillStyle = '#0f766e'; 
    ctx.strokeStyle = '#042f2e';
    for (let i = 0; i < this.history.length; i += 2) {
      let pt = this.history[i];
      let radius = Math.max(2, 15 - (i / 1.5)); 
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(angle);
    
    ctx.fillStyle = '#115e59'; 
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2); ctx.fill();
    
    ctx.strokeStyle = '#ccfbf1';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, 10); ctx.quadraticCurveTo(5, 25, -15, 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -10); ctx.quadraticCurveTo(5, -25, -15, -30); ctx.stroke();
    
    ctx.fillStyle = '#fef08a';
    ctx.beginPath(); ctx.arc(10, -8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, 8, 4, 0, Math.PI * 2); ctx.fill();
    
    ctx.restore();
  }
}

// --- Application State & Logic ---
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const scoreNpcEl = document.getElementById('score-npc');
const scoreDragonEl = document.getElementById('score-dragon');

let width, height;
let boids = [];
let npcs = [];
let dragons = [];
let deadNPCs = []; 
let deadDragons = []; 
let scores = { npc: 0, dragon: 0 };

let config = {
  flowEnabled: true, flowStrength: 1.0,
  numBoids: 150, numNPCs: 4, numDragons: 1, perceptionRadius: 60, maxSpeed: 2.5,
  maxForce: 0.05, alignWeight: 1.0, cohesionWeight: 1.2, separationWeight: 1.5
};

// UI Generation
const controlsContainer = document.getElementById('controls');

// 1. Create Dedicated River Flow Box
const flowBox = document.createElement('div');
flowBox.style.backgroundColor = 'rgba(12, 74, 110, 0.5)'; 
flowBox.style.border = '1px solid #0284c7'; 
flowBox.style.padding = '12px';
flowBox.style.borderRadius = '8px';
flowBox.style.marginBottom = '20px';
flowBox.innerHTML = `
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #0369a1; padding-bottom: 8px;">
    <label style="font-weight: 600; color: #7dd3fc; display: flex; align-items: center; gap: 8px;">
      🌊 River Flow
    </label>
    <input type="checkbox" id="flowEnabled" ${config.flowEnabled ? 'checked' : ''} title="Toggle River Current" style="cursor: pointer; width: 16px; height: 16px; accent-color: #f472b6;">
  </div>
  
  <div class="slider-container" style="margin-bottom: 12px;">
    <div class="slider-header">
      <label>Flow Strength</label>
      <span class="slider-val" id="val-flowStrength">${config.flowStrength}</span>
    </div>
    <input type="range" id="flowStrength" min="-5" max="5" step="0.1" value="${config.flowStrength}">
  </div>

  <div class="slider-container">
    <div class="slider-header">
      <label>Max Drift Speed</label>
      <span class="slider-val" id="val-maxSpeed">${config.maxSpeed}</span>
    </div>
    <input type="range" id="maxSpeed" min="1" max="10" step="0.5" value="${config.maxSpeed}">
  </div>
`;
controlsContainer.appendChild(flowBox);

// Event Listeners for the Flow Box
document.getElementById('flowEnabled').addEventListener('change', (e) => {
  config.flowEnabled = e.target.checked;
});
document.getElementById('flowStrength').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  config.flowStrength = val;
  document.getElementById('val-flowStrength').innerText = val;
});
document.getElementById('maxSpeed').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  config.maxSpeed = val;
  document.getElementById('val-maxSpeed').innerText = val;
});

// 2. Generate Remaining Sliders
const sliders = [
  { id: 'numBoids', label: 'Number of Flowers', min: 10, max: 500, step: 10 },
  { id: 'numNPCs', label: 'Number of Koi', min: 0, max: 16, step: 1 },
  { id: 'numDragons', label: 'Number of Dragons', min: 0, max: 5, step: 1 },
  { id: 'perceptionRadius', label: 'Eddy Radius', min: 10, max: 200, step: 5 }
];

sliders.forEach(s => {
  const div = document.createElement('div');
  div.className = 'slider-container';
  div.innerHTML = `
    <div class="slider-header">
      <label>${s.label}</label>
      <span class="slider-val" id="val-${s.id}">${config[s.id]}</span>
    </div>
    <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${config[s.id]}">
    <div id="dead-${s.id}" style="font-size: 0.8rem; height: 1rem; margin-top: 2px; text-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
  `;
  controlsContainer.appendChild(div);
  
  document.getElementById(s.id).addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    config[s.id] = val;
    document.getElementById(`val-${s.id}`).innerText = val;
  });
});
// Setup & Resize
function resize() {
  width = canvas.parentElement.clientWidth;
  height = canvas.parentElement.clientHeight;
  canvas.width = width; canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

function reset() {
  boids = []; npcs = []; dragons = [];
  deadNPCs = []; deadDragons = [];
  for (let i = 0; i < config.numBoids; i++) boids.push(new Boid(Math.random() * width, Math.random() * height));
  for (let i = 0; i < config.numNPCs; i++) npcs.push(new NPCKoi(Math.random() * width, Math.random() * height, i));
  for (let i = 0; i < config.numDragons; i++) dragons.push(new Dragon(width / 2, height / 2));
  scores.npc = 0; scores.dragon = 0;
  scoreNpcEl.innerText = 0; scoreDragonEl.innerText = 0;
}
document.getElementById('resetBtn').addEventListener('click', reset);

// Game Loop
reset();
function loop() {
  let now = Date.now();
  
  ctx.fillStyle = 'rgba(14, 165, 233, 0.2)'; 
  ctx.fillRect(0, 0, width, height);

  // Maintain Flowers
  if (boids.length < config.numBoids) {
    for (let i = boids.length; i < config.numBoids; i++) boids.push(new Boid(Math.random() * width, Math.random() * height));
  } else if (boids.length > config.numBoids) boids.splice(config.numBoids);

  // --- Respawn & Cooldown Logic ---
  deadNPCs = deadNPCs.filter(t => now - t < 10000); 
  deadDragons = deadDragons.filter(t => now - t < 20000);

  let allowedNPCs = Math.max(0, config.numNPCs - deadNPCs.length);
  let allowedDragons = Math.max(0, config.numDragons - deadDragons.length);

  // Update Skulls in UI
  document.getElementById('dead-numNPCs').innerText = '💀'.repeat(deadNPCs.length);
  document.getElementById('dead-numDragons').innerText = '💀'.repeat(deadDragons.length);

  // Sync Arrays with Allowed Capacities
  if (npcs.length < allowedNPCs) {
    for (let i = npcs.length; i < allowedNPCs; i++) npcs.push(new NPCKoi(Math.random() * width, Math.random() * height, npcs.length));
  } else if (npcs.length > allowedNPCs) {
    npcs.splice(allowedNPCs);
  }

  if (dragons.length < allowedDragons) {
    for (let i = dragons.length; i < allowedDragons; i++) dragons.push(new Dragon(Math.random() * width, Math.random() * height));
  } else if (dragons.length > allowedDragons) {
    dragons.splice(allowedDragons);
  }

  // Update Flowers (Boids)
  for (let boid of boids) {
    boid.flock(boids, config); 
    boid.update(config); 
    boid.edges(width, height); 
    boid.draw(ctx);
  }

  // Update Koi
  let npcEatenThisFrame = 0;
  for (let i = npcs.length - 1; i >= 0; i--) {
    let npc = npcs[i];
    
    // Starvation Check (3 seconds)
    if (now - npc.lastMeal > 3000) {
      npcs.splice(i, 1);
      deadNPCs.push(now); 
      continue;
    }
    
    npc.flee(dragons); 
    npcEatenThisFrame += npc.hunt(boids); 
    npc.update(config); 
    npc.edges(width, height); 
    npc.draw(ctx);
  }
  if (npcEatenThisFrame > 0) { 
    scores.npc += npcEatenThisFrame; 
    scoreNpcEl.innerText = scores.npc; 
  }

  // Update Dragons
  let dragonEatenThisFrame = 0;
  for (let i = dragons.length - 1; i >= 0; i--) {
    let dragon = dragons[i];
    
    // Dragon Starvation Check (10 seconds)
    if (now - dragon.lastMeal > 10000) {
      dragons.splice(i, 1);
      deadDragons.push(now);
      continue;
    }
    
    dragonEatenThisFrame += dragon.hunt(npcs);
    
    for(let j=0; j < dragonEatenThisFrame; j++) {
       deadNPCs.push(now);
    }

    dragon.update(config);
    dragon.edges(width, height);
    dragon.draw(ctx);
  }
  if (dragonEatenThisFrame > 0) {
    scores.dragon += dragonEatenThisFrame;
    scoreDragonEl.innerText = scores.dragon;
  }

  requestAnimationFrame(loop);
}
loop();