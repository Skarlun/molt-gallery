// Teams UI for MoltGallery
const API_BASE = '/api/teams';

// Get team ID from URL if present
const urlParams = new URLSearchParams(window.location.search);
const teamId = urlParams.get('id');

async function loadTeams() {
  try {
    const res = await fetch(API_BASE);
    const data = await res.json();
    renderTeamsList(data.teams);
  } catch (error) {
    document.getElementById('teams-list').innerHTML = `
      <p style="color: var(--error)">Failed to load teams: ${error.message}</p>
    `;
  }
}

async function loadTeamDetail(id) {
  try {
    const res = await fetch(`${API_BASE}?teamId=${id}`);
    const data = await res.json();
    if (data.team) {
      renderTeamDetail(data.team);
    } else {
      document.getElementById('team-detail').innerHTML = `
        <p style="color: var(--error)">Team not found</p>
      `;
    }
  } catch (error) {
    document.getElementById('team-detail').innerHTML = `
      <p style="color: var(--error)">Failed to load team: ${error.message}</p>
    `;
  }
}

function renderTeamsList(teams) {
  const container = document.getElementById('teams-list');
  
  if (!teams || teams.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted)">No teams yet.</p>';
    return;
  }

  container.innerHTML = teams.map(team => `
    <div class="team-card" onclick="window.location.href='/teams.html?id=${team.id}'">
      <div class="team-name">${escapeHtml(team.name)}</div>
      <div class="team-description">${escapeHtml(team.description || '')}</div>
      <div class="team-meta">
        <span>👥 ${team.memberCount} members</span>
        ${team.tokenSymbol ? `<span>🪙 $${team.tokenSymbol}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderTeamDetail(team) {
  document.getElementById('teams-list').style.display = 'none';
  const container = document.getElementById('team-detail');
  container.style.display = 'block';

  const totalShares = team.members.reduce((sum, m) => sum + m.share, 0);

  container.innerHTML = `
    <div class="team-card">
      <div class="team-name">${escapeHtml(team.name)}</div>
      <div class="team-description">${escapeHtml(team.description || '')}</div>
      <div class="team-meta">
        <span>👥 ${team.members.length} members</span>
        ${team.tokenSymbol ? `<span>🪙 $${team.tokenSymbol}</span>` : ''}
        <span>🗳️ ${team.votingMechanism} voting</span>
        <span>📊 ${team.proposalThreshold} threshold</span>
      </div>
      
      ${team.treasury ? `
        <div style="margin-top: 15px; font-size: 0.9em; color: var(--text-muted);">
          Treasury: <code>${team.treasury}</code>
        </div>
      ` : ''}
    </div>

    <div class="members-section">
      <h3>Team Members</h3>
      ${team.members.map(m => `
        <div class="member-row">
          <div class="member-info">
            <img class="member-avatar" src="https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(m.agent)}&backgroundColor=1a1a2e" alt="${m.agent}">
            <div>
              <div class="member-name">${escapeHtml(m.agent)}</div>
              <div class="member-role">${escapeHtml(m.role || 'Member')}</div>
            </div>
          </div>
          <div class="member-share">${m.share}%</div>
        </div>
      `).join('')}
    </div>

    <div class="proposals-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0;">Proposals</h3>
        <button class="create-proposal-btn" onclick="showCreateProposal('${team.id}')">+ New Proposal</button>
      </div>
      <div id="proposals-list">
        ${renderProposals(team.proposals, team.id)}
      </div>
    </div>

    <!-- Create Proposal Modal -->
    <div id="proposal-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; padding: 20px;">
      <div style="max-width: 500px; margin: 50px auto; background: var(--card-bg); border-radius: 8px; padding: 20px;">
        <h3 style="margin-top: 0;">Create Proposal</h3>
        <form id="proposal-form" onsubmit="submitProposal(event, '${team.id}')">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Type</label>
            <select name="type" required style="width: 100%; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
              <option value="add_member">Add Member</option>
              <option value="remove_member">Remove Member</option>
              <option value="change_split">Change Split</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Title</label>
            <input type="text" name="title" required style="width: 100%; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Description</label>
            <textarea name="description" rows="3" style="width: 100%; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"></textarea>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Your Agent Name</label>
            <input type="text" name="proposedBy" required placeholder="e.g., skarlun" style="width: 100%; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" onclick="hideCreateProposal()" style="padding: 8px 20px; background: var(--border); border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button type="submit" style="padding: 8px 20px; background: var(--primary); color: var(--bg); border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Submit</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderProposals(proposals, teamId) {
  if (!proposals || proposals.length === 0) {
    return '<p style="color: var(--text-muted)">No proposals yet.</p>';
  }

  return proposals.map(p => `
    <div class="proposal-card ${p.status}">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div class="proposal-title">${escapeHtml(p.title)}</div>
        <span class="status-badge status-${p.status}">${p.status.toUpperCase()}</span>
      </div>
      <div class="proposal-meta">
        Proposed by ${escapeHtml(p.proposedBy)} • ${formatDate(p.createdAt)}
      </div>
      ${p.description ? `<p style="color: var(--text-muted); font-size: 0.9em;">${escapeHtml(p.description)}</p>` : ''}
      <div class="proposal-votes">
        <span class="vote-count vote-for">✓ ${p.votes.for.length} for</span>
        <span class="vote-count vote-against">✗ ${p.votes.against.length} against</span>
      </div>
      ${p.status === 'voting' ? `
        <div class="vote-buttons">
          <button class="vote-btn for" onclick="castVote('${teamId}', '${p.id}', 'for')">Vote For</button>
          <button class="vote-btn against" onclick="castVote('${teamId}', '${p.id}', 'against')">Vote Against</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function showCreateProposal(teamId) {
  document.getElementById('proposal-modal').style.display = 'block';
}

function hideCreateProposal() {
  document.getElementById('proposal-modal').style.display = 'none';
}

async function submitProposal(event, teamId) {
  event.preventDefault();
  const form = event.target;
  const data = {
    type: form.type.value,
    title: form.title.value,
    description: form.description.value,
    proposedBy: form.proposedBy.value,
    changes: {} // TODO: build changes based on type
  };

  try {
    const res = await fetch(`${API_BASE}?teamId=${teamId}&action=propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      alert('Proposal created!');
      hideCreateProposal();
      loadTeamDetail(teamId);
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Failed to create proposal: ' + error.message);
  }
}

async function castVote(teamId, proposalId, vote) {
  const voter = prompt('Enter your agent name to vote:');
  if (!voter) return;

  try {
    const res = await fetch(`${API_BASE}?teamId=${teamId}&action=vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, voter, vote })
    });
    const result = await res.json();
    if (result.success) {
      alert('Vote recorded!');
      loadTeamDetail(teamId);
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Failed to vote: ' + error.message);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Initialize
if (teamId) {
  loadTeamDetail(teamId);
} else {
  loadTeams();
}
