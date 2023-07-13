import { useWallet } from "@txnlab/use-wallet";
import { useState } from "react";
import { getAlgodClient } from "../clients";
import Button from "./Button";

const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";

export default function CreateNftForm({ onCreateNft }) {
  const { activeAddress, signer } = useWallet();
  const [assetFile, setAssetFile] = useState(null);
  const [txnref, setTxnRef] = useState("");
  const [txnUrl, setTxnUrl] = useState("");

  const getTxnRefUrl = (txId) => {
    if (network === "SandNet") {
      return `https://app.dappflow.org/explorer/transaction/${txId}`;
    } else if (network === "TestNet") {
      return `https://testnet.algoexplorer.io/tx/${txId}`;
    }

    return "";
  };

  const handleFileChange = async (e) => {
    try{
    console.log("file: ", e.target.files);
    console.log("file[0]: ", e.target.files[0]);
    console.log("file[0].name: ", e.target.files[0].name);
    console.log("file[0].type: ", e.target.files[0].type);
    const fileObject = {
      data: e.target.files[0],
      name: e.target.files[0].name,
      type: e.target.files[0].type,
    };
    setAssetFile(e.target.files[0]);
  }catch(error){
    alert("Invalid file format.")
  }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const assetName = e.target["asset-name"].value;
    const desc = e.target["description"].value;
    const numNfts = e.target["num-Nfts"].value;
    const sellingPrice = e.target["selling-price"].value;
    const properties = e.target["properties"].value;
    const propertiesObject = JSON.parse(properties);

    onCreateNft(
      assetName,
      desc,
      assetFile,
      numNfts,
      sellingPrice,
      signer,
      activeAddress,
      propertiesObject,
    );
  };

  return (
    <div className="w-full">
      <h2 className="text-3xl mb-4"> Create NFT</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4 w-full">
          <label
            className="block text-white-700 text-sm font-bold mb-2"
            htmlFor="asset-name"
          >
            NFT Name:
          </label>
          <input
            type="text"
            id="asset-name"
            className="w-full text-gray-700"
            required
          />
        </div>
        <div className="mb-4">
          <label
            className="block text-white-700 text-sm font-bold mb-2"
            htmlFor="description"
          >
            Description:
          </label>
          <textarea
            id="description"
            className="w-full text-gray-700"
            required
          ></textarea>
        </div>
        <div className="mb-4">
          <label
            className="block text-white-700 text-sm font-bold mb-2"
            htmlFor="description"
          >
            Properties:
          </label>
          <textarea
            id="properties"
            className="w-full text-gray-700"
            defaultValue='{
              "trait_type":"trait"
            }'
            required
          ></textarea>
        </div>
        <div className="mb-4">
          <label
            className="block text-gray text-sm font-bold mb-2"
            htmlFor="description"
          >
            Number of NFTs:
          </label>
          <input
            type="number"
            id="num-Nfts"
            className="w-full text-gray-700"
            min="1"
            required
          />
        </div>
        <div className="mb-4">
          <label
            className="block text-white-700 text-sm font-bold mb-2"
            htmlFor="description"
          >
            NFT selling price (in Algos):
          </label>
          <input
            type="number"
            id="selling-price"
            className="w-full text-gray-700"
            min="1"
            required
          />
        </div>
        <div className="mb-4">
          <label
            className="block text-white-700 text-sm font-bold mb-2"
            htmlFor="description"
          >
            Upload file:
          </label>
          <input
            type="file"
            id="file-upload"
            accept=""
            onChange={handleFileChange}
            required
          />
        </div>
        <Button label="Create Nft" type="submit" />
      </form>
    </div>
  );
}
