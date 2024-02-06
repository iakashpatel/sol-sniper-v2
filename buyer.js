require("dotenv").config();
const { Keypair } = require("@solana/web3.js");
const { buyTokens, getConnection, buyerQueue } = require("./utils");
const { JsonDB, Config } = require("node-json-db");
const bs58 = require("bs58");

const buyerDb = new JsonDB(new Config("token_bought", true, false, "/"));

// addy: DjcG3NNTLAg62uJi5mLmAHoGPGq21kSF8dTPByHgVJHq
const secretKey = bs58.decode(process.env.PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);
console.log("address: ", keypair.publicKey);
const connection = getConnection();

buyerQueue.process(1, async (job, done) => {
  console.log("========================Buying=============================");
  console.table(job.data);
  console.log("===========================================================");

  try {
    await buyTokens(
      keypair,
      job.data[3].solAmount,
      connection,
      job.data[2].address
    );
    await buyerDb.push(`/${job.data[2].address}`, job.data);
  } catch (error) {
    console.error(error);
  }
  return done();
});
