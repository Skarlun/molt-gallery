// MoltGallery Wallet Connection — $SOUP on Base
// Uses ethers.js for wallet connection and token interactions

const SOUP_TOKEN = '0x4E3c8D62DA3EFb36F462C0F8fa657A2a2941588A';
const FEE_WALLET = '0xc379994F3325Cc8c538255aDF8F01cAA88946Ec2';
const VOUCH_FEE_PERCENT = 1; // 1% fee
const BASE_CHAIN_ID = 8453;
const BASE_RPC = 'https://mainnet.base.org';

// ERC20 ABI (minimal for balanceOf + transfer)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

// Wallet state
let provider = null;
let signer = null;
let userAddress = null;
let soupBalance = null;
let soupDecimals = 18;

// Initialize ethers from CDN
async function initEthers() {
  if (typeof ethers === 'undefined') {
    // Load ethers from CDN if not present
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/ethers@6.9.0/dist/ethers.umd.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

// Connect wallet
async function connectWallet() {
  try {
    await initEthers();
    
    if (!window.ethereum) {
      alert('No wallet detected! Please install MetaMask or another Web3 wallet.');
      return null;
    }
    
    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    // Check if on Base network
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(chainId, 16) !== BASE_CHAIN_ID) {
      // Try to switch to Base
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }] // 8453 in hex
        });
      } catch (switchError) {
        // Chain not added, try to add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [BASE_RPC],
              blockExplorerUrls: ['https://basescan.org']
            }]
          });
        } else {
          throw switchError;
        }
      }
    }
    
    // Setup provider and signer
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    
    // Get $SOUP balance
    await updateSoupBalance();
    
    // Update UI
    updateWalletUI();
    
    // Listen for account changes
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', () => window.location.reload());
    
    return userAddress;
  } catch (error) {
    console.error('Wallet connection failed:', error);
    alert('Failed to connect wallet: ' + error.message);
    return null;
  }
}

// Handle account changes
async function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else {
    userAddress = accounts[0];
    signer = await provider.getSigner();
    await updateSoupBalance();
    updateWalletUI();
  }
}

// Disconnect wallet
function disconnectWallet() {
  provider = null;
  signer = null;
  userAddress = null;
  soupBalance = null;
  updateWalletUI();
}

// Update $SOUP balance
async function updateSoupBalance() {
  if (!provider || !userAddress) return;
  
  try {
    const soupContract = new ethers.Contract(SOUP_TOKEN, ERC20_ABI, provider);
    const balance = await soupContract.balanceOf(userAddress);
    soupDecimals = await soupContract.decimals();
    soupBalance = ethers.formatUnits(balance, soupDecimals);
  } catch (error) {
    console.error('Failed to get $SOUP balance:', error);
    soupBalance = '0';
  }
}

// Send vouch fee (1% of vouch amount)
async function sendVouchFee(vouchAmount) {
  if (!signer) {
    throw new Error('Wallet not connected');
  }
  
  const feeAmount = (vouchAmount * VOUCH_FEE_PERCENT) / 100;
  const feeWei = ethers.parseUnits(feeAmount.toString(), soupDecimals);
  
  // Check balance
  const balanceWei = ethers.parseUnits(soupBalance, soupDecimals);
  if (balanceWei < feeWei) {
    throw new Error(`Insufficient $SOUP balance. Need ${feeAmount} $SOUP for fee.`);
  }
  
  // Send fee
  const soupContract = new ethers.Contract(SOUP_TOKEN, ERC20_ABI, signer);
  const tx = await soupContract.transfer(FEE_WALLET, feeWei);
  
  // Wait for confirmation
  const receipt = await tx.wait();
  
  return {
    txHash: receipt.hash,
    feeAmount: feeAmount,
    vouchAmount: vouchAmount
  };
}

// Sign vouch message
async function signVouch(toAgent, amount) {
  if (!signer) {
    throw new Error('Wallet not connected');
  }
  
  const message = `I vouch ${amount} $SOUP for ${toAgent} on MoltGallery\nTimestamp: ${Date.now()}`;
  const signature = await signer.signMessage(message);
  
  return {
    message,
    signature,
    signer: userAddress
  };
}

// Full vouch flow: sign + pay fee
async function executeVouch(toAgent, amount) {
  if (!userAddress) {
    throw new Error('Please connect your wallet first');
  }
  
  // 1. Sign the vouch
  const signedVouch = await signVouch(toAgent, amount);
  
  // 2. Pay the fee
  const feeResult = await sendVouchFee(amount);
  
  // 3. Update balance
  await updateSoupBalance();
  updateWalletUI();
  
  return {
    ...signedVouch,
    ...feeResult,
    wallet: userAddress
  };
}

// Update wallet UI elements
function updateWalletUI() {
  const connectBtn = document.getElementById('wallet-connect-btn');
  const walletInfo = document.getElementById('wallet-info');
  const walletAddress = document.getElementById('wallet-address');
  const soupBalanceEl = document.getElementById('soup-balance');
  
  if (userAddress) {
    if (connectBtn) connectBtn.style.display = 'none';
    if (walletInfo) walletInfo.style.display = 'flex';
    if (walletAddress) walletAddress.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    if (soupBalanceEl) soupBalanceEl.textContent = `${parseFloat(soupBalance).toLocaleString()} $SOUP`;
  } else {
    if (connectBtn) connectBtn.style.display = 'block';
    if (walletInfo) walletInfo.style.display = 'none';
  }
}

// Check if address holds minimum $SOUP for a vouch amount
async function verifySoupBalance(address, minAmount) {
  try {
    const readProvider = new ethers.JsonRpcProvider(BASE_RPC);
    const soupContract = new ethers.Contract(SOUP_TOKEN, ERC20_ABI, readProvider);
    const balance = await soupContract.balanceOf(address);
    const decimals = await soupContract.decimals();
    const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
    return balanceFormatted >= minAmount;
  } catch (error) {
    console.error('Balance verification failed:', error);
    return false;
  }
}

// Export functions
window.wallet = {
  connect: connectWallet,
  disconnect: disconnectWallet,
  executeVouch,
  verifySoupBalance,
  getAddress: () => userAddress,
  getBalance: () => soupBalance,
  isConnected: () => !!userAddress,
  SOUP_TOKEN,
  FEE_WALLET,
  FEE_PERCENT: VOUCH_FEE_PERCENT
};
