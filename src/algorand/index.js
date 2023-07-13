import algosdk, {
  getApplicationAddress,
  mnemonicToSecretKey,
  secretKeyToMnemonic,
} from "algosdk";
import { getIndexerClient } from "../clients";
const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
import abi from "../../assets/artifacts/nft-marketplace/contract.json";

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

const getAlgodClient = () => {
  return algodClient;
};

const appAddress = process.env.NEXT_PUBLIC_APP_ADDRESS;

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
  const data = require("../../assets/artifacts/nft-marketplace/contract.json");

  // Parse the json file into an object, pass it to create an ABIContract object
  const contract = new algosdk.ABIContract(data);

  const method = contract.methods.find((mt) => mt.name === methodName);

  if (method === undefined) throw Error("Method undefined: " + method);

  return method;
};

const creatorgetMethod = (methodName) => {
  const data = require("../../assets/artifacts/creator/contract.json");

  // Parse the json file into an object, pass it to create an ABIContract object
  const contract = new algosdk.ABIContract(data);

  const method = contract.methods.find((mt) => mt.name === methodName);

  if (method === undefined) throw Error("Method undefined: " + method);

  return method;
};

const accountInfo = async (addr) => {
  return await algodClient.accountInformation(addr).do();
};

const getAssetOptInTxn = async (algodClient, accAddr, assetId) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: accAddr,
    to: accAddr,
    assetIndex: assetId,
    suggestedParams,
  });
};

const createNft = async (
  appID,
  activeAddress,
  suggestedParams,
  signer,
  assetName,
  metadata_external_url,
  numNfts,
  sellingPrice,
  metadataEncoded,
  algodClient
) => {
  const commonParams = {
    appID,
    sender: activeAddress,
    suggestedParams,
    signer: signer,
  };

  // Seller send algo to contract account to cover MBR
  let txn1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: activeAddress,
    to: algosdk.getApplicationAddress(appID),
    amount: 100000 * numNfts,
    suggestedParams: suggestedParams,
  });

  const txns = [
    { txn: txn1, signer },
    {
      method: getMethod("create_nft"),
      methodArgs: [
        assetName, // asset name
        metadata_external_url, // asset url
        Number(numNfts),
        Number(sellingPrice),
        activeAddress,
        metadataEncoded,
      ],
      ...commonParams,
    },
  ];
  // fetch the return value from the app call txn
  const txnOutputs = await makeATCCall(txns, algodClient);
  const assetID = Number(txnOutputs.methodResults[0].returnValue);
  console.log(`Asset ${assetID} created by contract`);

  console.log("txnOutputs: ", txnOutputs);
  return [assetID, txnOutputs];
};

const fetchNFTs = async (appID) => {
  const deployerAddr = algosdk.getApplicationAddress(appID);
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
      const innertxn = assetTxns.transactions[0]["inner-txns"];
      const acfg_txns = innertxn
        .filter((txn) => txn["tx-type"] === "acfg")
        .forEach((txns) => {
          if (txns.note != undefined) {
            try {
              note = base64ToJson(txns.note);
              return;
            } catch (e) {
              console.log(e);
            }
          }
        });

      const assetInfo = await algodClient.getAssetByID(asset["asset-id"]).do();
      const { decimals, total, url } = assetInfo.params;

      try {
        const metadata = note;
        const imgUrl = url.replace(
          "ipfs://",
          "https://cloudflare-ipfs.com/ipfs/"
        );

        if (url != undefined && asset.amount != 0) {
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
  return nfts;
};

const buyNft = async (
  algodClient,
  appID,
  activeAddress,
  signer,
  metadata,
  assetId,
  globalState
) => {
  const suggestedParams = await algodClient.getTransactionParams().do();
  suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;

  const commonParams = {
    appID,
    sender: activeAddress,
    suggestedParams,
    signer: signer,
  };

  const metadataJSON = JSON.parse(metadata);
  const price = Number(metadataJSON["price"]) * 1e6; // Convert to microalgos (Multiply by 1e6)
  console.log(metadataJSON.price);

  //query the platform fee from platform contract
  const platformFee = globalState.get("platformFee");
  const priceAfterFee = ((100 - platformFee) * price) / 100;
  const feeAmount = (platformFee * price) / 100;
  console.log("priceAfterFee: ", priceAfterFee);
  console.log("fee:", feeAmount);

  // Buyer send algo to contract account
  let transaction1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: activeAddress,
    to: algosdk.getApplicationAddress(appID),
    amount: price + 100000, // Price
    suggestedParams: suggestedParams,
  });

  // transfer NFT
  const transactions = [
    { txn: transaction1, signer },
    {
      method: getMethod("purchase_nft"),
      ...commonParams,
      methodArgs: [assetId, feeAmount, platformFee],
      appForeignAssets: [assetId],
      appAccounts: [appAddress],
      appForeignApps: [Number(process.env.NEXT_PUBLIC_APP_ID)],
    },
  ];

  const txnOutputs = await makeATCCall(transactions, algodClient);
  console.log("txnOutputs: ", txnOutputs);
  console.log("assetId: ", assetId);

  return txnOutputs;
};
const updatecontracts = async (
  algodClient,
  name,
  appID,
  contractID,
  activeAddress,
  signer
) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID: appID,
    sender: activeAddress,
    suggestedParams,
    signer: signer,
  };

  const transaction = [
    {
      method: creatorgetMethod("update_contracts"),
      ...commonParams,
      methodArgs: [name, contractID],
    },
  ];

  console.log(transaction);

  const txnOutputs = await makeATCCall(transaction, algodClient);
  return txnOutputs;
};

