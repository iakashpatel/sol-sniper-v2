const {
  Liquidity,
  TokenAmount,
  Token,
  Percent,
  jsonInfo2PoolKeys,
  TOKEN_PROGRAM_ID,
  SPL_ACCOUNT_LAYOUT,
  LOOKUP_TABLE_CACHE,
  buildSimpleTransaction,
  LIQUIDITY_STATE_LAYOUT_V4,
  MARKET_STATE_LAYOUT_V3,
  Market,
  SPL_MINT_LAYOUT,
  TxVersion,
} = require("@raydium-io/raydium-sdk");

const {
  PublicKey,
  VersionedTransaction,
  Connection,
} = require("@solana/web3.js");

const SOL_PER_SNIPE = "0.01";
const SOL_BUY_LIQ_FILTER = 25;
const SOL_SELL_LIQ_FILTER = SOL_BUY_LIQ_FILTER * 1.5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function formatAmmKeysById(connection, id) {
  const account = await connection.getAccountInfo(new PublicKey(id));
  if (account === null) throw Error(" get id info error ");
  const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);

  const marketId = info.marketId;
  const marketAccount = await connection.getAccountInfo(marketId);
  if (marketAccount === null) throw Error(" get market info error");
  const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);

  const lpMint = info.lpMint;
  const lpMintAccount = await connection.getAccountInfo(lpMint);
  if (lpMintAccount === null) throw Error(" get lp mint info error");
  const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data);

  return {
    id,
    baseMint: info.baseMint.toString(),
    quoteMint: info.quoteMint.toString(),
    lpMint: info.lpMint.toString(),
    baseDecimals: info.baseDecimal.toNumber(),
    quoteDecimals: info.quoteDecimal.toNumber(),
    lpDecimals: lpMintInfo.decimals,
    version: 4,
    programId: account.owner.toString(),
    authority: Liquidity.getAssociatedAuthority({
      programId: account.owner,
    }).publicKey.toString(),
    openOrders: info.openOrders.toString(),
    targetOrders: info.targetOrders.toString(),
    baseVault: info.baseVault.toString(),
    quoteVault: info.quoteVault.toString(),
    withdrawQueue: info.withdrawQueue.toString(),
    lpVault: info.lpVault.toString(),
    marketVersion: 3,
    marketProgramId: info.marketProgramId.toString(),
    marketId: info.marketId.toString(),
    marketAuthority: Market.getAssociatedAuthority({
      programId: info.marketProgramId,
      marketId: info.marketId,
    }).publicKey.toString(),
    marketBaseVault: marketInfo.baseVault.toString(),
    marketQuoteVault: marketInfo.quoteVault.toString(),
    marketBids: marketInfo.bids.toString(),
    marketAsks: marketInfo.asks.toString(),
    marketEventQueue: marketInfo.eventQueue.toString(),
    lookupTableAccount: PublicKey.default.toString(),
  };
}

async function getTokenAccountsByOwner(
  connection, //: Connection
  owner //: PublicKey
) {
  const tokenResp = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  //: TokenAccount[]
  const accounts = [];

  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}

