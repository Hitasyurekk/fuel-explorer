import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { FUEL_CHAIN } from 'app-commons';
import { BaseAssetId, Predicate, Provider, Wallet, bn, hexlify } from 'fuels';

const { NEXT_PUBLIC_FUEL_CHAIN_NAME, PRIVATE_KEY } = process.env;
const BIN_PATH = resolve(__dirname, '../out/debug/predicate-app.bin');
const ABI_PATH = resolve(__dirname, '../out/debug/predicate-app-abi.json');
const AMOUNT = 300_000;

if (!NEXT_PUBLIC_FUEL_CHAIN_NAME || !PRIVATE_KEY) {
  throw new Error(
    'Missing some config in .env file. Should have NEXT_PUBLIC_FUEL_CHAIN_NAME and PRIVATE_KEY',
  );
}

async function initializeWallet() {
  const provider = await Provider.create(FUEL_CHAIN.providerUrl);
  const wallet = Wallet.fromPrivateKey(PRIVATE_KEY!, provider);
  return { wallet, provider };
}

async function loadPredicateData() {
  const [binFile, abiFile] = await Promise.all([
    fs.readFile(BIN_PATH),
    fs.readFile(ABI_PATH, 'utf-8'),
  ]);
  
  const binHex = hexlify(binFile);
  const abiJson = JSON.parse(abiFile);
  
  return { binHex, abiJson };
}

async function main() {
  const { wallet, provider } = await initializeWallet();
  const { binHex, abiJson } = await loadPredicateData();
  const walletAddress = wallet.address.toB256();

  const { minGasPrice: gasPrice } = await wallet.provider.getGasConfig();
  const predicate = new Predicate(binHex, provider, abiJson);

  console.log('💰 Funding predicate...');
  const tx1 = await wallet.transfer(predicate.address, AMOUNT, BaseAssetId, { gasPrice });
  const res1 = await tx1.waitForResult();
  const predicateBalance = bn(await predicate.getBalance());

  console.log(`→ Transaction Id: ${res1.id}`);
  console.log(`→ Predicate balance: ${predicateBalance.format()}`);
  console.log(`→ Predicate Id: ${predicate.address.toB256()}`);
  console.log(`📝 Wallet address: ${walletAddress}\n`);

  console.log('⌛️ Running predicate...');
  predicate.setData(walletAddress);

  try {
    const tx2 = await predicate.transfer(wallet.address, AMOUNT - 150_000, BaseAssetId, { gasPrice });
    const res2 = await tx2.waitForResult();
    console.log(`→ Transaction Id: ${res2.id}`);
  } catch (error: any) {
    console.error('Error:', error?.response?.errors?.[0]?.message || error.message);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error.message);
});
