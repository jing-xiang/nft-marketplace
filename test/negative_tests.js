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
  let appID, appAddress, nftcontract, nftcontractid;
  const creator = algosdk.mnemonicToSecretKey(
    process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
  );
  const alt = algosdk.generateAccount();
  const seller = algosdk.generateAccount();
  const buyer = algosdk.generateAccount();
  this.beforeEach(async () => {
    // deploy app
    const { confirmation } = await deployDemoApp(creator, 10);
    appID = confirmation["application-index"];

    // fund all accounts
    appAddress = algosdk.getApplicationAddress(appID);
    await algotxn.fundAccount(creator, appAddress, 2e7 + 1e5);
    await algotxn.fundAccount(creator, alt.addr, 2e7 + 1e5);
    await algotxn.fundAccount(creator, buyer.addr, 2e7 + 1e5);
    await algotxn.fundAccount(creator, seller.addr, 2e7 + 1e5);
  });

  it("Non owner cannot mint NFT on contract they do not own", async () => {
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
      creator: buyer.addr,
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

    //buyer attempt to mint nft on seller's created contract
    await expect(
      algotxn.createNft(
        nftcontractid,
        buyer.addr,
        suggestedParams,
        algosdk.makeBasicAccountTransactionSigner(seller),
        "test",
        metadata.external_url,
        1,
        1,
        metadataEncoded,
        algodClient
      )
    ).to.be.rejectedWith(Error);
  });
  it("Non owner cannot withdraw earnings from master contract earnings", async () => {
    await algotxn.fundAccount(creator, getApplicationAddress(appID), 10e7);
    //seller attempt to withdraw from platform contract
    await expect(
      algotxn.deployerwithdraw(
        algodClient,
        appID,
        seller.addr,
        makeBasicAccountTransactionSigner(seller)
      )
    ).to.be.rejectedWith(Error);
  });

  it("Non owner cannot withdraw earnings from NFT contract they do not own", async () => {
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

    await algotxn.fundAccount(
      creator,
      getApplicationAddress(nftcontractid, 10e7)
    );
    //buyer attempt to withdraw from seller's deployed NFT contract
    await expect(
      algotxn.contentcreatorwithdraw(
        algodClient,
        appID,
        buyer.addr,
        makeBasicAccountTransactionSigner(buyer)
      )
    ).to.be.rejectedWith(Error);
  });
  it("Mint 0 NFT fails", async () => {
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
    //attempt to mint 0 number of NFTs
    await expect(
      algotxn.createNft(
        nftcontractid,
        seller.addr,
        suggestedParams,
        algosdk.makeBasicAccountTransactionSigner(seller),
        "test",
        metadata.external_url,
        0,
        1,
        metadataEncoded,
        algodClient
      )
    ).to.be.rejectedWith(Error);
  });

  it("Set invalid selling price for NFT fails", async () => {
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
    //attempt to set selling price as 0
    await expect(
      algotxn.createNft(
        nftcontractid,
        seller.addr,
        suggestedParams,
        algosdk.makeBasicAccountTransactionSigner(seller),
        "test",
        metadata.external_url,
        1,
        0,
        metadataEncoded,
        algodClient
      )
    ).to.be.rejectedWith(Error);
  });

  it("Buyer buy NFT without enough algos fails", async () => {
    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;
    //create account with zero algos
    const poor_buyer = algosdk.generateAccount();
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
      from: poor_buyer.addr,
      to: poor_buyer.addr,
      suggestedParams,
      assetIndex: assetID,
      amount: 0,
    });

    //poor buyer attempts to opt into asset without enough MBR
    await expect(
      algotxn.signAndSubmit(algodClient, [optInTxn], poor_buyer)
    ).to.be.rejectedWith(Error);

    let globalState = await algotxn.readGlobalState(appID, algodClient);
    const metadataString = JSON.stringify(metadata);
    //buyer attempt to buy NFT
    await expect(
      algotxn.buyNft(
        algodClient,
        nftcontractid,
        poor_buyer.addr,
        algosdk.makeBasicAccountTransactionSigner(poor_buyer),
        metadataString,
        assetID,
        globalState
      )
    ).to.be.rejectedWith(Error);
  });

  it("Seller create NFT without paying MBR fails", async () => {
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

    const commonParams = {
      appID: nftcontractid,
      sender: seller.addr,
      suggestedParams,
      signer: makeBasicAccountTransactionSigner(seller),
    };
    const createtxnwithoutMBR = [
      {
        method: algotxn.getMethod("create_nft"),
        methodArgs: [
          "testname", // asset name
          "test_url", // asset url
          1,
          1,
          seller.addr,
          metadataEncoded,
        ],
        ...commonParams,
      },
    ];
    // attempt to create nft without paying MBR beforehand in ungrouped txn
    await expect(
      algotxn.makeATCCall(createtxnwithoutMBR, algodClient)
    ).to.be.rejectedWith(Error);
  });

  it("Withdraw 0 algos from platform contract fails", async () => {
    //attempt to withdraw earnings twice consecutively
    await algotxn.deployerwithdraw(
      algodClient,
      appID,
      creator.addr,
      makeBasicAccountTransactionSigner(creator)
    );
    await expect(
      algotxn.deployerwithdraw(
        algodClient,
        appID,
        creator.addr,
        makeBasicAccountTransactionSigner(creator)
      )
    ).to.be.rejectedWith(Error);
  });

  it("Withdraw 0 algos from NFT contract fails", async () => {
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
    //attempt to withdraw from NFT contract twice consecutively
    await algotxn.contentcreatorwithdraw(
      algodClient,
      nftcontractid,
      seller.addr,
      algosdk.makeBasicAccountTransactionSigner(seller)
    );
    await expect(
      algotxn.contentcreatorwithdraw(
        algodClient,
        nftcontractid,
        seller.addr,
        algosdk.makeBasicAccountTransactionSigner(seller)
      )
    ).to.be.rejectedWith(Error);
  });
});
