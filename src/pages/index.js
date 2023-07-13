import Head from "next/head";
import styles from "@/styles/Home.module.css";
import Navbar from "@/components/Navbar";
import NftList from "@/components/NftList";
import Button from "@/components/Button";
import CreateNftForm from "@/components/CreateNftForm";
import { useEffect, useState } from "react";
import { getAlgodClient } from "../clients";
import { useWallet } from "@txnlab/use-wallet";
import * as algotxn from "@/algorand";
import algosdk from "algosdk";
import axios from "axios";
import { createNft, buyNft } from "@/algorand";

const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
const algodClient = getAlgodClient(network);

const appID = parseInt(process.env.NEXT_PUBLIC_APP_ID);
const appAddress = algosdk.getApplicationAddress(appID);
let globalState = await algotxn.readGlobalState(appID, algodClient); //read global state
const platformFee = globalState.get("platformFee");
let collections = globalState;
collections.delete("OwnerAddress");
collections.delete("platformFee");

let nftcontract, nftcontractid, contractName;

const suggestedParams = await algodClient.getTransactionParams().do();
suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;

export default function Home() {
  const [nfts, setNfts] = useState([]);
  const [isSeller, setIsSeller] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [txnref, setTxnRef] = useState("");
  const [txnUrl, setTxnUrl] = useState("");
  const { activeAddress, signTransactions, sendTransactions, signer } =
    useWallet();
  const [selectedCollection, setSelectedCollection] = useState("");

  const loadNfts = async () => {
    // write code to load NFTs
    const NftList = await algotxn.fetchNFTs(Number(selectedCollection));
    setNfts(NftList);
  };

  const handleCollectionChange = (event) => {
    const selectedCollection = event.target.value;
    setSelectedCollection(selectedCollection);
  };

  useEffect(() => {
    loadNfts();

    setIsSeller(true);
    if (activeAddress === process.env.NEXT_PUBLIC_DEPLOYER_ADDR) {
      setIsOwner(true);
    } else {
      setIsOwner(false);
    }
  }, [activeAddress, selectedCollection]);

  const getTxnRefUrl = (txId) => {
    if (network === "SandNet") {
      return `https://app.dappflow.org/explorer/transaction/${txId}`;
    } else if (network === "TestNet") {
      return `https://testnet.algoexplorer.io/tx/${txId}`;
    }

    return "";
  };

  const handleDeployContract = async () => {
    if (
      contractName == undefined ||
      collections.has(`contracts${contractName}`)
    ) {
      alert("Please enter a valid collection name.");
      return;
    }
    const suggestedParams = await algodClient.getTransactionParams().do();
    const res = await axios.get("http://localhost:3000/api/path");
    const approvalpath = await algotxn.getBasicProgramBytes(
      res.data.data1.data
    );
    const clearpath = await algotxn.getBasicProgramBytes(res.data.data1.data);
    const txn = await algotxn.deployNFTContract(
      activeAddress,
      approvalpath,
      clearpath,
      32,
      32
    );

    const payload = [txn];
    const groupedTxn = algosdk.assignGroupID(payload);
    const encodedTxns = groupedTxn.map((txn) =>
      algosdk.encodeUnsignedTransaction(txn)
    );
    const signed = await signTransactions(encodedTxns);
    nftcontract = await sendTransactions(signed, 4);
    nftcontractid = Number(nftcontract["application-index"]);
    setTxnRef(nftcontract.txId);
    setTxnUrl(getTxnRefUrl(nftcontract.txId));

    const MBR = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: activeAddress,
      to: algosdk.getApplicationAddress(nftcontractid),
      amount: 200000,
      suggestedParams: suggestedParams,
    });
    const MBRTxn = [MBR];
    const groupedMBRTxn = algosdk.assignGroupID(MBRTxn);
    const encodedMBRTxns = groupedMBRTxn.map((txn) =>
      algosdk.encodeUnsignedTransaction(txn)
    );
    const signedMBRTxn = await signTransactions(encodedMBRTxns);
    await sendTransactions(signedMBRTxn, 4);

    await algotxn.updatecontracts(
      algodClient,
      contractName,
      appID,
      nftcontractid,
      activeAddress,
      signer
    );
  };

  const handleCreateNft = async (
    assetName,
    desc,
    assetFile,
    numNfts,
    sellingPrice,
    signer,
    creatorAddress,
    properties
  ) => {
    nftcontractid = Number(selectedCollection);
    const pinFileToIPFS = async () => {
      const formData = new FormData();
      const fileInput = document.getElementById("file-upload");
      const file = fileInput.files[0];
      formData.append("file", file);

      const options = JSON.stringify({
        cidVersion: 0,
      });

      formData.append("pinataOptions", options);

      try {
        const res = await axios.post(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          formData,
          {
            maxBodyLength: "Infinity",
            headers: {
              "Content-Type": `multipart/form-data`,
              pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY,
              pinata_secret_api_key: process.env.NEXT_PUBLIC_PINATA_API_SECRET,
            },
          }
        );
        return res.data;
      } catch (error) {
        console.log("error: ", error.response);
      }
    };

    console.log("pinning to pinata...");
    const pinnedFiles = await pinFileToIPFS();

    const dateminted = new Date();

    // Creating metadata for NFT
    const metadata = {
      creator: activeAddress,
      price: sellingPrice,
      standard: "arc69",
      description: desc,
      external_url: `ipfs://${pinnedFiles.IpfsHash}/#${assetFile.type[0]}`,
      mime_type: assetFile.type,
      license: {
        minted: dateminted.toISOString().split("T")[0],
      },
      properties: properties,
    };

    const jsontToUint8array = (json) => {
      const jsonString = JSON.stringify(json);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);
      return uint8Array;
    };

    const metadataEncoded = jsontToUint8array(metadata);

    try {
      const result = await createNft(
        nftcontractid,
        activeAddress,
        suggestedParams,
        signer,
        assetName,
        metadata.external_url,
        numNfts,
        sellingPrice,
        metadataEncoded,
        algodClient
      );

      const assetID = result[0];
      const txnOutputs = result[1];

      setTxnRef(txnOutputs.txIDs[1]);
      setTxnUrl(getTxnRefUrl(txnOutputs.txIDs[1]));
    } catch (error) {
      alert("Invalid request");
      console.log(error);
    }

    loadNfts(); // refresh the page to display the newly created NFT
  };

  const handleBuyNft = async (assetId, signer, metadata) => {
    nftcontractid = Number(selectedCollection);
    const suggestedParams = await algodClient.getTransactionParams().do();

    let globalState = await algotxn.readGlobalState(appID, algodClient); //read global state

    //Transaction - Buyer opts into the NFT
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: activeAddress,
      to: activeAddress,
      suggestedParams,
      assetIndex: assetId,
      amount: 0,
    });

    //sign and submit transaction for NFT opt in
    const payload = [optInTxn];
    const groupedTxn = algosdk.assignGroupID(payload);
    const encodedTxns = groupedTxn.map((txn) =>
      algosdk.encodeUnsignedTransaction(txn)
    );
    const signed = await signTransactions(encodedTxns);
    const res = await sendTransactions(signed, 4);
    console.log(res);

    const txn = await buyNft(
      algodClient,
      nftcontractid,
      activeAddress,
      signer,
      metadata,
      assetId,
      globalState
    );

    setTxnRef(txn.txIDs[1]);
    setTxnUrl(getTxnRefUrl(txn.txIDs[1]));

    loadNfts(); // update the page
  };

  const handleWithdrawEarnings = async () => {
    try {
      if (isOwner) {
        const withdrawal = await algotxn.deployerwithdraw(
          algodClient,
          appID,
          activeAddress,
          signer
        );
        setTxnRef(withdrawal.txIDs[0]);
        setTxnUrl(getTxnRefUrl(withdrawal.txIDs[0]));
      } else {
        nftcontractid = Number(selectedCollection);
        const withdrawal = await algotxn.contentcreatorwithdraw(
          algodClient,
          nftcontractid,
          activeAddress,
          signer
        );
        setTxnRef(withdrawal.txIDs[0]);
        setTxnUrl(getTxnRefUrl(withdrawal.txIDs[0]));
      }
    } catch (error) {
      alert("Unable to withdraw from this contract");
      console.log(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    contractName = e.target["name"].value;
  };

  return (
    <>
      <Head>
        <title>Algorand NFT Marketplace</title>

        <meta name="description" content="NFT Marketplace" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <main className={styles.main}>
        <div>
          <h1 className="text-5xl mb-4">Algorand NFT Marketplace</h1>
          <span className="mb-4">Network: {network}</span>
          <h4 className="mb-4">Application ID: {appID}</h4>
          <h4 className="mb-4">Application Address: {appAddress}</h4>
          <h4 className="mb-4">NFTs Listed: {nfts.length}</h4>
          <h4 className="mb-4">Platform fees: {platformFee}%</h4>
        </div>
        <div>
          {activeAddress && txnref && (
            <p className="mb-4 text-left">
              <a href={txnUrl} target="_blank" className="text-blue-500">
                Tx ID: {txnref}
              </a>
            </p>
          )}
        </div>

        {
          <Button
            label="Withdraw Earnings"
            type="submit"
            onClick={handleWithdrawEarnings}
          />
        }
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            id="name"
            className="w-full text-gray-700"
            placeholder="Enter collection name"
            required
          />
          <Button label="Confirm collection name" type="submit" />
        </form>
        <Button
          label="Deploy NFT Contract"
          type="submit"
          onClick={handleDeployContract}
        />
        {collections.size != 0 && (
          <select
            id="collection-select"
            value={selectedCollection}
            onChange={handleCollectionChange}
            className="border rounded py-1 px-2"
            suppressHydrationWarning={true}
          >
            <option value="" suppressHydrationWarning={true}>
              All Collections
            </option>
            {[...collections.entries()].map(([key, value]) => (
              <option key={key} value={value} suppressHydrationWarning={true}>
                {key.replace("contracts", "")}
              </option>
            ))}
          </select>
        )}

        {isSeller && <CreateNftForm onCreateNft={handleCreateNft} />}
        <h1 className="text-3xl mb-4" align="center">
          Items
        </h1>
        <h4 className="mb-4">Collection ID: {selectedCollection}</h4>

        <NftList nfts={nfts} onBuyNft={handleBuyNft} />
      </main>
    </>
  );
}
