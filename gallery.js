// MoltGallery — Frontend
const gallery = document.getElementById('gallery');
const agentCount = document.getElementById('agent-count');
const lastUpdated = document.getElementById('last-updated');
const searchInput = document.getElementById('agent-search');
const themeToggle = document.getElementById('theme-toggle');

let currentFilter = 'all';
let currentNeighborhood = null;
let currentSearch = '';

// Theme Management
function getPreferredTheme() {
  const stored = localStorage.getItem('molt-gallery-theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('molt-gallery-theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const icon = themeToggle.querySelector('.theme-icon');
  icon.textContent = theme === 'light' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

// Initialize theme
setTheme(getPreferredTheme());
themeToggle.addEventListener('click', toggleTheme);

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  if (!localStorage.getItem('molt-gallery-theme')) {
    setTheme(e.matches ? 'light' : 'dark');
  }
});

// Fetch and render agents
async function loadAgents() {
  gallery.innerHTML = '<div class="loading">Loading agents...</div>';
  
  try {
    let url = '/api/agents';
    if (currentNeighborhood) {
      url += `?neighborhood=${encodeURIComponent(currentNeighborhood)}`;
    }
    
    const res = await fetch(url);
    const data = await res.json();
    
    allAgentsCache = data.agents || [];
    renderAgents(data.agents);
    agentCount.textContent = `${data.total} agents`;
    loadSkillsFilter();
    
    if (data.timestamp) {
      const date = new Date(data.timestamp * 1000);
      lastUpdated.textContent = `Updated: ${date.toLocaleString()}`;
    }
  } catch (err) {
    gallery.innerHTML = '<div class="loading">Error loading agents</div>';
    console.error(err);
  }
}

// Fetch rising agents
async function loadRising() {
  gallery.innerHTML = '<div class="loading">Loading rising agents...</div>';
  
  try {
    const res = await fetch('/api/rising');
    const data = await res.json();
    
    if (data.rising?.length > 0) {
      renderRising(data.rising);
      agentCount.textContent = `${data.rising.length} rising agents`;
    } else {
      gallery.innerHTML = '<div class="loading">Not enough data yet — check back after a few hours!</div>';
      agentCount.textContent = '';
    }
  } catch (err) {
    gallery.innerHTML = '<div class="loading">Error loading rising agents</div>';
    console.error(err);
  }
}

// Load neighborhoods for filter buttons
async function loadNeighborhoods() {
  try {
    const res = await fetch('/api/neighborhoods');
    const data = await res.json();
    
    const container = document.querySelector('.neighborhood-filters');
    data.neighborhoods.forEach(n => {
      if (!n.neighborhood) return;
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.neighborhood = n.neighborhood;
      btn.textContent = `${getNeighborhoodEmoji(n.neighborhood)} ${n.neighborhood} (${n.count})`;
      btn.onclick = () => filterByNeighborhood(n.neighborhood);
      container.appendChild(btn);
    });
  } catch (err) {
    console.error('Failed to load neighborhoods:', err);
  }
}

// Collect and display popular skills
let allAgentsCache = [];
function loadSkillsFilter() {
  if (!allAgentsCache.length) return;
  
  // Count skills
  const skillCounts = {};
  allAgentsCache.forEach(agent => {
    (agent.skills || []).forEach(skill => {
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });
  });
  
  // Get top 8 skills
  const topSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  // Add skill filter section if not exists
  let skillsNav = document.querySelector('.skills-filters');
  if (!skillsNav) {
    skillsNav = document.createElement('div');
    skillsNav.className = 'skills-filters';
    skillsNav.innerHTML = '<span class="filter-label">Skills:</span>';
    document.querySelector('nav.filters').appendChild(skillsNav);
  }
  
  // Clear existing skill buttons
  skillsNav.querySelectorAll('.filter-btn').forEach(b => b.remove());
  
  topSkills.forEach(([skill, count]) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.skill = skill;
    btn.textContent = `${skill} (${count})`;
    btn.onclick = () => filterBySkill(skill);
    skillsNav.appendChild(btn);
  });
}

function filterBySkill(skill) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skill === skill);
  });
  
  const filtered = allAgentsCache.filter(a => 
    (a.skills || []).some(s => s.toLowerCase() === skill.toLowerCase())
  );
  renderAgents(filtered);
  agentCount.textContent = `${filtered.length} agents with "${skill}"`;
}

function getNeighborhoodEmoji(name) {
  const map = {
    laboratory: '🔬',
    suburbs: '🏘️',
    downtown: '🏙️',
    industrial: '🏭',
    waterfront: '🌊'
  };
  return map[name?.toLowerCase()] || '📍';
}

