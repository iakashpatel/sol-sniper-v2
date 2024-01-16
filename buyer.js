require("dotenv").config();
const { Keypair } = require("@solana/web3.js");
const { JsonDB, Config } = require("node-json-db");
const { buyTokens, getConnection, SOL_PER_SNIPE } = require("./utils");
const bs58 = require("bs58");

// Local JSON DB.
const db = new JsonDB(new Config("tokens", true, false, "/"));

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
          const values = data[item];
          if (values[3].bought === false) {
            await buyTokens(
              keypair,
              SOL_PER_SNIPE,
              connection,
              values[2].address
            );
            const newValues = values;
            newValues[3].bought = true;
            await db.push(`/${values[0].address}`, newValues);
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
}, 60000);
