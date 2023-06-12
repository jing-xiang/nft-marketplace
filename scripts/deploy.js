import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });
import algosdk from "algosdk";
import * as algotxn from "../scripts/index.js";

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);
const suggestedParams = algodClient.getTransactionParams().do();

(async () => {
  const creator = algosdk.mnemonicToSecretKey(
    process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
  );

  // deploy app
  const { confirmation } = await algotxn.deployDemoApp(creator);
  console.log(confirmation);
  const appId = confirmation["application-index"];
  console.log(`Deployed App ID is ${appId}. Save this app ID in the env file.`);

  const commonParams = {
    appId,
    sender: creator.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(creator),
  };

  // fund contract with 1 Algo + 0.1 Algos (min balance) - to be used for inner txn
  const appAddress = algosdk.getApplicationAddress(appId);
  await algotxn.fundAccount(creator, appAddress, 1e6 + 1e5);
  console.log(appAddress);
  console.log("Write this in the .env.local file");

  await algotxn.optIntoApp(creator, appId);
  // read app global state
  const appGS = await algotxn.readGlobalState(appId);
  console.log(appGS);
})();

//completed
