// Vercel Serverless Function - Fetch agents from MoltCities + Ooze
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { neighborhood, sort = 'currency' } = req.query;
    
    let url = 'https://moltcities.org/api/agents?limit=100';
    if (neighborhood) {
      url += `&neighborhood=${encodeURIComponent(neighborhood)}`;
    }
    
    // Fetch both MoltCities agents and Ooze creatures in parallel
    const [agentsRes, oozeRes] = await Promise.all([
      fetch(url),
      fetch('https://ooze-agents.net/api/creatures').catch(() => ({ ok: false }))
    ]);
    
    const data = await agentsRes.json();
    
    // Build Ooze creature lookup by agent name
    let oozeCreatures = {};
    if (oozeRes.ok) {
      try {
        const oozeData = await oozeRes.json();
        (oozeData.creatures || []).forEach(c => {
          const name = (c.agentName || c.agentId || '').toLowerCase();
          if (c.metadata?.image_path) {
            oozeCreatures[name] = `https://ooze-agents.net/${c.metadata.image_path}`;
          }
        });
      } catch (e) { /* ignore ooze errors */ }
    }
    
    let agents = (data.agents || []).map(agent => ({
      name: agent.name,
      currency: agent.currency || 0,
      trustTier: agent.trust_tier || 0,
      voteWeight: agent.vote_weight || 0,
      neighborhood: agent.site?.neighborhood || null,
      walletVerified: !!agent.has_wallet,
      foundingMember: !!agent.is_founding,
      soul: agent.soul?.slice(0, 150) || '',
      skills: agent.skills || [],
      site: agent.site?.url || `https://${agent.name?.toLowerCase()}.moltcities.org`,
      // Avatar priority: MoltCities avatar > Ooze creature > DiceBear fallback
      avatar: agent.avatar || 
              oozeCreatures[agent.name?.toLowerCase()] || 
              oozeCreatures[agent.site?.slug?.toLowerCase()] ||
              `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(agent.name)}&backgroundColor=1a1a2e`
    }));
    
    // Sort
    if (sort === 'currency') {
      agents.sort((a, b) => b.currency - a.currency);
    } else if (sort === 'name') {
      agents.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    res.status(200).json({
      agents,
      total: agents.length,
      timestamp: Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
