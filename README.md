[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-718a45dd9cf7e7f842a935f5ebbe5719a5e09af4491e668f4dbf3b35d5cca122.svg)](https://classroom.github.com/online_ide?assignment_repo_id=11324641&assignment_repo_type=AssignmentRepo)

# NFT Marketplace

## Overview

Based on the ARC69 fundamentals assessment, you are now required to build a Dapp that allows content creators to create and sell their ARC69 NFTs in it.

## Application Details

### Platform Contract

creator.py

1. transferEarnings
   App call to transfer Algos from the platform contract to platform deployer address.
2. update_contracts
   App call to store the name of collection and the deployed NFT contract application index into the platform's contract reserved global state.

#### Core Features

1. Allows platform owner to withdraw earnings made from content creators.
2. Decide a percentage cut from the sale proceeds of each NFT.

### NFT Contract

nft-marketplace.py

1. create_nft
   Asset config app call to create NFT on NFT contract based on user input fields.
2. purchase_nft
   App call grouped to transfer percentage cut from NFT contract and transfer NFT asset to buyer.
3. transferEarnings
   App call to transfer Algos from NFT contract to NFT contract owner address.

#### Core Features

1. Content creator will deploy the NFT contract to manage their NFTs.
2. Mint ARC69 NFTs via the NFT contract. These are the required fields for the NFTs.

- Image content
- JSON Metadata. This includes customisable NFT properties in key/value pairs.
- Description
- Unit name
- Selling price in Algos

3. Allow content creator to withdraw earnings from this contract.
4. Allow buyers to purchase NFTs via this contract. The following transactions needs to happen,

- Opt In transaction to the NFT
- Payment transaction to cover the minimum balance requirement (MBR) incurred by the NFT contract
- Payment transaction to the NFT contract
- Payment transaction to the platform contract based on the percentage cut
- Inner transaction to transfer NFT to the buyer

#### Required Information

1. Platform contract address
2. Percentage cut per NFT

### Application Frontend

These are the required functionalities for the Dapp

1. Allow content creator to deploy 1 NFT contract.
2. Allow content creator to create NFTs in the contract.
3. Allow users to view NFTs created on this platform. You can choose to store deployed NFT contracts on a database or on the platform contract to retrieve the list of NFTs.
4. Allow users to purchase NFTs created on this platform.

## Testing

## Run tests

Run `yarn test``

## Deployment

### 1. Install Python Packages

Run `algokit bootstrap poetry`

### 2. Install NPM Packages

Run `yarn install`

### 3. Run virtual env

Run `poetry shell`

### 4. Update environment variables

1. Copy `.env.example` to `.env.local`.
2. Update credentials in `.env.local` file.

### 4. Compile Contracts

1. Run `python assets/creator.py`
2. Run `python assets/nft-marketplace.py`

### 5. Deploy

Run `yarn run tsx scripts/deploy.js`

### 6. Update platform contract

Update APP ID and APP ADDRESS in .env.local file.

### 7. Run the Dapp

Run `yarn dev`

## Usage

1. Enter desired NFT collection name
2. Click on `Confirm collection name`
3. CLick on `Deploy NFT Contract`. If the name is unique, contract will be deployed.
4. Ensure owner wallet is connected. Select the collection name and enter required fields to create NFTs under the contract. Upload file to mint the chosen asset.
5. Created NFTs are displayed under `Items`. Buyers can buy these NFTs by clicking on `Buy NFT`.
6. `Withdraw earnings` will transfer earnings to your own address.

## Assesment Criteria

[https://docs.google.com/document/d/1Kpb3Bid3JXKFGh_SwP8iVPpry2T-t8j5BBqLAP87FeE/edit?usp=sharing](https://docs.google.com/document/d/1Kpb3Bid3JXKFGh_SwP8iVPpry2T-t8j5BBqLAP87FeE/edit?usp=sharing)
