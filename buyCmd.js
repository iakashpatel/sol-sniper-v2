require("dotenv").config();
const { Keypair } = require("@solana/web3.js");
const { buyTokens, getConnection } = require("./utils");
const bs58 = require("bs58");

const secretKey = bs58.decode(process.env.PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);
console.log("address: ", keypair.publicKey);
const connection = getConnection();

async function buyMyTokens(connection, token, amount) {
  try {
    try {
      await buyTokens(keypair, amount, connection, token);
    } catch (error) {
      console.log(error);
    }
  } catch (error) {
    console.log(error);
  }
}

buyMyTokens(connection, process.argv[2], process.argv[3]).catch(console.error);
