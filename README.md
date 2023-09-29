---
title: Training dapp n°2
tags: Training
description: Training n°2 for decentralized application
---

## :round_pushpin: [See Github version and full code here](https://github.com/marigold-dev/training-dapp-2)

# Training dapp n°2

# :point_up: Poke game (enhanced)

Previously, you learned how to create your first dapp.
In this second session, you will enhance your skills on :

- inter-contract calls
- views
- unit & mutation tests

On the first version of the poke game, you were able to poke any deployed contract. Now, you will be able to receive a secret additional feedback if you ask the contract to poke another contract.

## new Poke sequence diagram

```mermaid
sequenceDiagram
  Note left of User: Prepare poke on P and get feedback
  User->>SM: poke another contract P
  SM->>SM_P : poke and get feedback
  SM_P->>SM : send feedback
  Note left of SM: store feedback from P
```

# :memo: Prerequisites

There is nothing more than you needed on first session : https://github.com/marigold-dev/training-dapp-1#memo-prerequisites

# :scroll: Smart contract

## Step 1 : Reuse the project from previous session

Start from previous project solution here and clone it : https://github.com/marigold-dev/training-dapp-1/blob/main/solution

```bash
git clone https://github.com/marigold-dev/training-dapp-1.git
```

We will reuse the previous smart contract : https://github.com/marigold-dev/training-dapp-1/blob/main/solution/contracts/pokeGame.jsligo

Fetch all libraries to get ready :

```bash
cd solution && npm i && cd app && yarn install && cd ..
```

This time we will be able to poke a contract directly, or poke contract though another contract. In last case, we will store an additional feedback data from this contract.

Change the storage to reflect the changes :

- if you poke directly, you just register the contract's owner address and no feedback
- if you poke and ask to get feedback from another contract, then you register and additional feedback

Edit `./contracts/pokeGame.jsligo` and replace storage definition by this one :

```ligolang
export type pokeMessage = {
    receiver : address,
    feedback : string
};

export type storage = {
    pokeTraces : map<address, pokeMessage>,
    feedback : string
};
```

Replace your poke function with theses lines :

```ligolang
@entry
const poke = (_ : unit, store : storage) : return_ => {
    let feedbackMessage = {receiver : Tezos.get_self_address() ,feedback: ""};
    return [  list([]) as list<operation>, {...store,
        pokeTraces : Map.add(Tezos.get_source(), feedbackMessage, store.pokeTraces) }];
};
```

Explanation :

