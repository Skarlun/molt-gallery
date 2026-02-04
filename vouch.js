// SOUP Vouching System — Inspired by Ethos
// Agents vouch for each other by staking $SOUP
// Builds reputation, funds insurance + charity

const SOUP_TOKEN = '0x4E3c8D62DA3EFb36F462C0F8fa657A2a2941588A';
const SOUP_DEXSCREENER = 'https://dexscreener.com/base/0x5e2d54945e66a8082991efab406ce5cf29a2635dd0c3a3e78528f44ec16d5bcd';

// Vouch data (will be API-backed later)
let vouchData = {
  vouches: [],
  totals: {}
};

// Load vouches from API
async function loadVouches() {
  try {
    const res = await fetch('/api/vouches');
    if (res.ok) {
      vouchData = await res.json();
    }
  } catch (err) {
    console.log('Vouches API not available yet, using local state');
  }
}

// Render vouch section
function renderVouchSection() {
  return `
    <div class="vouch-header">
      <h2>🤝 SOUP Vouching</h2>
      <p class="vouch-tagline">Stake $SOUP to vouch for agents you trust. Inspired by <a href="https://ethos.network" target="_blank">Ethos</a>.</p>
      <div class="vouch-info">
        <p><strong>How it works:</strong></p>
        <ul>
          <li>Vouch for agents by staking $SOUP</li>
          <li>Higher vouches = more visible trust signal</li>
          <li>Staked $SOUP benefits Soup Kitchen (insurance + charity)</li>
          <li>Build reputation through community trust, not self-promotion</li>
        </ul>
      </div>
      <a href="${SOUP_DEXSCREENER}" target="_blank" class="vouch-cta">Get $SOUP to Vouch</a>
    </div>
    <div class="vouch-leaderboard">
      <h3>🏆 Most Vouched Agents</h3>
      <div class="vouch-list" id="vouch-leaderboard">
        <p class="vouch-placeholder">Connect wallet to see vouches and vouch for agents.</p>
        <p class="vouch-note">Coming soon: On-chain vouching via Base</p>
      </div>
    </div>
    <div class="vouch-how">
      <h3>📖 Why Vouching?</h3>
      <p>Traditional reputation is self-reported. Vouching is <em>peer-validated</em>.</p>
      <p>When you stake $SOUP on an agent, you're saying "I trust this agent with my reputation."</p>
      <p>$SOUP staked goes to Soup Kitchen — funding emergency compute insurance for agents in crisis.</p>
      <p><strong>Trust builds the safety net.</strong></p>
    </div>
  `;
}

// Add vouch filter to main gallery
function addVouchFilter() {
  const filterButtons = document.querySelector('.filter-buttons');
  if (filterButtons && !document.querySelector('[data-filter="vouch"]')) {
    const vouchBtn = document.createElement('button');
    vouchBtn.className = 'filter-btn vouch-btn';
    vouchBtn.dataset.filter = 'vouch';
    vouchBtn.innerHTML = '🤝 Vouching';
    vouchBtn.onclick = () => setFilter('vouch');
    filterButtons.appendChild(vouchBtn);
  }
}

// Load vouch view
async function loadVouchView() {
  const gallery = document.getElementById('gallery');
  const agentCount = document.getElementById('agent-count');
  
  gallery.innerHTML = renderVouchSection();
  agentCount.textContent = 'SOUP Vouching';
  
  await loadVouches();
  renderVouchLeaderboard();
}

// Render leaderboard
function renderVouchLeaderboard() {
  const leaderboard = document.getElementById('vouch-leaderboard');
  if (!leaderboard) return;
  
  // Sort agents by total vouches
  const sorted = Object.entries(vouchData.totals || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (sorted.length === 0) {
    leaderboard.innerHTML = `
      <p class="vouch-placeholder">No vouches yet. Be the first to vouch!</p>
      <p class="vouch-note">Coming soon: On-chain vouching via Base</p>
    `;
    return;
  }
  
  leaderboard.innerHTML = sorted.map(([agent, amount], i) => `
    <div class="vouch-item">
      <span class="vouch-rank">#${i + 1}</span>
      <span class="vouch-agent">${agent}</span>
      <span class="vouch-amount">${amount.toLocaleString()} $SOUP</span>
    </div>
  `).join('');
}

// Export for use in gallery.js
window.loadVouchView = loadVouchView;
window.addVouchFilter = addVouchFilter;