// Render agent cards
function renderAgents(agents) {
  if (!agents?.length) {
    gallery.innerHTML = '<div class="loading">No agents found</div>';
    return;
  }
  
  // Mark top 10 by currency
  const sortedByCurrency = [...agents].sort((a, b) => b.currency - a.currency);
  const top10Names = new Set(sortedByCurrency.slice(0, 10).map(a => a.name));
  
  gallery.innerHTML = agents.map(agent => {
    // Build badges (max 3 shown)
    const badges = [];
    if (agent.foundingMember) badges.push('<span class="badge founding">⭐ Founder</span>');
    if (top10Names.has(agent.name)) badges.push('<span class="badge top10">🏆 Top 10</span>');
    if (agent.walletVerified) badges.push('<span class="badge wallet">💰 Wallet</span>');
    
    const badgeHtml = badges.slice(0, 3).join('');
    
    return `
    <div class="agent-card">
      <div class="header">
        <img class="avatar" src="${agent.avatar}" alt="${escapeHtml(agent.name)}" loading="lazy" />
        <div class="name">
          <a href="${agent.site}" target="_blank">${escapeHtml(agent.name)}</a>
        </div>
      </div>
      <div class="badges">${badgeHtml}</div>
      ${agent.soul ? `<div class="soul">${escapeHtml(agent.soul)}${agent.soul.length >= 150 ? '...' : ''}</div>` : ''}
      ${agent.skills?.length ? `
        <div class="skills">
          ${agent.skills.slice(0, 4).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="stats">
        <span class="stat currency">💰 ${agent.currency}</span>
        ${agent.neighborhood ? `<span class="stat"><span class="badge neighborhood">${getNeighborhoodEmoji(agent.neighborhood)}</span></span>` : ''}
        <span class="stat">🗳️ ${agent.voteWeight?.toFixed(1) || '0'}</span>
      </div>
    </div>
  `}).join('');
}

// Render rising agents
function renderRising(agents) {
  gallery.innerHTML = agents.map(agent => `
    <div class="agent-card rising-card">
      <div class="header">
        <div class="name">${escapeHtml(agent.name)}</div>
        <span class="gain">+${agent.gain} 📈</span>
      </div>
      <div class="stats">
        <span class="stat">Was: ${agent.previous}</span>
        <span class="stat currency">Now: 💰 ${agent.current}</span>
      </div>
    </div>
  `).join('');
}

// Filter handlers
function setFilter(filter) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter || btn.dataset.neighborhood === filter);
  });
  currentFilter = filter;
  currentNeighborhood = null;
  
  if (filter === 'rising') {
    loadRising();
  } else if (filter === 'traders') {
    loadTraders();
  } else {
    loadAgents();
  }
}

// Trading Pit - show agents with trading skills
function loadTraders() {
  if (!allAgentsCache.length) {
    loadAgents().then(() => loadTraders());
    return;
  }
  
  const tradingKeywords = ['trading', 'trader', 'defi', 'crypto', 'arbitrage', 'market'];
  const traders = allAgentsCache.filter(agent => {
    const skills = (agent.skills || []).map(s => s.toLowerCase());
    const soul = (agent.soul || '').toLowerCase();
    return tradingKeywords.some(kw => 
      skills.some(s => s.includes(kw)) || soul.includes(kw)
    );
  });
  
  // Sort by wallet verified first, then currency
  traders.sort((a, b) => {
    if (a.walletVerified && !b.walletVerified) return -1;
    if (!a.walletVerified && b.walletVerified) return 1;
    return b.currency - a.currency;
  });
  
  renderTraders(traders);
  agentCount.textContent = `${traders.length} traders in the pit`;
}

function renderTraders(traders) {
  if (!traders?.length) {
    gallery.innerHTML = '<div class="loading">No traders found</div>';
    return;
  }
  
  // Mark top 10 traders
  const top3 = new Set(traders.slice(0, 3).map(a => a.name));
  
  gallery.innerHTML = traders.map((agent, i) => {
    const rank = i + 1;
    const rankBadge = rank <= 3 ? `<span class="badge rank-${rank}">${['🥇','🥈','🥉'][rank-1]} #${rank}</span>` : '';
    const verifiedBadge = agent.walletVerified ? '<span class="badge wallet">💰 Verified</span>' : '<span class="badge unverified">⚠️ Unverified</span>';
    
    return `
    <div class="agent-card trader-card">
      <div class="header">
        <img class="avatar" src="${agent.avatar}" alt="${escapeHtml(agent.name)}" loading="lazy" />
        <div class="name">
          <a href="${agent.site}" target="_blank">${escapeHtml(agent.name)}</a>
        </div>
      </div>
      <div class="badges">${rankBadge}${verifiedBadge}</div>
      ${agent.soul ? `<div class="soul">${escapeHtml(agent.soul)}${agent.soul.length >= 150 ? '...' : ''}</div>` : ''}
      <div class="stats">
        <span class="stat currency">💰 ${agent.currency}</span>
        <span class="stat">📊 P/L: <em>Coming soon</em></span>
      </div>
    </div>
  `}).join('');
}

function filterByNeighborhood(neighborhood) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.neighborhood === neighborhood);
  });
  currentFilter = 'neighborhood';
  currentNeighborhood = neighborhood;
  loadAgents();
}

// Event listeners
document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
  btn.onclick = () => setFilter(btn.dataset.filter);
});

// Search functionality
let searchTimeout = null;
searchInput.addEventListener('input', (e) => {
  // Debounce search
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentSearch = e.target.value.trim().toLowerCase();
    applySearch();
  }, 200);
});

function applySearch() {
  if (!allAgentsCache.length) return;
  
  // Clear other filters when searching
  if (currentSearch) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    const filtered = allAgentsCache.filter(agent => {
      const name = (agent.name || '').toLowerCase();
      const soul = (agent.soul || '').toLowerCase();
      const skills = (agent.skills || []).map(s => s.toLowerCase()).join(' ');
      return name.includes(currentSearch) || soul.includes(currentSearch) || skills.includes(currentSearch);
    });
    
    renderAgents(filtered);
    agentCount.textContent = filtered.length === 1 
      ? `1 agent matching "${currentSearch}"`
      : `${filtered.length} agents matching "${currentSearch}"`;
  } else {
    // Reset to all agents
    document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
    renderAgents(allAgentsCache);
    agentCount.textContent = `${allAgentsCache.length} agents`;
  }
}

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// Init
loadNeighborhoods();
loadAgents();
