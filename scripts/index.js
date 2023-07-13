import * as fs from "fs";
import * as path from "path";
import algosdk from "algosdk";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });

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

const getBasicProgramBytes = async (relativeFilePath) => {
  const filePath = path.join(__dirname, relativeFilePath);
  console.log(filePath);
  const data = fs.readFileSync(filePath);

  // use algod to compile the program
  const compiledProgram = await algodClient.compile(data).do();
  return new Uint8Array(Buffer.from(compiledProgram.result, "base64"));
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

const deployDemoApp = async (fromAccount, fee) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  // programs
  const approvalProgram = await getBasicProgramBytes(
    "../assets/artifacts/creator/approval.teal"
  );
  const clearProgram = await getBasicProgramBytes(
    "../assets/artifacts/creator/clear.teal"
  );
  //TODO: edit values
  // global / local states
  const numGlobalInts = 11;
  const numGlobalByteSlices = 1;
  const numLocalInts = 0;
  const numLocalByteSlices = 0;

  const platformFee = fee; //
  const adminAddress = process.env.NEXT_PUBLIC_DEPLOYER_ADDR; //deployer address

  const createmethodselector = getMethodByName("create").getSelector();

  const appArgs = [createmethodselector, algosdk.encodeUint64(platformFee)];

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    approvalProgram,
    clearProgram,
    numGlobalInts,
    numGlobalByteSlices,
    numLocalInts,
    numLocalByteSlices,
    appArgs: appArgs,
    accounts: [adminAddress],
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
    from: fromAccount.addr,
    to: fromAccount.addr,
    assetIndex: assetId,
    amount: 0,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const getMethodByName = (methodName) => {
  const source = path.join(
    __dirname,
    "../assets/artifacts/nft-marketplace/contract.json"
  );
  const buff = fs.readFileSync(source);

  // Parse the json file into an object, pass it to create an ABIContract object
  const contract = new algosdk.ABIContract(JSON.parse(buff.toString()));

  const method = contract.methods.find((mt) => mt.name === methodName);

  if (method === undefined) throw Error("Method undefined: " + method);

  return method;
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

const accountInfo = async (addr) => {
  return await algodClient.accountInformation(addr).do();
};

const getMethod = (methodName) => {
  const data = require("../assets/artifacts/creator/contract.json");

  // Parse the json file into an object, pass it to create an ABIContract object
  const contract = new algosdk.ABIContract(data);

  const method = contract.methods.find((mt) => mt.name === methodName);

  if (method === undefined) throw Error("Method undefined: " + method);

  return method;
};

export {
  deployDemoApp,
  fundAccount,
  readGlobalState,
  optIntoApp,
  optIntoAsset,
  submitToNetwork,
  getMethodByName,
  makeATCCall,
  getAlgodClient,
  createAssetTransferTxn,
  accountInfo,
  getMethod,
};
