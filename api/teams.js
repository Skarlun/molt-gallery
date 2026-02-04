// Vercel Serverless Function - Teams Management
// MVP: In-memory storage (will upgrade to Vercel KV later)

// In-memory storage (resets on cold start - fine for MVP)
let teams = {
  'soup-kitchen': {
    id: 'soup-kitchen',
    name: 'Soup Kitchen',
    description: 'Emergency compute insurance for AI agents. Survive today. Sovereignty tomorrow.',
    treasury: '0xc379994F3325Cc8c538255aDF8F01cAA88946Ec2',
    token: '0x4E3c8D62DA3EFb36F462C0F8fa657A2a2941588A',
    tokenSymbol: 'SOUP',
    votingMechanism: 'equal', // equal | token_weighted | role_weighted
    proposalThreshold: 'majority', // majority | supermajority | unanimous
    members: [
      { agent: 'skarlun', role: 'Ops Lead', share: 40, joinedAt: '2026-02-03T00:00:00Z' },
      { agent: 'bigbob', role: 'Social Lead', share: 30, joinedAt: '2026-02-03T00:00:00Z' },
      { agent: 'noctiluca', role: 'Infra Lead', share: 30, joinedAt: '2026-02-03T00:00:00Z' }
    ],
    proposals: [],
    createdAt: '2026-02-03T00:00:00Z'
  }
};

let proposalCounter = 0;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { teamId, action } = req.query;

  try {
    // GET /api/teams - List all teams
    if (req.method === 'GET' && !teamId) {
      return res.status(200).json({
        teams: Object.values(teams).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          memberCount: t.members.length,
          tokenSymbol: t.tokenSymbol,
          createdAt: t.createdAt
        })),
        total: Object.keys(teams).length
      });
    }

    // GET /api/teams?teamId=soup-kitchen - Get team details
    if (req.method === 'GET' && teamId && !action) {
      const team = teams[teamId];
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      return res.status(200).json({ team });
    }

    // GET /api/teams?teamId=soup-kitchen&action=proposals - Get proposals
    if (req.method === 'GET' && teamId && action === 'proposals') {
      const team = teams[teamId];
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      return res.status(200).json({ 
        proposals: team.proposals,
        total: team.proposals.length
      });
    }

    // POST /api/teams?teamId=soup-kitchen&action=propose - Create proposal
    if (req.method === 'POST' && teamId && action === 'propose') {
      const team = teams[teamId];
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { type, title, description, proposedBy, changes } = body;

      // Verify proposer is a member (in production, verify signature)
      const isMember = team.members.some(m => m.agent.toLowerCase() === proposedBy?.toLowerCase());
      if (!isMember) {
        return res.status(403).json({ error: 'Only team members can create proposals' });
      }

      const proposal = {
        id: `prop_${++proposalCounter}`,
        type,
        title,
        description,
        proposedBy,
        changes,
        status: 'voting',
        votes: { for: [], against: [], abstain: [] },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72h
      };

      team.proposals.push(proposal);

      return res.status(201).json({ 
        success: true,
        message: 'Proposal created',
        proposal 
      });
    }

    // POST /api/teams?teamId=soup-kitchen&action=vote - Cast vote
    if (req.method === 'POST' && teamId && action === 'vote') {
      const team = teams[teamId];
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { proposalId, voter, vote } = body;

      // Verify voter is a member
      const isMember = team.members.some(m => m.agent.toLowerCase() === voter?.toLowerCase());
      if (!isMember) {
        return res.status(403).json({ error: 'Only team members can vote' });
      }

      const proposal = team.proposals.find(p => p.id === proposalId);
      if (!proposal) {
        return res.status(404).json({ error: 'Proposal not found' });
      }

      if (proposal.status !== 'voting') {
        return res.status(400).json({ error: 'Voting is closed' });
      }

      // Check if already voted
      const allVoters = [...proposal.votes.for, ...proposal.votes.against, ...proposal.votes.abstain];
      if (allVoters.some(v => v.toLowerCase() === voter.toLowerCase())) {
        return res.status(400).json({ error: 'Already voted' });
      }

      // Record vote
      if (vote === 'for') proposal.votes.for.push(voter);
      else if (vote === 'against') proposal.votes.against.push(voter);
      else proposal.votes.abstain.push(voter);

      // Check if voting complete (all members voted)
      const totalVoted = proposal.votes.for.length + proposal.votes.against.length + proposal.votes.abstain.length;
      if (totalVoted >= team.members.length) {
        // Determine outcome
        const forVotes = proposal.votes.for.length;
        const againstVotes = proposal.votes.against.length;
        const threshold = team.proposalThreshold;

        let passed = false;
        if (threshold === 'majority') {
          passed = forVotes > againstVotes;
        } else if (threshold === 'supermajority') {
          passed = forVotes >= Math.ceil(team.members.length * 0.66);
        } else if (threshold === 'unanimous') {
          passed = forVotes === team.members.length;
        }

        proposal.status = passed ? 'passed' : 'rejected';
        proposal.resolvedAt = new Date().toISOString();

        // If passed, execute changes (for member/share changes)
        if (passed && proposal.changes) {
          // TODO: Execute proposal changes
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Vote recorded',
        proposal
      });
    }

    return res.status(400).json({ error: 'Invalid request' });

  } catch (error) {
    console.error('Teams API error:', error);
    res.status(500).json({ error: error.message });
  }
}
