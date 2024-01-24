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
const buyerDb = new JsonDB(new Config("token_bought", true, false, "/"));
const sellerDb = new JsonDB(new Config("token_sold", true, false, "/"));

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
      const token = item.accountInfo.mint.toString();
      try {
        const data = await buyerDb.getData(`/${token}`);
        const soldData = await sellerDb.getData("/");
        if (soldData[item] === undefined) {
          try {
            await sellTokens(
              keypair,
              item.accountInfo.amount.toString(),
              connection,
              data[2].address
            );
            await sellerDb.push(`/${data[0].address}`, data);
          } catch (error) {
            console.log(error);
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
setInterval(() => {
  sellMyTokens(connection).catch(console.error);
}, 60000);
