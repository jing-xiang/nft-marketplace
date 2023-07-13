from beaker import *
from pyteal import *

# Platform deployer contract
class creatorState:
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

    platformFee = GlobalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("platformFee"),
        default=Int(0),
        descr="platform"
    )

    contracts = ReservedGlobalStateValue(
        stack_type=TealType.uint64,
        max_keys= 10,
        descr="key: name of collection, value: NFT contract ID"
    )
    


app = Application("creator", state=creatorState())

@app.create()
def create(fee: abi.Uint64):
    return Seq(
    app.initialize_global_state(),
    app.state.owner.set(Txn.sender()),  # set creator as global state
    app.state.platformFee.set(fee.get()) # Set platformFee
    )

@Subroutine(TealType.uint64)
def basic_checks():
    return And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address(),
    )

@app.external(authorize=Authorize.only(Global.creator_address()))
def transferEarnings(amount: abi.Uint64, *, output: abi.String):
    #Transfer algos from contract account to deployer,
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


@app.external
def update_contracts(name: abi.String, contract_id: abi.Uint64, *, output: abi.String):
    return Seq (
    app.state.contracts[name.get()].set((contract_id.get())),
    output.set("Contracts added!"),
    )

APP_NAME = "creator"

if __name__ == "__main__":
    app.build().export(f"assets/artifacts/{APP_NAME}")
