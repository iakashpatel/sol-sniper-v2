require("dotenv").config();
const { PublicKey } = require("@solana/web3.js");
const { JsonDB, Config } = require("node-json-db");
const { getConnection, generateExplorerUrl } = require("./utils");

// Local JSON DB.
const db = new JsonDB(new Config("tokens", true, false, "/"));
const RAYDIUM_PUBLIC_KEY = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
let credits = 0;
const raydium = new PublicKey(RAYDIUM_PUBLIC_KEY);

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
    { Token: "A", address: tokenAAccount.toBase58() },
    { Token: "B", address: tokenBAccount.toBase58() },
    { Token: "Pair", address: pairAccount.toBase58() },
  ];
  console.log("New LP Found");
  console.log(generateExplorerUrl(txId));
  console.table(displayData);
  await db.push(`/${tokenAAccount.toBase58()}`, displayData);
  console.log("Total QuickNode Credits Used in this session:", credits);
  return;
}

main(getConnection(), raydium).catch(console.error);