const deployerwithdraw = async (algodClient, appID, activeAddress, signer) => {
  const suggestedParams = await algodClient.getTransactionParams().do();
  suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;

  const commonParams = {
    appID,
    sender: activeAddress,
    suggestedParams,
    signer: signer,
  };

  const accountinformation = await algodClient
    .accountInformation(getApplicationAddress(appID))
    .do();
  const algostotransfer = Number(accountinformation["amount"]) - 2e5;
  console.log(algostotransfer);
  const transaction = [
    {
      method: creatorgetMethod("transferEarnings"),
      ...commonParams,
      methodArgs: [algostotransfer],
    },
  ];

  const txnOutputs = await makeATCCall(transaction, algodClient);

  return txnOutputs;
};

const contentcreatorwithdraw = async (
  algodClient,
  appID,
  activeAddress,
  signer
) => {
  const suggestedParams = await algodClient.getTransactionParams().do();
  suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;

  const commonParams = {
    appID,
    sender: activeAddress,
    suggestedParams,
    signer: signer,
  };

  const accountinformation = await algodClient
    .accountInformation(getApplicationAddress(appID))
    .do();

  const algostotransfer =
    Number(accountinformation["amount"]) -
    (accountinformation.assets.length * 100000 + 100000);

  console.log(algostotransfer);

  const transaction = [
    {
      method: getMethod("transferEarnings"),
      ...commonParams,
      methodArgs: [algostotransfer],
    },
  ];

  const txnOutputs = await makeATCCall(transaction, algodClient);

  return txnOutputs;
};

const getBasicProgramBytes = async (data) => {
  // use algod to compile the program
  const compiledProgram = await algodClient.compile(data).do();
  return new Uint8Array(Buffer.from(compiledProgram.result, "base64"));
};

const deployNFTContract = async (
  fromAddress,
  approvalpath,
  clearpath,
  globalint,
  globalbyteslice
) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const approvalProgram = approvalpath;
  const clearProgram = clearpath;

  // global / local states
  const numGlobalInts = globalint;
  const numGlobalByteSlices = globalbyteslice;
  const numLocalInts = 0;
  const numLocalByteSlices = 0;

  const nftcontract = new algosdk.ABIContract(abi);

  const createmethodselector = algosdk
    .getMethodByName(nftcontract.methods, "create")
    .getSelector();

  //get platform fee from main contract
  const appGS = await readGlobalState(process.env.NEXT_PUBLIC_APP_ID);
  const fee = appGS.get("platformFee");
  const appArgs = [createmethodselector, algosdk.encodeUint64(fee)];

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: fromAddress,
    suggestedParams,
    approvalProgram,
    clearProgram,
    numGlobalInts,
    numGlobalByteSlices,
    numLocalInts,
    numLocalByteSlices,
    appArgs: appArgs,
  });

  return txn;
};

const signAndSubmit = async (algodClient, txns, signer) => {
  // used by backend to sign and submit txns to be used for testing
  const groupedTxns = algosdk.assignGroupID(txns);

  const signedTxns = groupedTxns.map((txn) => txn.signTxn(signer.sk));

  const response = await algodClient.sendRawTransaction(signedTxns).do();

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
  createAssetTransferTxn,
  getMethod,
  accountInfo,
  getAssetOptInTxn,
  createNft,
  fetchNFTs,
  buyNft,
  deployerwithdraw,
  contentcreatorwithdraw,
  deployNFTContract,
  getBasicProgramBytes,
  updatecontracts,
  signAndSubmit,
};
