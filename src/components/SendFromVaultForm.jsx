import algosdk from "algosdk";
import { useWallet } from "@txnlab/use-wallet";
import { useState } from "react";
import { getAlgodClient } from "../clients";
import Button from "./Button";
import * as algotxn from "@/algorand";

const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
const algod = getAlgodClient(network);

export default function SendFromVaultForm({ assets, onSendFromVault }) {
  const [receiver, setReceiver] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [closeOutAsset, setCloseOutAsset] = useState(false);
  //console.log(assets);

  const handleDropdownChange = (event) => {
    setSelectedAsset(event.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    onSendFromVault(Number(selectedAsset), receiver, closeOutAsset);
  };

  return (
    <div className="w-full mt-6">
      <h2 className="text-3xl mb-4">Send from Vault</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4 w-full">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="to"
          >
            Select Asset
          </label>
          <select value={selectedAsset} onChange={handleDropdownChange} className="block text-gray-700 text-sm font-bold mb-2">
            <option value="" >Asset ID</option>
            {assets.map((n, index) => (
              <option key={index} value={n.asset["asset-id"]}>
                {`${n.asset["asset-id"]} - ${n.metadata["name"]}`}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="to"
          >
            To
          </label>
          <input
            className="w-full text-gray-700 text-sm font-bold mb-2"
            name="to"
            onChange={(e) => setReceiver(e.target.value)}
            value={receiver}
            type="text"
            placeholder="Recipient Address"
          />
        </div>
        <div className="mb-4">
          <label className="flex items-center" >
            <input
              type="checkbox"
              name="checkbox1"
              checked={closeOutAsset}
              onChange={() => {
                setCloseOutAsset(!closeOutAsset);
              }}
              className="form-checkbox mr-2 h-5 w-5"
            />
            Close out this asset
          </label>
        </div>
        <Button label="Send Asset" type="submit" />
      </form>
    </div>
  );
}
