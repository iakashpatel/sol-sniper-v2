require("dotenv").config();
const { Keypair } = require("@solana/web3.js");
const { JsonDB, Config } = require("node-json-db");
const {
  sellTokens,
  getTokenAccountsByOwner,
  getConnection,
} = require("./utils");
const bs58 = require("bs58");

// Local JSON DB.
const db = new JsonDB(new Config("tokens", true, false, "/"));

// addy: DjcG3NNTLAg62uJi5mLmAHoGPGq21kSF8dTPByHgVJHq
const secretKey = bs58.decode(process.env.PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);
console.log("=================Seller Program============================");
console.log("address: ", keypair.publicKey);
console.log("===========================================================");

async function sellMyTokens(connection) {
  const tokenAccounts = await getTokenAccountsByOwner(
    connection,
    keypair.publicKey
  );

  tokenAccounts.reduce((p, item) => {
    return p.then(async () => {
      try {
        // console.log(item);
        const data = await db.getData(`/${item.accountInfo.mint.toString()}`);
        if (data[3].error === false) {
          try {
            await sellTokens(
              keypair,
              item.accountInfo.amount.toString(),
              connection,
              data[2].address
            );
          } catch (error) {
            console.log(error);
            // const newValues = Object.assign([], data);
            // newValues[3].error = true;
            // await db.push(`/${newValues[0].address}`, newValues);
          }
        }
      } catch (error) {
        console.log(error);
      }
      return;
    });
  }, Promise.resolve()); // initial
}

const connection = getConnection();
// sellMyTokens(connection).catch(console.error);
setInterval(() => {
  sellMyTokens(connection).catch(console.error);
}, 300000);
