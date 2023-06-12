import * as path from "path";
import algosdk from "algosdk";
import { getIndexerClient } from "../clients";
const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

const getAlgodClient = () => {
  return algodClient;
};

const submitToNetwork = async (signedTxns) => {
  // send txn
  const response = await algodClient.sendRawTransaction(signedTxns).do();
  console.log(response);

  // Wait for transaction to be confirmed
  const confirmation = await algosdk.waitForConfirmation(
    algodClient,
    response.txId,
    4
  );

  return {
    response,
    confirmation,
  };
};

const readGlobalState = async (appId) => {
  const app = await algodClient.getApplicationByID(appId).do();

  const gsMap = new Map();

  // global state is a key value array
  const globalState = app.params["global-state"];
  globalState.forEach((item) => {
    // decode from base64 and utf8
    const formattedKey = decodeURIComponent(Buffer.from(item.key, "base64"));
    let formattedValue;
    if (item.value.type === 1) {
      if (formattedKey === "OwnerAddress") {
        console.log(item.value.bytes);
        formattedValue = algosdk.encodeAddress(
          Buffer.from(item.value.bytes, "base64")
        );
      } else {
        formattedValue = decodeURIComponent(
          Buffer.from(item.value.bytes, "base64")
        );
      }
    } else {
      formattedValue = item.value.uint;
    }
    gsMap.set(formattedKey, formattedValue);
  });

  return gsMap;
};

const readLocalState = async (account, appId) => {
  const acc = await algodClient.accountInformation(account).do();
  const localStates = acc["apps-local-state"];

  const appLocalState = localStates.find((ls) => {
    return ls.id === appId;
  });

  if (appLocalState === undefined)
    throw new Error("Account has not opted into the app.");

  const lsMap = new Map();

  // global state is a key value array
  appLocalState["key-value"].forEach((item) => {
    // decode from base64 and utf8
    const formattedKey = decodeURIComponent(Buffer.from(item.key, "base64"));

    let formattedValue;
    if (item.value.type === 1) {
      formattedValue = decodeURIComponent(
        Buffer.from(item.value.bytes, "base64")
      );
    } else {
      formattedValue = item.value.uint;
    }

    lsMap.set(formattedKey, formattedValue);
  });

  return lsMap;
};

const deployDemoApp = async (fromAccount) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  // programs
  const approvalProgram = await getBasicProgramBytes(
    "assets/artifacts/nft-marketplace/approval.teal"
  );
  const clearProgram = await getBasicProgramBytes(
    "assets/artifacts/nft-marketplace/clear.teal"
  );

  // global / local states
  const numGlobalInts = 0;
  const numGlobalByteSlices = 1;
  const numLocalInts = 2;
  const numLocalByteSlices = 0;

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    approvalProgram,
    clearProgram,
    numGlobalInts,
    numGlobalByteSlices,
    numLocalInts,
    numLocalByteSlices,
  });
  console.log(txn);

  const signedTxn = txn.signTxn(fromAccount.sk);
  console.log(signedTxn);
  return await submitToNetwork(signedTxn);
};

const fundAccount = async (fromAccount, to, amount) => {
  let suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: fromAccount.addr,
    to,
    amount,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const callApp = async (fromAccount, appIndex, appArgs, accounts) => {
  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  // call the created application
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    appIndex,
    appArgs,
    accounts,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const optIntoApp = async (fromAccount, appIndex) => {
  const acc = await algodClient.accountInformation(fromAccount.addr).do();
  const localStates = acc["apps-local-state"];

  const appLocalState = localStates.find((ls) => {
    return ls.id === appIndex;
  });

  // account has already opted into app
  if (appLocalState !== undefined) return;

  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  // call the created application
  const txn = algosdk.makeApplicationOptInTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    appIndex,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const optIntoAsset = async (fromAccount, assetId) => {
  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: fromAccount,
    to: fromAccount,
    assetIndex: assetId,
    amount: 0,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const makeATCCall = async (txns) => {
  // create atomic transaction composer
  const atc = new algosdk.AtomicTransactionComposer();

  // add calls to atc
  txns.forEach((txn) => {
    if (txn.method !== undefined) {
      atc.addMethodCall(txn);
    } else {
      atc.addTransaction(txn);
    }
  });

  // execute
  const result = await atc.execute(algodClient, 10);
  for (const idx in result.methodResults) {
    console.log(result.methodResults[idx]);
  }

  return result;
};

const fetchASA = async (algodClient) => {
  const deployerAddr = process.env.NEXT_PUBLIC_APP_ADDRESS;

  const { assets } = await algodClient.accountInformation(deployerAddr).do();

  function base64ToJson(base64String) {
    const buffer = Buffer.from(base64String, "base64");
    const jsonString = buffer.toString("utf-8");
    const jsonObj = JSON.parse(jsonString);
    return jsonObj;
  }

  let nfts = [];

  const indexer_client = getIndexerClient(network);

  var note = undefined;
  if (assets) {
    for (let asset of assets) {
      const assetTxns = await indexer_client
        .lookupAssetTransactions(asset["asset-id"])
        .do();
      //console.log("assetTxns: ", assetTxns);
      const acfg_txns = assetTxns.transactions
        .filter((txn) => txn["tx-type"] === "acfg")
        .forEach((txns) => {
          if (txns.note != undefined) {
            try {
              note = base64ToJson(txns.note);
            } catch (e) {
              console.log(e);
            }
          }
        });

      const assetInfo = await algodClient.getAssetByID(asset["asset-id"]).do();
      const { decimals, total, url } = assetInfo.params;

      const isNFT =
        url !== undefined &&
        url.includes("ipfs://") &&
        total === 1 &&
        decimals === 0;
      const deployerHasNFT = asset.amount > 0;

      if (isNFT && deployerHasNFT) {
        try {
          const metadata = note;
          const imgUrl = url.replace(
            "ipfs://",
            "https://cloudflare-ipfs.com/ipfs/"
          );

          if (url != undefined) {
            nfts.push({
              asset,
              assetInfo,
              metadata,
              imgUrl,
            });
          }
        } catch (error) {
          console.log(error);
          continue;
        }
      }
    }
  }

  return nfts;
};
const createAssetTransferTxn = async (
  algodClient,
  sender,
  receiver,
  assetId,
  amount
) => {
  // create suggested parameters
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: sender,
    to: receiver,
    assetIndex: assetId,
    amount,
    suggestedParams,
  });

  return txn;
};

const getMethod = (methodName) => {
  // Read in the local contract.json file
  // const __dirname =
  //   "C:/Users/chewj/github-classroom/Algo-Foundry/vault-jing-xiang/";
  // const source = path.join(
  //   __dirname,
  //   "assets/artifacts/VaultApp/contract.json"
  // );
  // const buff = fs.readFileSync(source);

  const data = require("../../assets/artifacts/nft-marketplace/contract.json");

  // Parse the json file into an object, pass it to create an ABIContract object
  const contract = new algosdk.ABIContract(data);

  const method = contract.methods.find((mt) => mt.name === methodName);

  if (method === undefined) throw Error("Method undefined: " + method);

  return method;
};

const accountInfo = async (addr) => {
  return await algodClient.accountInformation(addr).do();
};

export {
  fundAccount,
  readGlobalState,
  readLocalState,
  callApp,
  optIntoApp,
  optIntoAsset,
  submitToNetwork,
  makeATCCall,
  getAlgodClient,
  fetchASA,
  createAssetTransferTxn,
  getMethod,
  accountInfo,
};
