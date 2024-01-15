require("dotenv").config();
const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const { Liquidity } = require("@raydium-io/raydium-sdk");
const {
  getPoolInfo,
  calcAmountOut,
  getTokenAccountsByOwner,
  buildAndSendTx,
  sleep,
} = require("./utils");
const bs58 = require("bs58");

// addy: DjcG3NNTLAg62uJi5mLmAHoGPGq21kSF8dTPByHgVJHq
const secretKey = bs58.decode(process.env.PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);
console.log("address: ", keypair.publicKey);

const RAYDIUM_PUBLIC_KEY = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const SOL_PER_SNIPE = "0.01";

let credits = 0;

const raydium = new PublicKey(RAYDIUM_PUBLIC_KEY);

// Replace HTTP_URL & WSS_URL with QuickNode HTTPS and WSS Solana Mainnet endpoint
const getConnection = () => {
  const SESSION_HASH = "AKASHPATEL" + Math.ceil(Math.random() * 1e9); // Random unique identifier for your session
  return new Connection(process.env.HTTPS_ENDPOINT, {
    wsEndpoint: process.env.WSS_ENDPOINT,
    httpHeaders: { "x-session-hash": SESSION_HASH },
  });
};

function generateExplorerUrl(txId) {
  return `https://solscan.io/tx/${txId}`;
}

async function quote(
  connection,
  poolKeys,
  input,
  swapInDirection = false // false => SOL TO XXX ;; true => XXX to SOL
) {
  const inputNumber = parseFloat(input);
  const { amountIn, minAmountOut } = await calcAmountOut(
    connection,
    poolKeys,
    inputNumber,
    swapInDirection
  );
  return { amountIn, minAmountOut };
}

async function swap(connection, poolKeys, amountIn, minAmountOut) {
  try {
    const tokenAccounts = await getTokenAccountsByOwner(
      connection,
      keypair.publicKey
    );
    const simpleSwapInstruction = await Liquidity.makeSwapInstructionSimple({
      connection,
      poolKeys,
      userKeys: {
        tokenAccounts,
        owner: keypair.publicKey,
      },
      amountIn,
      amountOut: minAmountOut,
      fixedSide: "in",
    });

    console.log(
      "amountOut:",
      minAmountOut.toFixed(),
      "  minAmountOut: ",
      amountIn.toFixed()
    );

    const txids = await buildAndSendTx(
      connection,
      keypair,
      simpleSwapInstruction.innerTransactions
    );
    console.log("Transaction sent");
    txids.map((item) => {
      console.log(generateExplorerUrl(item));
    });
    console.log("Success");
  } catch (error) {
    console.error(error);
  }
}

// Monitor logs
async function main(connection, programAddress) {
  console.log("Monitoring logs for program:", programAddress.toString());
  connection.onLogs(
    programAddress,
    ({ logs, err, signature }) => {
      if (err) return;

      if (logs && logs.some((log) => log.includes("initialize2"))) {
        console.log("Signature for 'initialize2':", signature);
        fetchRaydiumAccounts(signature, connection);
      }
    },
    "finalized"
  );
}

async function buyTokens(tokenInput, connection, pairAccount) {
  try {
    // let connection = getConnection();
    const poolKeys = await getPoolInfo(connection, pairAccount);
    if (poolKeys) {
      console.log("Found Pool Keys");
      const prices = await quote(connection, poolKeys, tokenInput, false);
      await swap(connection, poolKeys, prices.amountIn, prices.minAmountOut);
    } else {
      console.log("Pool Info Not Found.");
    }
  } catch (error) {
    console.error(error);
  }
}

async function sellTokens(tokenInput, connection, pairAccount) {
  try {
    // let connection = getConnection();
    const poolKeys = await getPoolInfo(connection, pairAccount);
    if (poolKeys) {
      console.log("Found Pool Keys");
      const prices = await quote(connection, poolKeys, tokenInput, true);
      await swap(connection, poolKeys, prices.amountIn, prices.minAmountOut);
    } else {
      console.log("Pool Info Not Found.");
    }
  } catch (error) {
    console.error(error);
  }
}

// Parse transaction and filter data
async function fetchRaydiumAccounts(txId, connection) {
  const tx = await connection.getParsedTransaction(txId, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  credits += 100;

  const accounts = tx?.transaction.message.instructions.find(
    (ix) => ix.programId.toBase58() === RAYDIUM_PUBLIC_KEY
  ).accounts;

  if (!accounts) {
    console.log("No accounts found in the transaction.");
    return;
  }

  const tokenAIndex = 8;
  const tokenBIndex = 9;
  const pairIndex = 4;
  const tokenAAccount = accounts[tokenAIndex];
  const tokenBAccount = accounts[tokenBIndex];
  const pairAccount = accounts[pairIndex];

  const displayData = [
    { Token: "A", "Account Public Key": tokenAAccount.toBase58() },
    { Token: "B", "Account Public Key": tokenBAccount.toBase58() },
    { Token: "Pair", "Account Public Key": pairAccount.toBase58() },
  ];
  console.log("New LP Found");
  console.log(generateExplorerUrl(txId));
  console.table(displayData);
  console.log("Total QuickNode Credits Used in this session:", credits);
  await buyTokens(pairAccount);
  return;
}

// main(getConnection(), raydium).catch(console.error);
// buyTokens(
//   SOL_PER_SNIPE,
//   getConnection(),
//   "EP2ib6dYdEeqD8MfE2ezHCxX3kP3K2eLKkirfPm5eyMx"
// )
//   .then(console.log)
//   .catch(console.error);

// sellTokens(
//   "2.612935",
//   getConnection(),
//   "EP2ib6dYdEeqD8MfE2ezHCxX3kP3K2eLKkirfPm5eyMx"
// )
//   .then(console.log)
//   .catch(console.error);
