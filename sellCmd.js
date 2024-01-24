require("dotenv").config();
const { Keypair } = require("@solana/web3.js");
const { sellTokens, getConnection } = require("./utils");
const bs58 = require("bs58");

// addy: DjcG3NNTLAg62uJi5mLmAHoGPGq21kSF8dTPByHgVJHq
const secretKey = bs58.decode(process.env.PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);
console.log("=================Seller Program============================");
console.log("address: ", keypair.publicKey);
console.log("===========================================================");

async function sellMyTokens(connection, token, amount) {
  try {
    try {
      const result = await sellTokens(keypair, amount, connection, token);
      if (result) {
        console.log("sold successfully.");
      } else {
        console.log("failed to sell.");
      }
    } catch (error) {
      console.log(error);
    }
  } catch (error) {
    console.log(error);
  }
}

const connection = getConnection();
sellMyTokens(connection, process.argv[2], process.argv[3]).catch(console.error);