async function calcAmountOut(
  connection, //: Connection,
  poolKeys, //: LiquidityPoolKeys,
  rawAmountIn, //: number,
  swapInDirection //: boolean
) {
  const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });

  const solLiquidity =
    poolInfo.quoteReserve.toNumber() / 10 ** poolInfo.quoteDecimals;
  let liqFilter = solLiquidity >= SOL_BUY_LIQ_FILTER;

  let programId = poolKeys.programId;
  let currencyInMint = poolKeys.baseMint;
  let currencyInDecimals = poolInfo.baseDecimals;
  let currencyOutMint = poolKeys.quoteMint;
  let currencyOutDecimals = poolInfo.quoteDecimals;

  if (!swapInDirection) {
    currencyInMint = poolKeys.quoteMint;
    currencyInDecimals = poolInfo.quoteDecimals;
    currencyOutMint = poolKeys.baseMint;
    currencyOutDecimals = poolInfo.baseDecimals;
  } else {
    liqFilter = solLiquidity >= SOL_SELL_LIQ_FILTER;
  }

  const currencyIn = new Token(programId, currencyInMint, currencyInDecimals);
  const amountIn = new TokenAmount(currencyIn, rawAmountIn, false);
  const currencyOut = new Token(
    programId,
    currencyOutMint,
    currencyOutDecimals
  );
  const slippage = new Percent(5, 100); // 5% slippage

  const quote = Liquidity.computeAmountOut({
    poolKeys,
    poolInfo,
    amountIn,
    currencyOut,
    slippage,
  });

  return {
    liqFilter,
    amountIn,
    ...quote,
  };
}

const getPoolInfo = async (connection, tokenPairAddress) => {
  const targetPoolInfo = await formatAmmKeysById(connection, tokenPairAddress);
  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo);
  return poolKeys;
};

async function sendTx(
  connection, //: Connection
  payer, //: Keypair | Signer
  txs, //: (VersionedTransaction | Transaction)[]
  options //: SendOptions
) {
  //: Promise<string[]>
  //: string[]
  const txids = [];
  for (const iTx of txs) {
    if (iTx instanceof VersionedTransaction) {
      iTx.sign([payer]);
      txids.push(await connection.sendTransaction(iTx, options));
    } else {
      txids.push(await connection.sendTransaction(iTx, [payer], options));
    }
  }
  return txids;
}

async function buildAndSendTx(
  connection,
  wallet,
  innerSimpleV0Transaction, //: InnerSimpleV0Transaction[],
  options //?: SendOptions
) {
  const willSendTx = await buildSimpleTransaction({
    connection,
    makeTxVersion: TxVersion.V0,
    payer: wallet.publicKey,
    innerTransactions: innerSimpleV0Transaction,
    addLookupTableInfo: LOOKUP_TABLE_CACHE,
  });

  return await sendTx(connection, wallet, willSendTx, options);
}

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
  const { amountIn, minAmountOut, liqFilter } = await calcAmountOut(
    connection,
    poolKeys,
    inputNumber,
    swapInDirection
  );
  return { amountIn, minAmountOut, liqFilter };
}

async function swap(connection, keypair, poolKeys, amountIn, minAmountOut) {
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
}

async function sellTokens(keypair, tokenInput, connection, pairAccount) {
  const poolKeys = await getPoolInfo(connection, pairAccount);
  if (poolKeys) {
    console.log("Found Pool Keys");
    const prices = await quote(connection, poolKeys, tokenInput, true);
    if (prices.liqFilter) {
      await swap(
        connection,
        keypair,
        poolKeys,
        prices.amountIn,
        prices.minAmountOut
      );
    } else {
      throw new Error("Token Does not meet Liquidity Thresold.");
    }
  } else {
    throw new Error("Pool Info Not Found.");
  }
}

async function buyTokens(keypair, tokenInput, connection, pairAccount) {
  const poolKeys = await getPoolInfo(connection, pairAccount);
  if (poolKeys) {
    console.log("Found Pool Keys");
    const prices = await quote(connection, poolKeys, tokenInput, false);
    if (prices.liqFilter) {
      await swap(
        connection,
        keypair,
        poolKeys,
        prices.amountIn,
        prices.minAmountOut
      );
    } else {
      throw new Error("Token Does not meet Liquidity Thresold.");
    }
  } else {
    throw new Error("Pool Info Not Found.");
  }
}

module.exports = {
  sleep,
  getPoolInfo,
  calcAmountOut,
  getTokenAccountsByOwner,
  buildAndSendTx,
  getConnection,
  swap,
  quote,
  generateExplorerUrl,
  sellTokens,
  buyTokens,
  SOL_PER_SNIPE,
};
