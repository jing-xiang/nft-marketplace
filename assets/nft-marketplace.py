from beaker import *
from pyteal import *

# NFT contract
class NFTMarketplaceState:
    """
    Global States
    """
    #owner address
    owner = GlobalStateValue(
        stack_type=TealType.bytes,
        key=Bytes("OwnerAddress"),
        default=Bytes(""),
        descr="Platform owner's address",
    )

    priceDict1 = ReservedGlobalStateValue(
        stack_type=TealType.uint64,
        max_keys = 31,
        descr="key: assetID, value: price"
    )
    
    artistDict = ReservedGlobalStateValue(
        stack_type=TealType.bytes,
        max_keys = 31,
        descr="key: assetID, value: artistAddress"
    ) 
    platformFee = GlobalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("platformFee"),
        default=Int(0),
        descr="platform fees"
    )


app = Application("nft-marketplace", state=NFTMarketplaceState())

@Subroutine(TealType.uint64)
def get_price(assetID):
    return app.state.priceDict1[Itob(assetID)].get()

@app.create()
def create(fee: abi.Uint64):
    return Seq(
    app.initialize_global_state(),
    app.state.owner.set(Txn.sender()),  # set initial admin
    app.state.platformFee.set(fee.get()) # Set platformFee
    )


@Subroutine(TealType.none)
def set_reserved_price_state(assetID, price):
    return Seq(
    app.state.priceDict1[Itob(assetID)].set(price),
    Return()
    )

@Subroutine(TealType.none)
def set_reserved_artist_state(assetID,artistAddress):
    return Seq (
    app.state.artistDict[Itob(assetID)].set(artistAddress),
    Return()
    )

@Subroutine(TealType.uint64)
def basic_checks():
    return And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address(),
    )

@app.external
def create_nft(
    assetName: abi.String,
    assetURL: abi.String,
    numNFTs: abi.Uint64,
    sellingPrice: abi.Uint64,
    activeAddress: abi.String,
    metadataEncoded: abi.String,
    *,
    output: abi.Uint64
    ):
    return Seq(
        Assert(basic_checks()),
        Assert(Gtxn[0].type_enum() == TxnType.Payment),
        Assert(Txn.sender() == Global.creator_address()),
        Assert(numNFTs.get() > Int(0)),
        Assert(sellingPrice.get() > Int(0)),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetConfig,
                TxnField.config_asset_default_frozen: Int(0),
                TxnField.config_asset_url: assetURL.get(),
                TxnField.config_asset_name: assetName.get(),
                TxnField.config_asset_unit_name: Bytes("arc69"),
                TxnField.config_asset_total: numNFTs.get(), # Artist can choose how many copies of NFT to create
                TxnField.config_asset_decimals: Int(0),
                TxnField.note: metadataEncoded.get(),
                TxnField.fee: Int(0),
            }
        ),
        InnerTxnBuilder.Submit(),
        set_reserved_price_state(InnerTxn.created_asset_id(),sellingPrice.get()), # Add assetID (key) and price (value) to priceDict1
        set_reserved_artist_state(InnerTxn.created_asset_id(),activeAddress.get()), # Add assetID (key) and artistAddress (value) to artistDict
        output.set(InnerTxn.created_asset_id())
    )

@app.external
def purchase_nft(assetID: abi.Uint64, feeAmount:abi.Uint64, fee: abi.Uint64, *, output:abi.String):
    contractassetbalance = AssetHolding.balance(Global.current_application_address(), Txn.assets[0])
    receiverassetbalance = AssetHolding.balance(Txn.sender(), Txn.assets[0])
    deployerfee = App.globalGetEx(Txn.applications[1], Bytes("platformFee"))
    return Seq(
        Assert(basic_checks()),
        deployerfee,
        Assert(deployerfee.value() == fee.get()),
        contractassetbalance,
        Assert(contractassetbalance.value() >= Int(1)),
        receiverassetbalance,
        Assert(receiverassetbalance.hasValue()),
        Assert(Balance(Gtxn[0].sender()) >= get_price(assetID.get())), # Check if buyer has enough algos to buy NFT 
        Assert(Gtxn[0].type_enum() == TxnType.Payment),  #check txntype
        Assert(Txn.assets[0] == assetID.get()),

        #Transfer platform fees algos from NFT contract to creator contract
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.amount: feeAmount.get(),  # fee amount to be paid to master contract
                TxnField.receiver: Txn.accounts[1],
                TxnField.fee: Int(0),
                
            }
        ),
        InnerTxnBuilder.Submit(),

        #Transfer NFT from contract account to buyer

        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # saved assetID to assets array when calling this function
                TxnField.asset_receiver: Txn.sender(), # sender is the buyer who called this function
                TxnField.asset_amount: Int(1),
                TxnField.fee: Int(0),
                
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Transferred!"),
    )

@app.external(authorize=Authorize.only(Global.creator_address()))
def transferEarnings(amount: abi.Uint64, *, output: abi.String):
    #Transfer algos from contract account to content creator
    return Seq(
        Assert(basic_checks()),
        Assert(amount.get() > Int(0)), # cannot withdraw if amount to transfer is 0
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.amount: amount.get(),  # algos to transfer
                TxnField.receiver: app.state.owner.get(),
                TxnField.fee: Int(0),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Earnings transferred!"),
    )

APP_NAME = "nft-marketplace"

if __name__ == "__main__":
    app.build().export(f"assets/artifacts/{APP_NAME}")
