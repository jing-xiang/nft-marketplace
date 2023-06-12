import { getAlgodClient } from "../clients";
import Button from "./Button";

const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
const algod = getAlgodClient(network);

export default function SendToVaultForm({ onSendToVault }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    onSendToVault(Number(e.target[0].value));
  };

  return (
    <div className="w-full mt-6">
      <h2 className="text-3xl mb-4">Send to Vault</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="to"
          >
            Asset ID
          </label>
          <input
            className="w-full block text-gray-700 text-sm font-bold mb-2"
            name="assetId"
            type="text"
            placeholder="Enter asset ID"
          />
        </div>
        <Button label="Send to Vault" type="submit" />
      </form>
    </div>
    
  );
}
