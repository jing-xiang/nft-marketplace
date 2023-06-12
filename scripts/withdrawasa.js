import algosdk, {
  appendSignRawMultisigSignature,
  getApplicationAddress,
} from "algosdk";
import {
  getMethodByName,
  makeATCCall,
  optIntoApp,
  submitToNetwork,
  optIntoAsset,
} from "../scripts/index.js";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });
import * as algotxn from "../scripts/index.js";

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

(async () => {
  const creator = algosdk.mnemonicToSecretKey(
    process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
  );
  const suggestedParams = await algodClient.getTransactionParams().do();

  // get app ID
  const appID = Number(process.env.NEXT_PUBLIC_APP_ID);
  console.log("App ID is: ", appID);

  const commonParams = {
    appID,
    sender: creator.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(creator),
  };

  await optIntoApp(creator, appID);

  //payment 1 txn
  const txn1 = [
    {
      method: getMethodByName("receivealgos"),
      methodArgs: [1e5],
      ...commonParams,
    },
  ];

  console.log(txn1);

  await makeATCCall(txn1);

  //TODO: Enter assetID to withdraw here
  let assetID = 1484;

  //opt into asset
  await optIntoAsset(creator, assetID);

  // transfer NFT
  const txn2 = [
    {
      method: getMethodByName("transferasafromvault"),
      ...commonParams,
      appForeignAssets: [assetID],
    },
  ];

  await makeATCCall(txn2);

  // print NFT info
  console.log(
    await algodClient.accountAssetInformation(creator.addr, assetID).do()
  );
  console.log("ASA withdrawed!");
  //payment 1 txn
  const txn3 = [
    {
      method: getMethodByName("withdraw_asa"),
      methodArgs: [1],
      ...commonParams,
    },
  ];
  await makeATCCall(txn3);
  //payment 1 txn
  const txn4 = [
    {
      method: getMethodByName("update_withdraw_algos"),
      methodArgs: [1e5],
      ...commonParams,
    },
  ];
  await makeATCCall(txn4);

  await algotxn.optIntoApp(creator, appID);
  const algo_balance = await algotxn.readLocalState(creator.addr, appID);
  console.log(algo_balance);
})();
