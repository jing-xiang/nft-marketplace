import Head from "next/head";
import styles from "@/styles/Home.module.css";
import Navbar from "@/components/Navbar";
import SendFromVaultForm from "@/components/SendFromVaultForm";
import SendToVaultForm from "@/components/SendtoVaultForm";
import { useEffect, useState } from "react";
import { getAlgodClient } from "../clients";
import { useWallet } from "@txnlab/use-wallet";
import algosdk, { decodeUint64, getMethodByName } from "algosdk";
import common from "mocha/lib/interfaces/common";
import * as algotxn from "@/algorand";
import ASA from "@/components/ASA";

const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
const algodClient = getAlgodClient(network);
const creator = algosdk.mnemonicToSecretKey(
  process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
);

// get app ID
const appID = parseInt(process.env.NEXT_PUBLIC_APP_ID);
console.log("App ID is: ", appID);
const appAddress = algosdk.getApplicationAddress(appID);
console.log(appAddress);

const suggestedParams = await algodClient.getTransactionParams().do();

export default function Home() {
  const [vaultAssets, setVaultAssets] = useState([]);
  const [vaultAlgos, setVaultAlgos] = useState(0);
  const [txnref, setTxnRef] = useState("");
  const [txnUrl, setTxnUrl] = useState("");
  const {
    activeAddress,
    activeAccount,
    signTransactions,
    sendTransactions,
    signer,
  } = useWallet();

  const commonParams = {
    appID,
    sender: activeAddress,
    suggestedParams,
    signer: signer,
  };

  useEffect(() => {
    // fetch vault contract details here
    const loadVaultAssets = async () => {
      //code to load vault assets
      const assetlist = await algotxn.fetchASA(algodClient);
      setVaultAssets(assetlist);
    };
    loadVaultAssets();

    const loadVaultAlgos = async () => {
      //code to load vault algos
      await algotxn.optIntoApp(creator, appID);
      const algo_balance = await algotxn.readLocalState(creator.addr, appID);
      setVaultAlgos(algo_balance.get("microAlgoBalance"));
    };
    loadVaultAlgos();
  }, [activeAddress]);

  const getTxnRefUrl = (txId) => {
    if (network === "SandNet") {
      return `https://app.dappflow.org/explorer/transaction/${txId}`;
    } else if (network === "TestNet") {
      return `https://testnet.algoexplorer.io/tx/${txId}`;
    }

    return "";
  };

  const handleSendFromVault = async (assetId, receiver, closeOutAsset) => {
    // add logic to send asset from the vault
    console.log(assetId, receiver, closeOutAsset);
    // payment 1 txn
    const appAddress = algosdk.getApplicationAddress(appID);
    console.log(receiver);

    try {
      //opt into asset
      const optInASATxn =
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: receiver,
          to: receiver,
          suggestedParams,
          assetIndex: assetId,
          amount: 0,
        });

      //sign and submit transaction for ASA opt in
      const payload = [optInASATxn];
      const groupedTxn = algosdk.assignGroupID(payload);
      const encodedTxns = groupedTxn.map((txn) =>
        algosdk.encodeUnsignedTransaction(txn)
      );
      const signed = await signTransactions(encodedTxns);
      const res = await sendTransactions(signed, 4);
      console.log(res);

      //transfer ASA and closeout
      if (closeOutAsset) {
        const txn2 = [
          {
            method: algotxn.getMethod("sendasatobuyercloseout"),
            ...commonParams,
            appForeignAssets: [assetId],
            appAccounts: [receiver],
          },
        ];
        await algotxn.makeATCCall(txn2);
      }

      // transfer ASA without closeout
      else {
        const txn3 = [
          {
            method: algotxn.getMethod("sendasatobuyer"),
            ...commonParams,
            appForeignAssets: [assetId],
            appAccounts: [receiver],
          },
        ];
        await algotxn.makeATCCall(txn3);
      }

      //display txn id and url
      setTxnRef(res.txId);
      setTxnUrl(getTxnRefUrl(res.txId));

      //update local states
      const txn4 = [
        {
          method: algotxn.getMethod("update_withdraw_algos"),
          ...commonParams,
          methodArgs: [100000],
        },
      ];

      await algotxn.makeATCCall(txn4);

      const txn5 = [
        {
          method: algotxn.getMethod("withdraw_asa"),
          ...commonParams,
          methodArgs: [1],
        },
      ];

      await algotxn.makeATCCall(txn5);

      console.log(algotxn.readLocalState(creator.addr, appID));

      console.log(
        await algodClient.accountAssetInformation(appAddress, assetId)
      );

      //refresh
      if (res) {
        setVaultAssets(() => {
          return vaultAssets.filter(
            (vaultAssets) => vaultAssets.asset["asset-id"] == vaultAssets
          );
        });
      }
      await algotxn.fundAccount(creator, appAddress, 1e5);
    } catch (error) {
      console.error("Restricted");
    }
  };

  const handleSendToVault = async (assetId) => {
    // add logic to send asset to the vault

    console.log(appAddress);
    try {
      //opt into asset
      const txn1 = [
        {
          method: algotxn.getMethod("optintoasset"),
          ...commonParams,
          appForeignAssets: [assetId],
        },
      ];

      await algotxn.makeATCCall(txn1);

      // transfer ASA
      let nfttxn = [
        await algotxn.createAssetTransferTxn(
          algodClient,
          activeAddress,
          appAddress,
          parseInt(assetId),
          1
        ),
      ];
      console.log(nfttxn);
      const groupedTxn = algosdk.assignGroupID(nfttxn);

      // Sign
      const encodedTxns = groupedTxn.map((txn) =>
        algosdk.encodeUnsignedTransaction(txn)
      );
      const signedtxns = await signTransactions(encodedTxns);
      const res = await sendTransactions(signedtxns, 4);

      // print ASA info
      console.log(
        algodClient.accountAssetInformation(appAddress, assetId).do()
      );
      console.log(assetId);
      //display txn id and url
      setTxnRef(res.txId);
      setTxnUrl(getTxnRefUrl(res.txId));
      //update local state
      algotxn.optIntoApp(creator, appID);
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
      algotxn.fundAccount(creator, appAddress, 1e5);

      //refresh
      if (res) {
        setVaultAssets(() => {
          return vaultAssets.filter(
            (vaultAssets) => vaultAssets.asset["asset-id"] === vaultAssets
          );
        });
      }
    } catch (error) {
      console.error("asset not found");
      alert("Asset unavailable or invalid wallet");
    }
  };

  return (
    <>
      <Head>
        <title>VaultApp</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <main className={styles.main}>
        <div>
          <h1 className="text-5xl mb-4">Vault Dapp</h1>
          <h4 className="mb-4">Network: {network}</h4>
          <h4 className="mb-4">Application ID: {appID}</h4>
          <h4 className="mb-4">No. of vault assets: {vaultAssets.length}</h4>
          <h4 className="mb-4">Vault microAlgos: {vaultAlgos}</h4>
        </div>
        <div>
          {activeAddress && txnref && (
            <p className="mb-4 text-left">
              <a href={txnUrl} target="_blank" className="text-blue-500">
                Tx ID: {txnref}
              </a>
            </p>
          )}
          {activeAddress &&
            vaultAssets.map((item, index) => (
              <ASA
                key={index}
                src={item.imgUrl}
                metadata={item.metadata}
                assetId={item.asset["asset-id"]}
              />
            ))}
        </div>
        <SendFromVaultForm
          assets={vaultAssets}
          onSendFromVault={handleSendFromVault}
        />
        <SendToVaultForm onSendToVault={handleSendToVault} />
      </main>
    </>
  );
}
