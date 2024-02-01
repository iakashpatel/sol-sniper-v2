require("dotenv").config();
const { Keypair } = require("@solana/web3.js");
const { sellTokens, getConnection, sellerQueue } = require("./utils");
const bs58 = require("bs58");

// addy: DjcG3NNTLAg62uJi5mLmAHoGPGq21kSF8dTPByHgVJHq
const secretKey = bs58.decode(process.env.PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);
console.log("address: ", keypair.publicKey);
const connection = getConnection();

sellerQueue.process(1, (job, done) => {
  setTimeout(async () => {
    console.log("========================Selling=============================");
    console.table(job.data.buyerData);
    console.log("===========================================================");
    try {
      const result = await sellTokens(
        keypair,
        job.data.amount.toString(),
        connection,
        job.data.buyerData[2].address
      );
      if (result) {
        console.log("sold successfully.");
      } else {
        console.log("failed to sell.");
      }
    } catch (error) {
      console.error(error);
    }
    return done();
  }, 3000);
});
