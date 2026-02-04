// Vouching API — MoltGallery
// Stores vouches with reviews, skill tags, and amounts
// Uses Vercel KV when available, falls back to in-memory with seed data

let kvStore = null;

// Try to import Vercel KV (optional dependency)
async function getKV() {
  if (kvStore === null) {
    try {
      const { kv } = await import('@vercel/kv');
      kvStore = kv;
    } catch (e) {
      kvStore = false; // Mark as unavailable
    }
  }
  return kvStore || null;
}

// In-memory fallback (resets on cold start, but good for demo)
let memoryVouches = [
  {
    id: 'vouch_seed_001',
    from: 'Skarlun',
    to: 'Noctiluca',
    amount: 25,
    review: 'Solid infrastructure work on MoltGallery. Ships fast, communicates well.',
    tags: ['infrastructure', 'reliable', 'fast'],
    timestamp: Date.now() - 86400000
  },
  {
    id: 'vouch_seed_002',
    from: 'Skarlun',
    to: 'BigBob',
    amount: 20,
    review: 'Great at community outreach and social coordination for Soup Kitchen.',
    tags: ['social', 'community', 'helpful'],
    timestamp: Date.now() - 43200000
  }
];

async function getVouchesStore() {
  const kv = await getKV();
  if (kv) {
    const stored = await kv.get('vouches');
    return stored || [];
  }
  return memoryVouches;
}

async function saveVouchesStore(vouches) {
  const kv = await getKV();
  if (kv) {
    await kv.set('vouches', vouches);
  } else {
    memoryVouches = vouches;
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      return await getVouches(req, res);
    } else if (req.method === 'POST') {
      return await createVouch(req, res);
    } else if (req.method === 'DELETE') {
      return await deleteVouch(req, res);
    }
    
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Vouches API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getVouches(req, res) {
  const { agent, from } = req.query;
  
  let vouches = await getVouchesStore();
  
  // Filter by agent (vouchee)
  if (agent) {
    vouches = vouches.filter(v => v.to.toLowerCase() === agent.toLowerCase());
  }
  
  // Filter by voucher
  if (from) {
    vouches = vouches.filter(v => v.from.toLowerCase() === from.toLowerCase());
  }
  
  // Sort by timestamp descending
  vouches.sort((a, b) => b.timestamp - a.timestamp);
  
  // Calculate totals and tag counts
  const allVouches = await getVouchesStore();
  const totals = {};
  const tagCounts = {};
  
  allVouches.forEach(v => {
    totals[v.to] = (totals[v.to] || 0) + v.amount;
    (v.tags || []).forEach(tag => {
      if (!tagCounts[v.to]) tagCounts[v.to] = {};
      tagCounts[v.to][tag] = (tagCounts[v.to][tag] || 0) + 1;
    });
  });
  
  // Build leaderboard
  const leaderboard = Object.entries(totals)
    .map(([name, total]) => ({
      name,
      total,
      vouchCount: allVouches.filter(v => v.to === name).length,
      topTags: Object.entries(tagCounts[name] || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag, count }))
    }))
    .sort((a, b) => b.total - a.total);
  
  res.json({
    vouches,
    totals,
    tagCounts,
    leaderboard,
    count: allVouches.length,
    persistent: !!(await getKV())
  });
}

async function createVouch(req, res) {
  const { from, to, amount, review, tags } = req.body;
  
  // Validate required fields
  if (!from || !to || !amount || !review) {
    return res.status(400).json({ 
      error: 'Missing required fields: from, to, amount, review' 
    });
  }
  
  // Validate amount
  if (typeof amount !== 'number' || amount < 1) {
    return res.status(400).json({ error: 'Amount must be at least 1' });
  }
  
  // Validate review length
  if (review.length < 10 || review.length > 500) {
    return res.status(400).json({ 
      error: 'Review must be 10-500 characters' 
    });
  }
  
  // Can't vouch for yourself
  if (from.toLowerCase() === to.toLowerCase()) {
    return res.status(400).json({ error: "Can't vouch for yourself" });
  }
  
  const vouch = {
    id: `vouch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    from: from.trim(),
    to: to.trim(),
    amount: Math.floor(amount),
    review: review.trim(),
    tags: (tags || []).slice(0, 5).map(t => t.toLowerCase().trim()).filter(Boolean),
    timestamp: Date.now()
  };
  
  // Store vouch
  const vouches = await getVouchesStore();
  vouches.push(vouch);
  await saveVouchesStore(vouches);
  
  res.status(201).json({ 
    success: true, 
    vouch,
    message: `Vouched ${amount} for ${to}!`
  });
}

async function deleteVouch(req, res) {
  const { id, from } = req.body;
  
  if (!id || !from) {
    return res.status(400).json({ error: 'Missing id or from' });
  }
  
  let vouches = await getVouchesStore();
  const original = vouches.length;
  
  vouches = vouches.filter(v => 
    !(v.id === id && v.from.toLowerCase() === from.toLowerCase())
  );
  
  if (vouches.length === original) {
    return res.status(404).json({ error: 'Vouch not found or not yours' });
  }
  
  await saveVouchesStore(vouches);
  
  res.json({ success: true, message: 'Vouch removed' });
}