- `...store` do a copy by value of your object. [Have a look on the Functional updates documentation](https://ligolang.org/docs/language-basics/maps-records/#functional-updates). Note : you cannot do assignment like this `store.pokeTraces=...` in jsLigo, there are no concept of Classes, use `Functional updates` instead
- `Map.add(...` : Add a key, value entry to a map. For more information about [Map](https://ligolang.org/docs/language-basics/maps-records/#maps)
- `export type storage = {...};` We declare a `Record`, it is an [object structure](https://ligolang.org/docs/language-basics/maps-records#records)
- `Tezos.get_self_address()` is a native function that returns the current contract address running this code. Have a look on [Tezos native functions](https://ligolang.org/docs/reference/current-reference)
- `feedback: ""` : poking directly will not store feedbacks

Edit `pokeGame.storageList.jsligo` to change the storage initialization (as we changed the definition)

```ligolang
#import "pokeGame.jsligo" "Contract"

const default_storage: Contract.storage = {
    pokeTraces: Map.empty as map<address, Contract.pokeMessage>,
    feedback: "kiss"
};
```

Compile your contract

```bash
TAQ_LIGO_IMAGE=ligolang/ligo:1.0.0 taq compile pokeGame.jsligo
```

We will write a second function `pokeAndGetFeedback` involving the call to another contract a bit later, let's do unit testing first !

## Step 2 : Write unit tests

We will test only the poke function for now

```mermaid
sequenceDiagram
  Note left of User: Prepare poke
  User->>SM: poke
  Note right of SM: store user and self contract address with no feedback
```

Add a new unit test smart-contract file `unit_pokeGame.jsligo`

```bash
taq create contract unit_pokeGame.jsligo
```

> :information_source: Testing documentation can be found [here](https://ligolang.org/docs/advanced/testing)
> :information_source: Test module with specific functions [here](https://ligolang.org/docs/reference/test)

Edit the file

```ligolang
#import "./pokeGame.jsligo" "PokeGame"

export type main_fn = module_contract<parameter_of PokeGame, PokeGame.storage>;

// reset state

const _ = Test.reset_state(2 as nat, list([]) as list<tez>);

const faucet = Test.nth_bootstrap_account(0);

const sender1: address = Test.nth_bootstrap_account(1);

const _2 = Test.log("Sender 1 has balance : ");

const _3 = Test.log(Test.get_balance_of_address(sender1));

const _4 = Test.set_baker(faucet);

const _5 = Test.set_source(faucet);

export const initial_storage = {
  pokeTraces: Map.empty as map<address, PokeGame.pokeMessage>,
  feedback: "kiss"
};

export const initial_tez = 0mutez;

//functions

export const _testPoke = (
  taddr: typed_address<parameter_of PokeGame, PokeGame.storage>,
  s: address
): unit => {
  const contr = Test.to_contract(taddr);
  const contrAddress = Tezos.address(contr);
  Test.log("contract deployed with values : ");
  Test.log(contr);
  Test.set_source(s);
  const status = Test.transfer_to_contract(contr, Poke(), 0 as tez);
  Test.log(status);
  const store: PokeGame.storage = Test.get_storage(taddr);
  Test.log(store);
  //check poke is registered

  match(Map.find_opt(s, store.pokeTraces)) {
    when (Some(pokeMessage)):
      do {
        assert_with_error(
          pokeMessage.feedback == "",
          "feedback " + pokeMessage.feedback + " is not equal to expected "
          + "(empty)"
        );
        assert_with_error(
          pokeMessage.receiver == contrAddress,
          "receiver is not equal"
        );
      }
    when (None()):
      assert_with_error(false, "don't find traces")
  };
};

// TESTS //

const testSender1Poke =
  (
    (): unit => {
      const orig =
        Test.originate(contract_of(PokeGame), initial_storage, initial_tez);
      _testPoke(orig.addr, sender1);
    }
  )();
```

Explanations :

- `#import "./pokeGame.jsligo" "PokeGame"` to import the source file as module in order to call functions and use object definitions
- `export type main_fn` it will be useful later for the mutation tests to point to the main function to call/mutate
- `Test.reset_state ( 2...` this creates two implicit accounts on the test environment
- `Test.nth_bootstrap_account` this return the nth account from the environment
- `Test.to_contract(taddr)` and `Tezos.address(contr)` are util functions to convert typed addresses, contract and contract addresses
- `let _testPoke = (s : address) : unit => {...}` declaring function starting with `_` will not be part of the test run results. Use this to factorize tests changing only the parameters of the function for different scenarios
- `Test.set_source` do not forget to set this value for the transaction signer
- `Test.transfer_to_contract(CONTRACT, PARAMS, TEZ_COST)` This is how we call a transaction
- `Test.get_storage` this is how to retrieve the contract's storage
- `assert_with_error(CONDITION,MESSAGE)` Use assertion for unit testing
- `const testSender1Poke = ...` This test function will be part of the execution run results
- `Test.originate_module(MODULE_CONVERTED_TO_CONTRACT,INIT_STORAGE, INIT_BALANCE)` will originate a smart contract into the environment. Here we specify that the module to convert to a smart contract

Run the test

```bash
TAQ_LIGO_IMAGE=ligolang/ligo:1.0.0 taq test unit_pokeGame.jsligo
```

Output should give you intermediary logs and finally the test results

```logs
┌──────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Contract             │ Test Results                                                                                                                                   │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ unit_pokeGame.jsligo │ "Sender 1 has balance : "                                                                                                                      │
│                      │ 3800000000000mutez                                                                                                                             │
│                      │ "contract deployed with values : "                                                                                                             │
│                      │ KT1KwMWUjU6jYyLCTWpZAtT634Vai7paUnRN(None)                                                                                                     │
│                      │ Success (2130n)                                                                                                                                │
│                      │ {feedback = "kiss" ; pokeTraces = [tz1TDZG4vFoA2xutZMYauUnS4HVucnAGQSpZ -> {feedback = "" ; receiver = KT1KwMWUjU6jYyLCTWpZAtT634Vai7paUnRN}]} │
│                      │ Everything at the top-level was executed.                                                                                                      │
│                      │ - testSender1Poke exited with value ().                                                                                                        │
│                      │                                                                                                                                                │
│                      │ 🎉 All tests passed 🎉                                                                                                                         │
└──────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Step 3 : do an inter contract call

```mermaid
sequenceDiagram
  Note left of User: Prepare poke on P and get feedback
  User->>SM: poke another contract P
  Note right of SM: PokeAndGetFeedback is called
  SM->>SM_P : get feedback
  Note right of SM_P: GetFeedback is called
  SM_P->>SM : send feedback
  Note left of SM: PokeAndGetFeedbackCallback is called
  Note left of SM: store feedback from P
```

To keep things simple, we are deploying 2 versions of the same smartcontract to simulate inter-contract call and get the feedback message (cf. [sequence diagram](#new-poke-sequence-diagram))

We will create a new poke function `PokeAndGetFeedback: (other : address)` with a second part function `PokeAndGetFeedbackCallback: (feedback : returned_feedback)` as a callback. Calling a contract is asynchronous, this is the reason we do this in two times.

The function to call on the second contract will be `GetFeedback: (contract_callback: oracle_param)` and will return a feedback message.

> Very often, this kind of contract is named an `Oracle`, because generally its storage is updated by an offchain scheduler and it exposes data to any onchain smart contracts.

Edit the file `pokeGame.jsligo`, to define new types :

```ligolang
type returned_feedback = [address, string]; //address that gives feedback and a string message

type oracle_param = contract<returned_feedback>;
```

Explanations :

- `type returned_feedback = [address, string]` the parameters of an oracle function always start with the address of the contract caller and followed by the return objects
- `type oracle_param = contract<returned_feedback>` the oracle parameters need to be wrapped inside a typed contract

We need to write the missing functions, starting with `getFeedback`

Add this new function at the end of the file

```ligolang
@entry
const getFeedback = (contract_callback : contract<returned_feedback>, store : storage): return_ => {
    let op : operation = Tezos.transaction(
            [Tezos.get_self_address(),store.feedback],
            (0 as mutez),
            contract_callback);
    return [list([op]) ,store];
};
```

- `Tezos.transaction(RETURNED_PARAMS,TEZ_COST,CALLBACK_CONTRACT)` the oracle function requires to return the value back to the contract caller that is passed already as first parameter
- `return [list([op]) ,store]` this time, you return a list of operations to execute, there is no need to update the contract storage (but it is a mandatory return object)

Add now, the first part of the function `pokeAndGetFeedback`

```ligolang
@entry
const pokeAndGetFeedback = (oracleAddress: address, store: storage): return_ => {
  //Prepares call to oracle

  let call_to_oracle = (): contract<oracle_param> => {
    return match(
      Tezos.get_entrypoint_opt("%getFeedback", oracleAddress) as
        option<contract<oracle_param>>
    ) {
      when (None()):
        failwith("NO_ORACLE_FOUND")
      when (Some(contract)):
        contract
    };
  };
  // Builds transaction

  let op: operation =
    Tezos.transaction(
      (
        (
          Tezos.self("%pokeAndGetFeedbackCallback") as
            contract<returned_feedback>
        )
      ),
      (0 as mutez),
      call_to_oracle()
    );
  return [list([op]), store];
};
```

- `Tezos.get_entrypoint_opt("%getFeedback",oracleAddress)` you require to get the oracle contract address. Then you want to call a specific entrypoint of this contract. The function name will be always starting with `%` with always the first letter in lowercase (even if the code is different)
- `Tezos.transaction(((Tezos.self("%pokeAndGetFeedbackCallback") as contract<returned_feedback>)),TEZ_COST,call_to_oracle())` The transaction takes as first param the entrypoint of for the callback that the oracle will use to answer the feedback, the tez cost and the oracle contract you got just above as transaction destination

Write the last missing function `pokeAndGetFeedbackCallback`, receive the feedback and finally store it

```ligolang
@entry
const pokeAndGetFeedbackCallback = (feedback : returned_feedback, store : storage) : return_ => {
    let feedbackMessage = {receiver : feedback[0] ,feedback: feedback[1]};
    return [  list([]) as list<operation>, {...store,
        pokeTraces : Map.add(Tezos.get_source(), feedbackMessage , store.pokeTraces) }];
};
```

- `let feedbackMessage = {receiver : feedback[0] ,feedback: feedback[1]}` prepares the trace including the feedback message and the feedback contract creator
- `{...store,pokeTraces : Map.add(Tezos.get_source(), feedbackMessage , store.pokeTraces) }` add the new trace to the global trace map

Compile the contract

> Note : Remove the file `pokeGame.parameterList.jsligo` to remove all unnecessary error logs as we don't need to maintain this file anymore

```bash
TAQ_LIGO_IMAGE=ligolang/ligo:1.0.0 taq compile pokeGame.jsligo
```

(Optional) Write a unit test for this new function `pokeAndGetFeedback`

## Step 4 : Use views instead of inter-contract call

As you saw on the previous step, inter-contract calls can complexify a lot the business logic but not only, thinking about the cost is even worst : https://ligolang.org/docs/tutorials/inter-contract-calls/inter-contract-calls#

In our case, the oracle is providing a read-only storage that can be replaced by a `view` instead of a complex and costy callback

> [See documentation here about onchain views](https://ligolang.org/docs/protocol/hangzhou#on-chain-views]

```mermaid
sequenceDiagram
  Note left of User: Prepare poke on P and get feedback
  User->>SM: poke another contract P
  Note right of SM: PokeAndGetFeedback is called
  SM-->>SM_P : feedback view read
  SM_P-->>SM : feedback
  Note left of SM: store feedback from P
```

:warning: **Comment below functions (with `/* */` syntax or // syntax) or jusr remove it, as we don't need it anymore** :warning:

- `pokeAndGetFeedbackCallback`
- `getFeedback`

Edit function `pokeAndGetFeedback` to call view instead of a transaction

```ligolang
@entry
const pokeAndGetFeedback = (oracleAddress: address, store: storage): return_ => {
  //Read the feedback view

  let feedbackOpt: option<string> =
    Tezos.call_view("feedback", unit, oracleAddress);
  match(feedbackOpt) {
    when (Some(feedback)):
      do {
        let feedbackMessage = { receiver: oracleAddress, feedback: feedback };
        return [
          list([]) as list<operation>,
          {
            ...store,
            pokeTraces: Map.add(
              Tezos.get_source(),
              feedbackMessage,
              store.pokeTraces
            )
          }
        ];
      }
    when (None()):
      failwith("Cannot find view feedback on given oracle address")
  };
};
```

Declare the view at the end of the file. Do not forget the annotation `@view` !

```ligolang
@view
export const feedback = (_: unit, store: storage): string => { return store.feedback };
```

Compile the contract

```bash
TAQ_LIGO_IMAGE=ligolang/ligo:1.0.0 taq compile pokeGame.jsligo
```

(Optional) Write a unit test for the updated function `pokeAndGetFeedback`

## Step 5 : Write mutation tests :space_invader:

Ligo provides mutations testing through the Test library. Mutation test are like `testing your tests` to see if your unit tests coverage is strong enough.
Bugs, or mutants, are automatically inserted into your code. Your tests are run on each mutant.

If your tests fail then the mutant is killed. If your tests passed, the mutant survived.
The higher the percentage of mutants killed, the more effective your tests are.

> [Example of mutation for other languages] (https://stryker-mutator.io/docs/mutation-testing-elements/supported-mutators)

Create a file `mutation_pokeGame.jsligo`

```bash
taq create contract mutation_pokeGame.jsligo
```

Edit the file

```ligolang
#import "./pokeGame.jsligo" "PokeGame"

#import "./unit_pokeGame.jsligo" "PokeGameTest"

// reset state

const _ = Test.reset_state(2 as nat, list([]) as list<tez>);

const faucet = Test.nth_bootstrap_account(0);

const sender1: address = Test.nth_bootstrap_account(1);

const _1 = Test.log("Sender 1 has balance : ");

const _2 = Test.log(Test.get_balance_of_address(sender1));

const _3 = Test.set_baker(faucet);

const _4 = Test.set_source(faucet);

const _tests = (
  ta: typed_address<parameter_of PokeGame, PokeGame.storage>,
  _: michelson_contract<parameter_of PokeGame, PokeGame.storage>,
  _2: int
): unit => { return PokeGameTest._testPoke(ta, sender1); };

const test_mutation =
  (
    (): unit => {
      const mutationErrorList =
        Test.originate_and_mutate_all(
          contract_of(PokeGame),
          PokeGameTest.initial_storage,
          PokeGameTest.initial_tez,
          _tests
        );
      match(mutationErrorList) {
        when ([]):
          unit
        when ([head, ..._tail]):
          do {
            Test.log(head);
            Test.assert_with_error(false, Test.to_string(head[1]))
          }
      };
    }
  )();
```

Let's explain it first

- `#import <SRC_FILE> <NAMESPACE>` : import your source code that will be mutated and your unit tests. For more information [module doc](https://ligolang.org/docs/language-basics/modules)
- `const _tests = (ta: typed_address<parameter_of PokeGame, PokeGame.storage>, _: michelson_contract, _: int) : unit => {...` : you need to provide the test suite that will be run by the framework. Just point to the unit test you want to run.
- `const test_mutation = (() : unit => {` : this is the definition of the mutations tests
- `Test.originate_module_and_mutate_all(CONTRACT_TO_MUTATE, INIT_STORAGE, INIT_TEZ_COST, UNIT_TEST_TO_RUN)` : This will take the first argument as the source code to mutate and the last argument as unit test suite function to run over. It returns a list of mutations that succeed (if size > 0 then bad test coverage) or empty list (good, even mutants did not harm your code)

Run the test

```bash
TAQ_LIGO_IMAGE=ligolang/ligo:1.0.0 taq test mutation_pokeGame.jsligo
```

Output :

```logs
=== Error messages for mutation_pokeGame.jsligo ===
File "contracts/mutation_pokeGame.jsligo", line 43, characters 12-66:
 42 |             Test.log(head);
 43 |             Test.assert_with_error(false, Test.to_string(head[1]))
 44 |           }

Test failed with "Mutation at: File "contracts/pokeGame.jsligo", line 52, characters 15-66:
 51 |     when (None()):
 52 |       failwith("Cannot find view feedback on given oracle address")
 53 |   };

Replacing by: "Cannot find view feedback on given oracle addressCannot find view feedback on given oracle address".
"
Trace:
File "contracts/mutation_pokeGame.jsligo", line 43, characters 12-66 ,
File "contracts/mutation_pokeGame.jsligo", line 43, characters 12-66 ,
File "contracts/mutation_pokeGame.jsligo", line 28, character 2 to line 47, character 5


===
┌──────────────────────────┬──────────────────────┐
│ Contract                 │ Test Results         │
├──────────────────────────┼──────────────────────┤
│ mutation_pokeGame.jsligo │ Some tests failed :( │
└──────────────────────────┴──────────────────────┘
```

:space_invader: :space_invader: :space_invader: Holy :shit: , invaders !!! :space_invader: :space_invader: :space_invader:

What happened ?

The mutation has alterated a part of the code which we did not test, we were not covering it, so the unit test passed.

As we are lazy today, instead of fixing it, we will see that we can also tell the Library to ignore this.
Go to your source file pokeGame.jsligo, and annotate the function `pokeAndGetFeedback` with `@no_mutation`

```ligolang
@no_mutation
@entry
const pokeAndGetFeedback ...
```

Run again the mutation tests

```bash
TAQ_LIGO_IMAGE=ligolang/ligo:1.0.0 taq test mutation_pokeGame.jsligo
```

Output

```logs
┌──────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Contract                 │ Test Results                                                                                                                                   │
├──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ mutation_pokeGame.jsligo │ "Sender 1 has balance : "                                                                                                                      │
│                          │ 3800000000000mutez                                                                                                                             │
│                          │ "contract deployed with values : "                                                                                                             │
│                          │ KT1L8mCbuTJXKq3CDoHDxqfH5aj5sEgAdx9C(None)                                                                                                     │
│                          │ Success (1330n)                                                                                                                                │
│                          │ {feedback = "kiss" ; pokeTraces = [tz1hkMbkLPkvhxyqsQoBoLPqb1mruSzZx3zy -> {feedback = "" ; receiver = KT1L8mCbuTJXKq3CDoHDxqfH5aj5sEgAdx9C}]} │
│                          │ "Sender 1 has balance : "                                                                                                                      │
│                          │ 3800000000000mutez                                                                                                                             │
│                          │ Everything at the top-level was executed.                                                                                                      │
│                          │ - test_mutation exited with value ().                                                                                                          │
│                          │                                                                                                                                                │
│                          │ 🎉 All tests passed 🎉                                                                                                                         │
└──────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

We won :sunglasses: :wine_glass:

# :construction_worker: Dapp

## Step 1 : Reuse dapp from previous session

https://github.com/marigold-dev/training-dapp-1/tree/main/solution/app

## Step 2 : Redeploy new smart contract code

Redeploy a new version of the smart contract.

> Note : You can set `feedback` value to any action other than default `kiss` string :kissing: (it will be more fun for other to discover it)

```bash
TAQ_LIGO_IMAGE=ligolang/ligo:1.0.0 taq compile pokeGame.jsligo
taq generate types ./app/src
taq deploy pokeGame.tz -e "testing"
```

## Step 3 : Adapt the frontend application code

Edit `App.tsx`, and add new import

```typescript
import { address } from "./type-aliases";
```

Add new React variable after `userBalance` definition

```typescript
const [contractToPoke, setContractToPoke] = useState<string>("");
```

then change the poke function to set entrypoint to `pokeAndGetFeedback`

```typescript
//poke
const poke = async (
  e: React.FormEvent<HTMLFormElement>,
  contract: api.Contract
) => {
  e.preventDefault();
  let c: PokeGameWalletType = await Tezos.wallet.at("" + contract.address);
  try {
    const op = await c.methods
      .pokeAndGetFeedback(contractToPoke as address)
      .send();
    await op.confirmation();
    alert("Tx done");
  } catch (error: any) {
    console.log(error);
    console.table(`Error: ${JSON.stringify(error, null, 2)}`);
  }
};
```

Finally, change the display of the table

```html
<table><thead><tr><th>address</th><th>trace "contract - feedback - user"</th><th>action</th></tr></thead><tbody>
    {contracts.map((contract) => <tr><td style={{borderStyle: "dotted"}}>{contract.address}</td><td style={{borderStyle: "dotted"}}>{(contract.storage !== null && contract.storage.pokeTraces !== null && Object.entries(contract.storage.pokeTraces).length > 0)?Object.keys(contract.storage.pokeTraces).map((k : string)=>contract.storage.pokeTraces[k].receiver+" "+contract.storage.pokeTraces[k].feedback+" "+k+", "):""}</td><td style={{borderStyle: "dotted"}}><form onSubmit={(e) =>poke(e,contract)}><input type="text" onChange={e=>setContractToPoke(e.currentTarget.value)} placeholder='enter contract address here' /><button  type='submit'>Poke</button></form></td></tr>)}
    </tbody></table>
```

Relaunch the app

```bash
cd app
yarn install
yarn dev
```

On the listed contract, choose your line and input the address of the contract you will receive a feedback. Click on `poke`

![result](./doc/result.png)

This time, the logged user will receive a feedback from a targeted contract (as input of the form) via any listed contract (the first column of the table).

Refresh manually clicking on `Fetch contracts` button

:point_up: Poke other developer's contract to discover their contract hidden feedback when you poke them

# :palm_tree: Conclusion :sun_with_face:

Now, you are able to call other contracts, use views and test you smart contract before deploying it

On next training, you will learn how to use tickets

[:arrow_right: NEXT (HTML version)](https://marigold-dev.github.io/training-dapp-3)

[:arrow_right: NEXT (Github version)](https://github.com/marigold-dev/training-dapp-3)
