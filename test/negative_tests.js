import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import algosdk, { mnemonicToSecretKey } from "algosdk";
import * as algotxn from "../scripts/index.js";

let assetID = 8461;

// use chai-as-promise library
chai.use(chaiAsPromised);
const assert = chai.assert;
const expect = chai.expect;
const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

describe("Negative Tests", function () {
  // write your code here
  let appID, appAddress;
  //if creator is another account
  const creator = algosdk.mnemonicToSecretKey(
    process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
  );
  const alt = algosdk.generateAccount();
  this.beforeEach(async () => {
    // deploy app
    const { confirmation } = await algotxn.deployDemoApp(creator);
    appID = confirmation["application-index"];

    // fund contract and alt address with 1.1 Algos
    appAddress = algosdk.getApplicationAddress(appID);
    await algotxn.fundAccount(creator, appAddress, 1e6 + 1e5);
    await algotxn.fundAccount(creator, alt.addr, 1e6 + 1e5);
  });

  it("Non owner cannot send ASAs to the vault", async () => {
    // write your code here
    const suggestedParams = await algodClient.getTransactionParams().do();
    const commonParams = {
      appID,
      sender: alt.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(alt),
    };
    await algotxn.optIntoApp(alt, appID);
    const txn1 = [
      {
        method: algotxn.getMethod("optintoasset"),
        ...commonParams,
        appForeignAssets: [assetID],
      },
    ];

    await expect(algotxn.makeATCCall(txn1)).to.be.rejectedWith(Error);
    // transfer ASA
    let nfttxn = [
      await algotxn.createAssetTransferTxn(
        algodClient,
        alt.addr,
        appAddress,
        parseInt(assetID),
        1
      ),
    ];

    const groupedTxn = algosdk.assignGroupID(nfttxn);
    // Sign
    const signedTxns = groupedTxn.map((txn) => txn.signTxn(alt.sk));

    const response = await expect(
      algodClient.sendRawTransaction(signedTxns).do()
    ).to.be.rejectedWith(Error);
    const confirmation = expect(
      algosdk.waitForConfirmation(algodClient, response.txId, 4)
    ).to.be.rejectedWith(Error);
    const txn2 = [
      {
        method: algotxn.getMethod("deposit_asa"),
        ...commonParams,
        methodArgs: [1],
      },
    ];
    await expect(algotxn.makeATCCall(txn2)).to.be.rejectedWith(Error);

    const txn3 = [
      {
        method: algotxn.getMethod("update_deposit_algos"),
        ...commonParams,
        methodArgs: [100000],
      },
    ];

    await expect(algotxn.makeATCCall(txn3)).to.be.rejectedWith(Error);
  });

  it("Non owner cannot transfer ASAs from the vault", async () => {
    // write your code here
    const suggestedParams = await algodClient.getTransactionParams().do();
    const commonParams = {
      appID,
      sender: alt.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(alt),
    };
    await algotxn.optIntoApp(creator, appID);
    const opt = [
      {
        method: algotxn.getMethod("optintoasset"),
        appID,
        sender: creator.addr,
        suggestedParams,
        signer: algosdk.makeBasicAccountTransactionSigner(creator),
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
        appID,
        sender: creator.addr,
        suggestedParams,
        signer: algosdk.makeBasicAccountTransactionSigner(creator),
        methodArgs: [1],
      },
    ];
    await algotxn.makeATCCall(deposit);

    await algotxn.optIntoAsset(alt, assetID);

    const txn1 = [
      {
        method: algotxn.getMethod("sendasatobuyer"),
        ...commonParams,
        appForeignAssets: [assetID],
        appAccounts: [alt.addr],
      },
    ];
    await expect(algotxn.makeATCCall(txn1)).to.be.rejectedWith(Error);

    const txn2 = [
      {
        method: algotxn.getMethod("update_withdraw_algos"),
        ...commonParams,
        methodArgs: [100000],
      },
    ];

    await expect(algotxn.makeATCCall(txn2)).to.be.rejectedWith(Error);

    const txn3 = [
      {
        method: algotxn.getMethod("withdraw_asa"),
        ...commonParams,
        methodArgs: [1],
      },
    ];

    await expect(algotxn.makeATCCall(txn3)).to.be.rejectedWith(Error);

    await algotxn.optIntoAsset(creator, assetID);

    // transfer NFT
    const withdraw = [
      {
        method: algotxn.getMethod("transferasafromvault"),
        appID,
        sender: creator.addr,
        suggestedParams,
        signer: algosdk.makeBasicAccountTransactionSigner(creator),
        appForeignAssets: [assetID],
      },
    ];

    await algotxn.makeATCCall(withdraw);
  });

  it("Non owner cannot close out ASAs from the vault", async () => {
    const suggestedParams = await algodClient.getTransactionParams().do();
    const commonParams = {
      appID,
      sender: alt.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(alt),
    };
    await algotxn.optIntoApp(creator, appID);
    const opt = [
      {
        method: algotxn.getMethod("optintoasset"),
        appID,
        sender: creator.addr,
        suggestedParams,
        signer: algosdk.makeBasicAccountTransactionSigner(creator),
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
        appID,
        sender: creator.addr,
        suggestedParams,
        signer: algosdk.makeBasicAccountTransactionSigner(creator),
        methodArgs: [1],
      },
    ];
    await algotxn.makeATCCall(deposit);

    await algotxn.optIntoAsset(alt, assetID);

    const txn1 = [
      {
        method: algotxn.getMethod("sendasatobuyercloseout"),
        ...commonParams,
        appForeignAssets: [assetID],
        appAccounts: [alt.addr],
      },
    ];
    await expect(algotxn.makeATCCall(txn1)).to.be.rejectedWith(Error);

    const txn2 = [
      {
        method: algotxn.getMethod("update_withdraw_algos"),
        ...commonParams,
        methodArgs: [100000],
      },
    ];

    await expect(algotxn.makeATCCall(txn2)).to.be.rejectedWith(Error);

    const txn3 = [
      {
        method: algotxn.getMethod("withdraw_asa"),
        ...commonParams,
        methodArgs: [1],
      },
    ];

    await expect(algotxn.makeATCCall(txn3)).to.be.rejectedWith(Error);

    await expect(algotxn.readLocalState(alt.addr, appID)).to.be.rejectedWith(
      Error
    );

    await algotxn.optIntoApp(creator, appID);
    //check whether asset is closed out by the alt account
    const updatedappinfo = await algotxn.accountInfo(appAddress);
    assert.equal(updatedappinfo.assets.length, 1);
    await algotxn.optIntoAsset(creator, assetID);
    // transfer NFT
    const withdraw = [
      {
        method: algotxn.getMethod("transferasafromvault"),
        appID,
        sender: creator.addr,
        suggestedParams,
        signer: algosdk.makeBasicAccountTransactionSigner(creator),
        appForeignAssets: [assetID],
      },
    ];

    await algotxn.makeATCCall(withdraw);
  });

  it("Non owner cannot change owner address", async () => {
    // write your code here
    const suggestedParams = await algodClient.getTransactionParams().do();
    const commonParams = {
      appID,
      sender: alt.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(alt),
    };
    await algotxn.optIntoApp(alt, appID);

    // write your code here
    const txn = [
      {
        method: algotxn.getMethod("update_global"),
        appAccounts: [alt.addr],
        ...commonParams,
      },
    ];
    await expect(algotxn.makeATCCall(txn)).to.be.rejectedWith(Error);
  });
});
