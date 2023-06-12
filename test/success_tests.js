import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import algosdk from "algosdk";
import * as algotxn from "../scripts/index.js";

//any valid asset ID from creator account
let assetID = 8457;

// use chai-as-promise library
chai.use(chaiAsPromised);
let assert = chai.assert;

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

describe("Success Tests", function () {
  // write your code here
  let appID, appAddress;
  const creator = algosdk.mnemonicToSecretKey(
    process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
  );
  const buyer = algosdk.generateAccount();

  this.beforeEach(async () => {
    // deploy app

    const { confirmation } = await algotxn.deployDemoApp(creator);
    appID = confirmation["application-index"];

    // fund contract and buyer with 1.1 Algos
    appAddress = algosdk.getApplicationAddress(appID);
    await algotxn.fundAccount(creator, appAddress, 1e6 + 1e5);
    await algotxn.fundAccount(creator, buyer.addr, 1e6 + 1e5);
  });

  it("Deploys app successfully", async () => {
    const appGS = await algotxn.readGlobalState(appID);
    // write your code here
    //verify app created
    assert.isDefined(appID);
    assert.equal(appGS.get("OwnerAddress"), creator.addr);
    //verify app funded
    const appAccount = await algotxn.accountInfo(appAddress);
    assert.equal(appAccount.amount, 1e6 + 1e5);
  });

  it("Account opts in successfully", async () => {
    await algotxn.optIntoApp(creator, appID);

    // verify local state initialized
    const appLS = await algotxn.readLocalState(creator.addr, appID);
    assert.equal(appLS.get("AssetBalances"), 0);
    assert.equal(appLS.get("microAlgoBalance"), 1100000);
  });

  it("Owner deposits ASAs to vault and withdraws from vault successfully", async () => {
    // write your code here
    const suggestedParams = await algodClient.getTransactionParams().do();
    const commonParams = {
      appID,
      sender: creator.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(creator),
    };
    await algotxn.optIntoApp(creator, appID);
    const txn1 = [
      {
        method: algotxn.getMethod("optintoasset"),
        ...commonParams,
        appForeignAssets: [assetID],
      },
    ];

    await algotxn.makeATCCall(txn1);
    // transfer ASA
    let nfttxn = [
      await algotxn.createAssetTransferTxn(
        algodClient,
        creator.addr,
        appAddress,
        parseInt(assetID),
        1
      ),
    ];
    console.log(nfttxn);
    const groupedTxn = algosdk.assignGroupID(nfttxn);

    // Sign
    const signedTxns = groupedTxn.map((txn) => txn.signTxn(creator.sk));
    const response = await algodClient.sendRawTransaction(signedTxns).do();

    const confirmation = await algosdk.waitForConfirmation(
      algodClient,
      response.txId,
      4
    );
    console.log(confirmation);

    //update local states
    const txn2 = [
      {
        method: algotxn.getMethod("deposit_asa"),
        ...commonParams,
        methodArgs: [1],
      },
    ];
    await algotxn.makeATCCall(txn2);

    const txn3 = [
      {
        method: algotxn.getMethod("update_deposit_algos"),
        ...commonParams,
        methodArgs: [100000],
      },
    ];

    await algotxn.makeATCCall(txn3);
    const appLS = await algotxn.readLocalState(creator.addr, appID);
    assert.equal(appLS.get("AssetBalances"), 1);
    assert.equal(appLS.get("microAlgoBalance"), 1200000);

    //return ASA back to owner address
    //opt into asset
    await algotxn.optIntoAsset(creator, assetID);

    // transfer NFT
    const withdraw = [
      {
        method: algotxn.getMethod("transferasafromvault"),
        ...commonParams,
        appForeignAssets: [assetID],
      },
    ];

    await algotxn.makeATCCall(withdraw);
  });

  it("Owner transfers ASAs out successfully", async () => {
    // write your code here
    const suggestedParams = await algodClient.getTransactionParams().do();
    const commonParams = {
      appID,
      sender: creator.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(creator),
    };
    await algotxn.optIntoApp(creator, appID);
    const opt = [
      {
        method: algotxn.getMethod("optintoasset"),
        ...commonParams,
        appForeignAssets: [assetID],
      },
    ];

    await algotxn.makeATCCall(opt);
    // transfer ASA
    let nfttxn = [
      await algotxn.createAssetTransferTxn(
        algodClient,
        creator.addr,
        appAddress,
        parseInt(assetID),
        1
      ),
    ];
    console.log(nfttxn);
    const groupedTxns = algosdk.assignGroupID(nfttxn);

    // Sign
    const signedTxn = groupedTxns.map((txn) => txn.signTxn(creator.sk));
    const resp = await algodClient.sendRawTransaction(signedTxn).do();

    const confirm = await algosdk.waitForConfirmation(
      algodClient,
      resp.txId,
      4
    );
    console.log(confirm);

    const deposit = [
      {
        method: algotxn.getMethod("deposit_asa"),
        ...commonParams,
        methodArgs: [1],
      },
    ];
    await algotxn.makeATCCall(deposit);

    await algotxn.optIntoAsset(buyer, assetID);

    const txn1 = [
      {
        method: algotxn.getMethod("sendasatobuyer"),
        ...commonParams,
        appForeignAssets: [assetID],
        appAccounts: [buyer.addr],
      },
    ];
    await algotxn.makeATCCall(txn1);

    //update local states
    const txn2 = [
      {
        method: algotxn.getMethod("update_withdraw_algos"),
        ...commonParams,
        methodArgs: [100000],
      },
    ];

    await algotxn.makeATCCall(txn2);

    const txn3 = [
      {
        method: algotxn.getMethod("withdraw_asa"),
        ...commonParams,
        methodArgs: [1],
      },
    ];

    await algotxn.makeATCCall(txn3);

    const appLS = await algotxn.readLocalState(creator.addr, appID);
    assert.equal(appLS.get("microAlgoBalance"), 1000000);
    assert.equal(appLS.get("AssetBalance", 0));
  });

  it("Owner closes out asset successfully", async () => {
    // write your code here
    //swap both address to carry out the asa deposit and asa transfer
    //"buyer" send to "creator"
    let suggestedParams = await algodClient.getTransactionParams().do();

    const txn1 = [
      {
        method: algotxn.getMethod("optintoasset"),
        appID,
        sender: creator.addr,
        suggestedParams,
        signer: algosdk.makeBasicAccountTransactionSigner(creator),
        appForeignAssets: [assetID],
      },
    ];

    await algotxn.makeATCCall(txn1);
    let nfttxn = [
      await algotxn.createAssetTransferTxn(
        algodClient,
        buyer.addr,
        appAddress,
        parseInt(assetID),
        1
      ),
    ];
    console.log(nfttxn);
    const groupedTxn = algosdk.assignGroupID(nfttxn);

    // Sign
    const signedTxns = groupedTxn.map((txn) => txn.signTxn(buyer.sk));
    const response = await algodClient.sendRawTransaction(signedTxns).do();

    const confirmation = await algosdk.waitForConfirmation(
      algodClient,
      response.txId,
      4
    );
    console.log(confirmation);
    await algotxn.optIntoApp(creator, appID);
    //change owner to buyer address
    const txn = [
      {
        method: algotxn.getMethod("update_global"),
        appAccounts: [buyer.addr],
        appID,
        sender: creator.addr,
        suggestedParams,
        signer: algosdk.makeBasicAccountTransactionSigner(creator),
      },
    ];
    await algotxn.makeATCCall(txn);
    await algotxn.optIntoApp(buyer, appID);

    let commonParams = {
      appID,
      sender: buyer.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(buyer),
    };

    algotxn.optIntoAsset(creator, assetID);

    const txn2 = [
      {
        method: algotxn.getMethod("deposit_asa"),
        ...commonParams,
        methodArgs: [1],
      },
    ];
    await algotxn.makeATCCall(txn2);

    //send asa to creator account and close out
    const txn3 = [
      {
        method: algotxn.getMethod("sendasatobuyercloseout"),
        ...commonParams,
        appForeignAssets: [assetID],
        appAccounts: [creator.addr],
      },
    ];
    await algotxn.makeATCCall(txn3);

    const txn4 = [
      {
        method: algotxn.getMethod("withdraw_asa"),
        ...commonParams,
        methodArgs: [1],
      },
    ];

    await algotxn.makeATCCall(txn4);

    const appLS = await algotxn.readLocalState(buyer.addr, appID);
    assert.equal(appLS.get("AssetBalance", 0));
    assert.equal(appLS.get("microAlgoBalance"), 1100000);
    //check if asset information record is removed from vault

    //attempt to get asset info from account
    const updatedappinfo = await algotxn.accountInfo(appAddress);
    //assert that asset array of app is empty
    assert.equal(updatedappinfo.assets.length, 0);
  });

  it("Owner changes owner address successfully", async () => {
    // write your code here
    const suggestedParams = await algodClient.getTransactionParams().do();
    const commonParams = {
      appID,
      sender: creator.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(creator),
    };
    await algotxn.optIntoApp(creator, appID);

    // write your code here
    const txn = [
      {
        method: algotxn.getMethod("update_global"),
        appAccounts: [buyer.addr],
        ...commonParams,
      },
    ];
    await algotxn.makeATCCall(txn);
    const appGS = await algotxn.readGlobalState(appID);
    assert.isDefined(appID);
    //assert that new global state is the new address
    assert.equal(appGS.get("OwnerAddress"), buyer.addr);
  });
});
