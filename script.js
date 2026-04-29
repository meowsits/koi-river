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
      this.acc.x += config.flowStrength * 0.05; 
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

  flee(dragonGroups) {
    let steer = new Vector(0, 0);
    let count = 0;
    const fleeRadiusSq = 120 * 120; 
    
    // Check all types of dragons
    for (let type in dragonGroups) {
      for (let d of dragonGroups[type]) {
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
    let closestDist = Infinity; let closestBoid = null;
    for (let i = boids.length - 1; i >= 0; i--) {
      let boid = boids[i];
      let dSq = this.pos.distSq(boid.pos);
      if (dSq < this.eatRadiusSq) { 
        boids.splice(i, 1); 
      } else if (dSq < closestDist) { 
        closestDist = dSq; closestBoid = boid; 
      }
    }

    if (closestBoid && this.acc.magSq() === 0) { 
      this.acc.add(this.seek(closestBoid.pos)); 
    }
  }

  update(config) {
    if (config.flowEnabled) {
      this.acc.x += config.flowStrength * 0.05; 
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

// --- RPS Dragon Class ---
class Dragon {
  constructor(x, y, type) {
    this.pos = new Vector(x, y);
    this.vel = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    this.acc = new Vector(0, 0);
    this.maxSpeed = 2.6; 
    this.maxForce = 0.06; 
    this.eatRadiusSq = 40 * 40; 
    this.history = []; 
    this.type = type;

    // Rock-Paper-Scissors Rules
    const rpsRules = {
      rock: { eats: 'scissors', flees: 'paper' },
      paper: { eats: 'rock', flees: 'scissors' },
      scissors: { eats: 'paper', flees: 'rock' }
    };
    this.preyType = rpsRules[type].eats;
    this.predatorType = rpsRules[type].flees;

    // Assign specific elemental colors
    if (type === 'rock') {
      this.cBody = '#52525b'; this.cStroke = '#27272a'; this.cHead = '#3f3f46'; this.cAccent = '#a1a1aa';
    } else if (type === 'paper') {
      this.cBody = '#e2e8f0'; this.cStroke = '#94a3b8'; this.cHead = '#cbd5e1'; this.cAccent = '#ffffff';
    } else if (type === 'scissors') {
      this.cBody = '#dc2626'; this.cStroke = '#7f1d1d'; this.cHead = '#b91c1c'; this.cAccent = '#fca5a5';
    }
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

  flee(dragonGroups) {
    let steer = new Vector(0, 0);
    let count = 0;
    const fleeRadiusSq = 120 * 120; 
    let predators = dragonGroups[this.predatorType];

    for (let p of predators) {
      let dSq = this.pos.distSq(p.pos);
      if (dSq < fleeRadiusSq) {
        let diff = this.pos.copy();
        diff.sub(p.pos);
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
      steer.limit(this.maxForce * 2); // Panic surge
      this.acc.add(steer);
    }
  }

  hunt(kois, dragonGroups, deadNPCs, deadDragons, now) {
    let closestDist = Infinity; 
    let closestTarget = null;

    // 1. Hunt Kois
    for (let i = kois.length - 1; i >= 0; i--) {
      let koi = kois[i];
      let dSq = this.pos.distSq(koi.pos);
      if (dSq < this.eatRadiusSq) { 
        kois.splice(i, 1); 
        deadNPCs.push(now); 
      } else if (dSq < closestDist) { 
        closestDist = dSq; 
        closestTarget = koi.pos; 
      }
    }

    // 2. Hunt Specific RPS Rival
    let preyArray = dragonGroups[this.preyType];
    for (let i = preyArray.length - 1; i >= 0; i--) {
      let enemy = preyArray[i];
      let dSq = this.pos.distSq(enemy.pos);
      if (dSq < this.eatRadiusSq) {
        preyArray.splice(i, 1);
        deadDragons[this.preyType].push(now); 
      } else if (dSq < closestDist) {
        closestDist = dSq;
        closestTarget = enemy.pos;
      }
    }

    // Only seek prey if not currently fleeing from a predator
    if (closestTarget && this.acc.magSq() === 0) { 
      this.acc.add(this.seek(closestTarget)); 
    }
  }

  update(config) {
    if (config.flowEnabled) {
      this.acc.x += config.flowStrength * 0.05; 
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
    
    ctx.fillStyle = this.cBody; 
    ctx.strokeStyle = this.cStroke;
    for (let i = 0; i < this.history.length; i += 2) {
      let pt = this.history[i];
      let radius = Math.max(2, 15 - (i / 1.5)); 
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(angle);
    
    ctx.fillStyle = this.cHead; 
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2); ctx.fill();
    
    ctx.strokeStyle = this.cAccent;
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

let width, height;
let boids = [];
let npcs = [];
// RPS Dragons mapped by type
let dragons = { rock: [], paper: [], scissors: [] };

// Track death timestamps for UI skulls and respawn cooldowns
let deadNPCs = []; 
let deadDragons = { rock: [], paper: [], scissors: [] };

let config = {
  flowEnabled: true, flowStrength: 0.0,
  numBoids: 50, numNPCs: 5, perceptionRadius: 60, maxSpeed: 1,
  numRock: 0, numPaper: 0, numScissors: 0,
  maxForce: 0.05, alignWeight: 1.0, cohesionWeight: 1.2, separationWeight: 1.5
};

// --- UI Generation ---
const controlsContainer = document.getElementById('controls');
controlsContainer.innerHTML = ''; // Clear previous controls

// Generate River Flow UI Box
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

document.getElementById('flowEnabled').addEventListener('change', (e) => config.flowEnabled = e.target.checked);
document.getElementById('flowStrength').addEventListener('input', (e) => {
  config.flowStrength = parseFloat(e.target.value);
  document.getElementById('val-flowStrength').innerText = config.flowStrength;
});
document.getElementById('maxSpeed').addEventListener('input', (e) => {
  config.maxSpeed = parseFloat(e.target.value);
  document.getElementById('val-maxSpeed').innerText = config.maxSpeed;
});

// Generate Ecosystem Sliders
// Notice: The 'perceptionRadius' object has been removed from this array!
const sliders = [
  { id: 'numBoids', label: '🌸 Flowers', min: 10, max: 500, step: 10 },
  { id: 'numNPCs', label: '🐟 Koi', min: 0, max: 16, step: 1 },
  { id: 'numRock', label: '🪨 Rock Dragons', min: 0, max: 4, step: 1 },
  { id: 'numPaper', label: '📄 Paper Dragons', min: 0, max: 4, step: 1 },
  { id: 'numScissors', label: '✂️ Scissors Dragons', min: 0, max: 4, step: 1 }
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
    config[s.id] = parseFloat(e.target.value);
    document.getElementById(`val-${s.id}`).innerText = config[s.id];
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
  boids = []; npcs = []; 
  dragons = { rock: [], paper: [], scissors: [] };
  deadNPCs = []; 
  deadDragons = { rock: [], paper: [], scissors: [] };
  
  for (let i = 0; i < config.numBoids; i++) boids.push(new Boid(Math.random() * width, Math.random() * height));
  for (let i = 0; i < config.numNPCs; i++) npcs.push(new NPCKoi(Math.random() * width, Math.random() * height, i));
  
  const types = ['rock', 'paper', 'scissors'];
  for (let t of types) {
    let confName = `num${t.charAt(0).toUpperCase() + t.slice(1)}`;
    for (let i = 0; i < config[confName]; i++) {
      dragons[t].push(new Dragon(width / 2, height / 2, t));
    }
  }
}
document.getElementById('resetBtn').addEventListener('click', reset);

// --- Primary Game Loop ---
reset();
function loop() {
  let now = Date.now();
  
  ctx.fillStyle = 'rgba(14, 165, 233, 0.2)'; 
  ctx.fillRect(0, 0, width, height);

  // Maintain Flowers
  if (boids.length < config.numBoids) {
    for (let i = boids.length; i < config.numBoids; i++) boids.push(new Boid(Math.random() * width, Math.random() * height));
  } else if (boids.length > config.numBoids) boids.splice(config.numBoids);

  // Maintain Koi Respawns & UI
  deadNPCs = deadNPCs.filter(t => now - t < 10000); 
  let allowedNPCs = Math.max(0, config.numNPCs - deadNPCs.length);
  document.getElementById('dead-numNPCs').innerText = '💀'.repeat(deadNPCs.length);

  if (npcs.length < allowedNPCs) {
    for (let i = npcs.length; i < allowedNPCs; i++) npcs.push(new NPCKoi(Math.random() * width, Math.random() * height, npcs.length));
  } else if (npcs.length > allowedNPCs) {
    npcs.splice(allowedNPCs);
  }

  // Maintain Dragon Respawns & UI
  const types = ['rock', 'paper', 'scissors'];
  for (let t of types) {
    // 20 second cooldown for dragons
    deadDragons[t] = deadDragons[t].filter(time => now - time < 20000);
    
    let confName = `num${t.charAt(0).toUpperCase() + t.slice(1)}`; 
    let allowed = Math.max(0, config[confName] - deadDragons[t].length);
    
    let uiElement = document.getElementById(`dead-${confName}`);
    if (uiElement) uiElement.innerText = '💀'.repeat(deadDragons[t].length);

    if (dragons[t].length < allowed) {
      for (let i = dragons[t].length; i < allowed; i++) dragons[t].push(new Dragon(Math.random() * width, Math.random() * height, t));
    } else if (dragons[t].length > allowed) {
      dragons[t].splice(allowed);
    }
  }

  // Update Flowers
  for (let boid of boids) {
    boid.flock(boids, config); 
    boid.update(config); 
    boid.edges(width, height); 
    boid.draw(ctx);
  }

  // Update Koi
  for (let i = npcs.length - 1; i >= 0; i--) {
    let npc = npcs[i];
    npc.flee(dragons); 
    npc.hunt(boids); 
    npc.update(config); 
    npc.edges(width, height); 
    npc.draw(ctx);
  }

  // Update Dragons
  for (let t of types) {
    for (let i = dragons[t].length - 1; i >= 0; i--) {
      let dragon = dragons[t][i];
      dragon.flee(dragons); 
      dragon.hunt(npcs, dragons, deadNPCs, deadDragons, now); 
      dragon.update(config);
      dragon.edges(width, height);
      dragon.draw(ctx);
    }
  }

  requestAnimationFrame(loop);
}
loop();
