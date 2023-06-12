from beaker import *
from pyteal import *

class VaultAppState:
    """
    Global States
    """
    #owner address
    owner = GlobalStateValue(
        stack_type=TealType.bytes,
        key=Bytes("OwnerAddress"),
        default=Bytes(""),
        descr="Vault owner's address",
    )

    """
    Local States
    """
    #asa balance
    asa_balance = LocalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("AssetBalances"),
        default=Int(0),
        descr="Vault asset balances",
    )
    #algo balance
    algo_balance = LocalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("microAlgoBalance"),
        default=Int(1100000),
        descr="Vault microAlgo balance",
    )

app = Application("nft-marketplace", state=VaultAppState())

@app.external
def update_global(*,output: abi.String):
    Assert(Txn.sender() == Global.creator_address())
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()), 
    return Seq(
        Assert(Txn.sender() == app.state.owner.get()), 
        app.state.owner.set(Txn.accounts[1]),
        output.set("Updated global state!"),
    )


@app.external
def update_local(li: abi.Uint64, *, output: abi.String):
    Assert(Txn.sender() == app.state.owner),
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    return Seq(
        app.state.algo_balance.set(li.get()),
        output.set("Updated local state!"),
    )

@app.create(bare=True)
def create():
    on_create = Seq([
        app.initialize_global_state(),
        app.state.owner.set(Txn.sender()),
    ])
    return on_create

@app.close_out(bare=True, authorize=Authorize.only(Global.creator_address()))
def close_out():
    Assert(Txn.sender() == Global.creator_address())
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    on_close = Seq([
        Assert(app.state.owner.get() == Txn.sender()),  # Only owner can close out the vault
        Approve()
    ])
    return on_close

@app.opt_in(bare=True)
def opt_in():
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    return app.initialize_local_state()

@app.external
def deposit_asa(amount: abi.Uint64, *,output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    deposit = Seq([
        Assert(Txn.sender() == app.state.owner.get()),  # Only owner can deposit ASAs
        app.state.asa_balance.set(app.state.asa_balance.get() + amount.get()),
        output.set("Updated asa value")
    ])
    return deposit

@app.external
def withdraw_asa(amount: abi.Uint64, *,output: abi.String):
    withdraw = Seq([
        Assert(Txn.rekey_to() == Global.zero_address()),
        Assert(Txn.close_remainder_to() == Global.zero_address()),
        Assert(Txn.asset_close_to() == Global.zero_address()),
        Assert(Txn.sender() == app.state.owner.get()),  # Only owner can withdraw ASAs
        Assert(app.state.asa_balance.get() >= amount.get()),  # Check if there are enough ASAs in the vault
        app.state.asa_balance.set(app.state.asa_balance.get() - amount.get()),
        output.set("updated asa value")
    ])
    return withdraw

@app.external
def update_deposit_algos(amount: abi.Uint64, *, output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    deposit = Seq([
        Assert(Txn.sender() == app.state.owner.get()),  # Only owner can deposit Algos
        app.state.algo_balance.set(app.state.algo_balance.get() + amount.get()),
        output.set("updated algos value")
    ])
    return deposit

@app.external
def update_withdraw_algos(amount: abi.Uint64, *,output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    withdraw = Seq([
        Assert(Txn.sender() == app.state.owner.get()),  # Only owner can withdraw Algos
        Assert(app.state.algo_balance.get() >= amount.get()),  # Check if there are enough Algos in the vault
        app.state.algo_balance.set(app.state.algo_balance.get() - amount.get()),
        output.set("updated algos value")
    ])
    return withdraw

@app.external
def transferasafromvault(*, output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    close = Seq([
        Assert(Txn.sender() == app.state.owner.get()),  # Only owner can close out ASAs
        Assert(app.state.asa_balance.get() > Int(0)),  # Check if there are ASAs in the vault
    ])
    
    on_close = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # ASA index
                TxnField.asset_receiver: Global.creator_address(),
                TxnField.asset_amount: Int(1),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Transferred ASA!")
    ])
    
    return Seq([close, on_close])

@app.external
def transferasafromvaultwithoutclose(*, output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    close = Seq([
        Assert(Txn.sender() == Global.current_application_address()),  # Only owner can close out ASAs
        Assert(app.state.asa_balance.get() > Int(0)),  # Check if there are ASAs in the vault
    ])
    
    on_close = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # ASA index
                TxnField.asset_receiver: Global.creator_address(),
                TxnField.asset_amount: Int(1),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Transferred ASA!")
    ])
    
    return Seq([close, on_close])

@app.external
def depositasatovault(*, output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    close = Seq([
        Assert(Txn.sender() == Global.creator_address()),  
    ])
    
    on_close = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # ASA index
                TxnField.asset_sender: Global.creator_address(),
                TxnField.asset_receiver: Global.current_application_address(),
                TxnField.asset_amount: Int(1),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Transferred ASA!")
    ])
    
    return Seq([close, on_close])

@app.external
def optintoasset(*, output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    close = Seq([
        Assert(Txn.sender() == app.state.owner.get()),  
    ])
    
    on_close = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # ASA index
                TxnField.asset_receiver: Global.current_application_address(),
                TxnField.asset_amount: Int(0),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("ASA Opted in!")
    ])
    
    return Seq([close, on_close])

@app.external
def sendasatobuyer(*, output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    return Seq(
        Assert(Txn.sender() == app.state.owner.get()),
        # Transfer Asset
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # first foreign asset
                TxnField.asset_receiver: Txn.accounts[1],
                TxnField.asset_amount: Int(1),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Transferred!"),
    )

@app.external
def sendasatobuyercloseout(*, output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    return Seq(
        Assert(Txn.sender() == app.state.owner.get()),
        # Transfer Asset
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # first foreign asset
                TxnField.asset_receiver: Txn.accounts[1],
                TxnField.asset_close_to: Txn.accounts[1],
                TxnField.asset_amount: Int(1),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Transferred!"),
    )

@app.external
def depositalgos(amount: abi.Uint64, *, output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    return Seq(
        Assert(Txn.sender() == Global.creator_address()),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.receiver: Txn.accounts[0],
                TxnField.asset_amount: amount.get(),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Algos transferred")
    )

@app.external
def receivealgos(amount: abi.Uint64, *,output: abi.String):
    Assert(Txn.rekey_to() == Global.zero_address()),
    Assert(Txn.close_remainder_to() == Global.zero_address()),
    Assert(Txn.asset_close_to() == Global.zero_address()),
    Assert(Txn.sender() == Txn.accounts[0])
    return Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.receiver: Global.creator_address(),
                TxnField.amount: amount.get(),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Algos transferred")
    )



APP_NAME = "nft-marketplace"

if __name__ == "__main__":
    app.build().export(f"assets/artifacts/{APP_NAME}")
