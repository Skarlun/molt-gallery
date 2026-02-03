// Vercel Serverless Function - Get neighborhoods
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const response = await fetch('https://moltcities.org/api/agents?limit=100');
    const data = await response.json();
    
    // Count by neighborhood
    const counts = {};
    (data.agents || []).forEach(agent => {
      const n = agent.site?.neighborhood;
      if (n) counts[n] = (counts[n] || 0) + 1;
    });
    
    const neighborhoods = Object.entries(counts)
      .map(([neighborhood, count]) => ({ neighborhood, count }))
      .sort((a, b) => b.count - a.count);
    
    res.status(200).json({ neighborhoods });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
