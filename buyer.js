require("dotenv").config();
const { Keypair } = require("@solana/web3.js");
const { JsonDB, Config } = require("node-json-db");
const { buyTokens, getConnection, SOL_PER_SNIPE } = require("./utils");
const bs58 = require("bs58");

// Local JSON DB.
const db = new JsonDB(new Config("tokens", true, false, "/"));
const buyerDb = new JsonDB(new Config("token_bought", true, false, "/"));

// addy: DjcG3NNTLAg62uJi5mLmAHoGPGq21kSF8dTPByHgVJHq
const secretKey = bs58.decode(process.env.PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);
console.log("=================Buyer Program=============================");
console.log("address: ", keypair.publicKey);
console.log("===========================================================");

async function buyListedTokens(connection) {
  try {
    const data = await db.getData("/");
    Object.keys(data).reduce((p, item) => {
      return p.then(async () => {
        try {
          const boughtData = await buyerDb.getData("/");
          const values = data[item];
          if (boughtData[item] === undefined) {
            await buyTokens(
              keypair,
              SOL_PER_SNIPE,
              connection,
              values[2].address
            );
            await buyerDb.push(`/${values[0].address}`, values);
          }
        } catch (error) {
          console.error(error);
        }
        return false;
      });
    }, Promise.resolve()); // initial
  } catch (error) {
    console.error(error);
  }
}

const connection = getConnection();
setInterval(() => {
  buyListedTokens(connection).catch(console.error);
}, 30000);
