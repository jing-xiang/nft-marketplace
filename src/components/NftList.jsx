import NftItem from "./NftItem";
import { useState } from "react";
import { getAlgodClient } from "../clients";
import { useWallet } from "@txnlab/use-wallet";
import algosdk, { signTransaction } from "algosdk";
import { createAssetTransferTxn, getAssetOptInTxn, optIntoAsset, buyNft } from "@/algorand";

const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
const algodClient = getAlgodClient(network);
const appID = parseInt(process.env.NEXT_PUBLIC_APP_ID);

function NftList({ nfts, onBuyNft }) {
  const [txnref, setTxnRef] = useState("");
  const [txnUrl, setTxnUrl] = useState("");
  const { activeAddress, signTransactions, sendTransactions, signer } = useWallet();

  const getTxnRefUrl = (txId) => {
    if (network === "SandNet") {
      return `https://app.dappflow.org/explorer/transaction/${txId}`;
    } else if (network === "TestNet") {
      return `https://testnet.algoexplorer.io/tx/${txId}`;
    }

    return "";
  }


  return (
    <div className="w-full">
      {activeAddress && txnref && (
        <p className="mb-4 text-left">
          <a href={txnUrl} target="_blank" className="text-blue-500">
            Tx ID: {txnref}
          </a>
        </p>
      )}
      {activeAddress && nfts.map((item, index) => (
        <NftItem
          key={index}
          src={item.imgUrl}
          metadata={item.metadata}
          assetId={item.asset["asset-id"]}
          onButtonClick={() =>
            onBuyNft(
              item.asset["asset-id"],
              signer,
              JSON.stringify(item.metadata, null, 2)
            )
          }
        />
      ))}
    </div>
  );
}

export default NftList;
