import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import algosdk, {
  getApplicationAddress,
  makeBasicAccountTransactionSigner,
} from "algosdk";

const algotxn = require("../src/algorand/index");
import { deployDemoApp } from "../scripts/index.js";
import * as path from "path";
import * as fs from "fs";

//use chai-as-promise library
chai.use(chaiAsPromised);
let assert = chai.assert;

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

describe("Success Tests", function () {
  let appID, appAddress, nftcontract, nftcontractid;
  const creator = algosdk.mnemonicToSecretKey(
    process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
  );
  const seller = algosdk.generateAccount();
  const buyer = algosdk.generateAccount();

  this.beforeEach(async () => {
    // deploy master contract with percentage cut of 10

    const { confirmation } = await deployDemoApp(creator, 10);
    appID = confirmation["application-index"];

    // fund all contracts
    appAddress = algosdk.getApplicationAddress(appID);
    await algotxn.fundAccount(creator, appAddress, 1e6 + 1e5);
    await algotxn.fundAccount(creator, buyer.addr, 1e6 + 1e5);
    await algotxn.fundAccount(creator, seller.addr, 1e7 + 1e5);
  });

  it("Deploys platform app successfully", async () => {
    const appGS = await algotxn.readGlobalState(appID);
    //verify app created
    assert.isDefined(appID);
    assert.equal(appGS.get("OwnerAddress"), creator.addr);
    //verify app funded
    const appAccount = await algotxn.accountInfo(appAddress);
    assert.equal(appAccount.amount, 1e6 + 1e5);
  });

  it("Seller deploys NFT contract successfully", async () => {
    const suggestedParams = await algodClient.getTransactionParams().do();
    const data1 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/approval.teal"
    );

    const approval = fs.readFileSync(data1);
    const approvalpath = await algotxn.getBasicProgramBytes(approval);

    const data2 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/clear.teal"
    );

    const clear = fs.readFileSync(data2);
    const clearpath = await algotxn.getBasicProgramBytes(clear);
    const txn = await algotxn.deployNFTContract(
      seller.addr,
      approvalpath,
      clearpath,
      32,
      32
    );

    nftcontract = await algotxn.signAndSubmit(algodClient, [txn], seller);
    nftcontractid = Number(nftcontract.confirmation["application-index"]);

    const MBR = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: seller.addr,
      to: algosdk.getApplicationAddress(nftcontractid),
      amount: 200000,
      suggestedParams: suggestedParams,
    });

    await algotxn.signAndSubmit(algodClient, [MBR], seller);
    //generate random collection name
    let contractName = Math.random().toString(36).substring(2, 7);

    await algotxn.updatecontracts(
      algodClient,
      contractName,
      appID,
      nftcontractid,
      seller.addr,
      algosdk.makeBasicAccountTransactionSigner(seller)
    );

    const appGS = await algotxn.readGlobalState(appID);
    assert.isDefined(nftcontractid);
    //assert the value of the newly saved global state is equal to the NFT contract application id
    assert.equal(appGS.get(`contracts${contractName}`), nftcontractid);
    const contractinfo = await algotxn.accountInfo(
      getApplicationAddress(nftcontractid)
    );
    //assert nft contract algos balanced is the amount paid by seller
    assert.equal(contractinfo.amount, 200000);
  });

  it("Seller mints NFT successfully", async () => {
    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;
    const data1 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/approval.teal"
    );

    const approval = fs.readFileSync(data1);
    const approvalpath = await algotxn.getBasicProgramBytes(approval);

    const data2 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/clear.teal"
    );

    const clear = fs.readFileSync(data2);
    const clearpath = await algotxn.getBasicProgramBytes(clear);
    const txn = await algotxn.deployNFTContract(
      seller.addr,
      approvalpath,
      clearpath,
      32,
      32
    );

    nftcontract = await algotxn.signAndSubmit(algodClient, [txn], seller);
    nftcontractid = Number(nftcontract.confirmation["application-index"]);

    const MBR = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: seller.addr,
      to: algosdk.getApplicationAddress(nftcontractid),
      amount: 200000,
      suggestedParams: suggestedParams,
    });

    await algotxn.signAndSubmit(algodClient, [MBR], seller);
    //generate random collection name
    let contractName = Math.random().toString(36).substring(2, 7);

    await algotxn.updatecontracts(
      algodClient,
      contractName,
      appID,
      nftcontractid,
      seller.addr,
      algosdk.makeBasicAccountTransactionSigner(seller)
    );

    const dateminted = new Date();

    // Creating metadata for NFT
    const metadata = {
      creator: seller.addr,
      price: 1,
      standard: "arc69",
      description: "test",
      external_url: `ipfs://hash/#i}`,
      mime_type: "image/jpg",
      license: {
        minted: dateminted.toISOString().split("T")[0],
      },
      properties: "test",
    };

    const jsontToUint8array = (json) => {
      const jsonString = JSON.stringify(json);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);
      return uint8Array;
    };

    const metadataEncoded = jsontToUint8array(metadata);

    const result = await algotxn.createNft(
      nftcontractid,
      seller.addr,
      suggestedParams,
      algosdk.makeBasicAccountTransactionSigner(seller),
      "test",
      metadata.external_url,
      1,
      1,
      metadataEncoded,
      algodClient
    );

    const assetID = result[0];
    // Check if asset is created in contract account
    const appInfo = await algodClient
      .accountInformation(getApplicationAddress(nftcontractid))
      .do();
    const assets = appInfo.assets;
    const assetInAccount = assets.filter(() => {
      return assets["asset-id"] === assetID;
    });
    assert.isDefined(assetInAccount);
  });

  it("Buyer buys NFT successfully", async () => {
    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;
    const data1 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/approval.teal"
    );

    const approval = fs.readFileSync(data1);
    const approvalpath = await algotxn.getBasicProgramBytes(approval);

    const data2 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/clear.teal"
    );

    const clear = fs.readFileSync(data2);
    const clearpath = await algotxn.getBasicProgramBytes(clear);
    const txn = await algotxn.deployNFTContract(
      seller.addr,
      approvalpath,
      clearpath,
      32,
      32
    );

    nftcontract = await algotxn.signAndSubmit(algodClient, [txn], seller);
    nftcontractid = Number(nftcontract.confirmation["application-index"]);

    const MBR = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: seller.addr,
      to: algosdk.getApplicationAddress(nftcontractid),
      amount: 200000,
      suggestedParams: suggestedParams,
    });

    await algotxn.signAndSubmit(algodClient, [MBR], seller);
    //generate random collection name
    let contractName = Math.random().toString(36).substring(2, 7);

    await algotxn.updatecontracts(
      algodClient,
      contractName,
      appID,
      nftcontractid,
      seller.addr,
      algosdk.makeBasicAccountTransactionSigner(seller)
    );

    const dateminted = new Date();

    let price = 1;
    // Creating metadata for NFT
    const metadata = {
      creator: seller.addr,
      price: price,
      standard: "arc69",
      description: "test",
      external_url: `ipfs://hash/#i}`,
      mime_type: "image/jpg",
      license: {
        minted: dateminted.toISOString().split("T")[0],
      },
      properties: "test",
    };

    const jsontToUint8array = (json) => {
      const jsonString = JSON.stringify(json);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);
      return uint8Array;
    };

    const metadataEncoded = jsontToUint8array(metadata);

    const result = await algotxn.createNft(
      nftcontractid,
      seller.addr,
      suggestedParams,
      algosdk.makeBasicAccountTransactionSigner(seller),
      "test",
      metadata.external_url,
      1,
      1,
      metadataEncoded,
      algodClient
    );

    const assetID = result[0];

    //buyer opts into asset
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: buyer.addr,
      to: buyer.addr,
      suggestedParams,
      assetIndex: assetID,
      amount: 0,
    });

    //sign and submit transaction for NFT opt in
    await algotxn.signAndSubmit(algodClient, [optInTxn], buyer);

    let globalState = await algotxn.readGlobalState(appID, algodClient);
    const metadataString = JSON.stringify(metadata);

    const initialaccinfo = await algodClient
      .accountInformation(getApplicationAddress(nftcontractid))
      .do();
    const initialaccbalance = initialaccinfo.amount;

    await algotxn.buyNft(
      algodClient,
      nftcontractid,
      buyer.addr,
      algosdk.makeBasicAccountTransactionSigner(buyer),
      metadataString,
      assetID,
      globalState
    );

    // Check if asset is in buyer account
    const finalaccinfo = await algodClient
      .accountInformation(getApplicationAddress(nftcontractid))
      .do();
    const finalaccbalance = finalaccinfo.amount;
    //assert that nft is owned by buyer
    const buyerinfo = await algodClient.accountInformation(buyer.addr).do();
    const assets = buyerinfo.assets;
    const assetInAccount = assets.filter(() => {
      return assets["asset-id"] === assetID;
    });
    assert.isDefined(assetInAccount);
    //check that correct algos amount is paid
    assert.equal(finalaccbalance - initialaccbalance, price * 1000000);
  });

  it("Owner withdraws earnings successfully", async () => {
    await algotxn.deployerwithdraw(
      algodClient,
      appID,
      creator.addr,
      makeBasicAccountTransactionSigner(creator)
    );
    const accinfo = await algodClient.accountInformation(appAddress).do();
    const accbalance = accinfo.amount;
    //assert that correct algos amount is left in platform contract after withdrawal
    assert.equal(accbalance, 2e5);
  });

  it("Seller withdraws earning successfully", async () => {
    //deploy nft contract
    const data1 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/approval.teal"
    );
    const approval = fs.readFileSync(data1);
    const approvalpath = await algotxn.getBasicProgramBytes(approval);
    const data2 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/clear.teal"
    );
    const clear = fs.readFileSync(data2);
    const clearpath = await algotxn.getBasicProgramBytes(clear);
    const txn = await algotxn.deployNFTContract(
      seller.addr,
      approvalpath,
      clearpath,
      32,
      32
    );
    nftcontract = await algotxn.signAndSubmit(algodClient, [txn], seller);
    nftcontractid = Number(nftcontract.confirmation["application-index"]);

    const fund = Math.floor(Math.random() * 9000000) + 1000000;

    await algotxn.fundAccount(
      creator,
      getApplicationAddress(nftcontractid),
      fund
    );
    await algotxn.contentcreatorwithdraw(
      algodClient,
      nftcontractid,
      seller.addr,
      algosdk.makeBasicAccountTransactionSigner(seller)
    );
    const contractinfo = await algodClient
      .accountInformation(getApplicationAddress(nftcontractid))
      .do();
    const finalcontractbalance = contractinfo.amount;
    //assert that correct algos amount is left in NFT contract after withdrawal
    assert.equal(
      finalcontractbalance,
      contractinfo.assets.length * 100000 + 100000
    );
  });

  it("Seller mints multiple NFTs successfully", async () => {
    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;
    const data1 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/approval.teal"
    );

    const approval = fs.readFileSync(data1);
    const approvalpath = await algotxn.getBasicProgramBytes(approval);

    const data2 = path.join(
      __dirname,
      "../assets/artifacts/nft-marketplace/clear.teal"
    );

    const clear = fs.readFileSync(data2);
    const clearpath = await algotxn.getBasicProgramBytes(clear);
    const txn = await algotxn.deployNFTContract(
      seller.addr,
      approvalpath,
      clearpath,
      32,
      32
    );

    nftcontract = await algotxn.signAndSubmit(algodClient, [txn], seller);
    nftcontractid = Number(nftcontract.confirmation["application-index"]);

    const MBR = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: seller.addr,
      to: algosdk.getApplicationAddress(nftcontractid),
      amount: 200000,
      suggestedParams: suggestedParams,
    });

    await algotxn.signAndSubmit(algodClient, [MBR], seller);
    //generate random collection name
    let contractName = Math.random().toString(36).substring(2, 7);

    await algotxn.updatecontracts(
      algodClient,
      contractName,
      appID,
      nftcontractid,
      seller.addr,
      algosdk.makeBasicAccountTransactionSigner(seller)
    );

    const dateminted = new Date();

    // Creating metadata for NFT
    const metadata = {
      creator: seller.addr,
      price: 1,
      standard: "arc69",
      description: "test",
      external_url: `ipfs://hash/#i}`,
      mime_type: "image/jpg",
      license: {
        minted: dateminted.toISOString().split("T")[0],
      },
      properties: "test",
    };

    const jsontToUint8array = (json) => {
      const jsonString = JSON.stringify(json);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);
      return uint8Array;
    };

    const metadataEncoded = jsontToUint8array(metadata);

    const numNFTs = Math.floor(Math.random() * 5) + 1;
    const result = await algotxn.createNft(
      nftcontractid,
      seller.addr,
      suggestedParams,
      algosdk.makeBasicAccountTransactionSigner(seller),
      "test",
      metadata.external_url,
      parseInt(numNFTs),
      1,
      metadataEncoded,
      algodClient
    );

    const assetID = result[0];
    // Check if asset is created in contract account
    const appInfo = await algodClient
      .accountInformation(getApplicationAddress(nftcontractid))
      .do();
    const assetInfo = await algodClient.getAssetByID(assetID).do();
    const assets = appInfo.assets;
    const assetInAccount = assets.filter(() => {
      return assets["asset-id"] === assetID;
    });
    assert.isDefined(assetInAccount);
    //check that supply is equal to number of NFTs minted
    assert.equal(parseInt(assetInfo.params.total), numNFTs);
  });
});
