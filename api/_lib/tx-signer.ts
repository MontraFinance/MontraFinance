/**
 * Ethereum transaction signing using ethers.js v5.
 * Signs EIP-155 legacy transactions for Base (chainId 8453).
 */
import { ethers } from "ethers";

interface TxObject {
  nonce: string;
  gasPrice: string;
  gasLimit: string;
  to: string;
  value: string;
  data: string;
  chainId: number;
}

/**
 * Sign a transaction with a private key using ethers.js.
 * Returns the signed raw transaction hex string (0x-prefixed).
 */
export async function signTransaction(tx: TxObject, privateKeyHex: string): Promise<string> {
  const wallet = new ethers.Wallet(privateKeyHex);

  const signedTx = await wallet.signTransaction({
    nonce: ethers.BigNumber.from(tx.nonce).toNumber(),
    gasPrice: ethers.BigNumber.from(tx.gasPrice),
    gasLimit: ethers.BigNumber.from(tx.gasLimit),
    to: tx.to,
    value: ethers.BigNumber.from(tx.value),
    data: tx.data,
    chainId: tx.chainId,
  });

  return signedTx;
}
