# NFT Marketplace

## Overview
Based on the ARC69 fundamentals assessment, you are now required to build a Dapp that allows content creators to create and sell their ARC69 NFTs in it.

## Application Details

### Platform Contract

#### Core Features
1. Allows platform owner to withdraw earnings made from content creators.
2. Decide a percentage cut from the sale proceeds of each NFT.

### NFT Contract

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

Write test cases to demostrate the successful flow and negative tests to demostrate if the necesssary checks are in place.

## Deployment

Include documentation on how to deploy the smart contracts and how to set up the application frontend locally.

## Assesment Criteria

[https://docs.google.com/document/d/1Kpb3Bid3JXKFGh_SwP8iVPpry2T-t8j5BBqLAP87FeE/edit?usp=sharing](https://docs.google.com/document/d/1Kpb3Bid3JXKFGh_SwP8iVPpry2T-t8j5BBqLAP87FeE/edit?usp=sharing)
