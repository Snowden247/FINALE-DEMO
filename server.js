// server.js – custodial backend with simple bearer‑token auth
// ----------------------------------------------------------
// 1. npm i express ethers dotenv
// 2. .env  →  PRIVATE_KEY=0x...   RPC_URL=https://...   ADMIN_TOKEN=MY_SECRET
// ----------------------------------------------------------
import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const { PRIVATE_KEY, RPC_URL, ADMIN_TOKEN } = process.env;
if (!PRIVATE_KEY || !RPC_URL || !ADMIN_TOKEN) {
  console.error("Missing env vars. Ensure PRIVATE_KEY, RPC_URL, ADMIN_TOKEN are set in .env");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

const ERC20_ABI = [
  "function transfer(address to,uint amount) public returns(bool)",
  "function decimals() view returns(uint8)"
];

const app = express();
app.use(express.json());

app.post("/transfer", async (req, res) => {
  // Simple bearer‑token auth
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "Unauthorized" });

  const { toToken, amount, tokenAddress } = req.body;
  if (!toToken || !amount || !tokenAddress) return res.status(400).json({ error: "Missing fields" });

  try {
    let txHash;
    if (tokenAddress === "native") {
      // Send native coin (ETH/BNB etc.)
      const tx = await wallet.sendTransaction({ to: toToken, value: ethers.parseEther(amount) });
      await tx.wait();
      txHash = tx.hash;
    } else {
      // ERC‑20 transfer
      const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
      const decimals = await erc20.decimals();
      const value = ethers.parseUnits(amount, decimals);
      const tx = await erc20.transfer(toToken, value);
      await tx.wait();
      txHash = tx.hash;
    }
    res.json({ txHash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Custodial backend running on port 3000"));
