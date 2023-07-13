import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });
import algosdk from "algosdk";
import * as algotxn from "./index.js";

(async () => {
  const creator = algosdk.mnemonicToSecretKey(
    process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
  );

  // deploy platform contract with fee as parameter
  const { confirmation } = await algotxn.deployDemoApp(creator, 10);
  console.log(confirmation);
  const appId = confirmation["application-index"];
  console.log(`Deployed App ID is ${appId}. Save this app ID in the env file.`);

  // fund contract
  const appAddress = algosdk.getApplicationAddress(appId);
  await algotxn.fundAccount(creator, appAddress, 1e6);

  const appGS = await algotxn.readGlobalState(appId);
  console.log(appGS);
  console.log("Write this in the .env.local file");
  console.log([appId, appAddress]);
})();
