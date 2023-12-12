---
title: "Part 2: Inter-contract calls and testing"
authors: "Benjamin Fuentes"
last_update:
  date: 28 November 2023
---

Previously, you learned how to create your first dApp.
In this second session, you will enhance your skills on:

- How to do inter-contract calls.
- How to use views.
- How to do unit & mutation tests.

On the first version of the poke game, you were able to poke any deployed contract. Now, you will add a new function to store on the trace an additional feedback message coming from another contract.

## Poke and Get Feedback sequence diagram

```mermaid
sequenceDiagram
  Note left of User: Prepare to poke Smartcontract2 though Smartcontract1
  User->>Smartcontract1: pokeAndGetFeedback(Smartcontract2)
  Smartcontract1->>Smartcontract2 : getFeedback()
  Smartcontract2->>Smartcontract1 : pokeAndGetFeedbackCallback([Tezos.get_self_address(),store.feedback])
  Note left of Smartcontract1: store Smartcontract2 address + feedback from Smartcontract2
```

## Get the code

Get the code from the first session: https://github.com/marigold-dev/training-dapp-1/blob/main/solution

```bash
git clone https://github.com/marigold-dev/training-dapp-1.git
```

Reuse the code from the previous smart contract: https://github.com/marigold-dev/training-dapp-1/blob/main/solution/contracts/pokeGame.jsligo

Install all libraries locally:

```bash
cd solution && npm i && cd app && yarn install && cd ..
```

## Modify the poke function

Change the storage to reflect the changes:

- If you poke directly, you just register the contract's owner address and no feedback.
- If you poke and ask to get feedback from another contract, then you register the other contract address and an additional feedback message.

Here the new sequence diagram of the poke function.

```mermaid
sequenceDiagram
  Note left of User: Prepare to poke Smartcontract1
  User->>Smartcontract1: poke()
  Note left of Smartcontract1: store User address + no feedback
```

1. Edit `./contracts/pokeGame.jsligo` and replace storage definition by this one:

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

1. Replace your poke function with theses lines:

   ```ligolang
   @entry
   const poke = (_ : unit, store : storage) : return_ => {
       let feedbackMessage = {receiver : Tezos.get_self_address() ,feedback: ""};
       return [  list([]) as list<operation>, {...store,
           pokeTraces : Map.add(Tezos.get_source(), feedbackMessage, store.pokeTraces) }];
   };
   ```

   Explanation:

   - `...store` do a copy by value of your object. [Have a look on the Functional updates documentation](https://ligolang.org/docs/language-basics/maps-records/#functional-updates). Note: you cannot do assignment like this `store.pokeTraces=...` in jsLigo, there are no concept of Classes, use `Functional updates` instead.
   - `Map.add(...`: Add a key, value entry to a map. For more information about [Map](https://ligolang.org/docs/language-basics/maps-records/#maps).
   - `export type storage = {...};` a `Record` type is declared, it is an [object structure](https://ligolang.org/docs/language-basics/maps-records#records).
   - `Tezos.get_self_address()` is a native function that returns the current contract address running this code. Have a look on [Tezos native functions](https://ligolang.org/docs/reference/current-reference).
   - `feedback: ""`: poking directly does not store feedbacks.

1. Edit `pokeGame.storageList.jsligo` to change the storage initialization.

   ```ligolang
   #import "pokeGame.jsligo" "Contract"

   const default_storage: Contract.storage = {
       pokeTraces: Map.empty as map<address, Contract.pokeMessage>,
       feedback: "kiss"
   };
   ```

1. Compile your contract.

   ```bash
   TAQ_LIGO_IMAGE=ligolang/ligo:1.1.0 taq compile pokeGame.jsligo
   ```

   Write a second function `pokeAndGetFeedback` involving the call to another contract a bit later, let's do unit testing first!

## Write unit tests

1. Add a new unit test smart-contract file `unit_pokeGame.jsligo`.

   ```bash
   taq create contract unit_pokeGame.jsligo
   ```

   > :information_source: Testing documentation can be found [here](https://ligolang.org/docs/advanced/testing)
   > :information_source: Test module with specific functions [here](https://ligolang.org/docs/reference/test)

1. Edit the file.

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

   Explanations:

   - `#import "./pokeGame.jsligo" "PokeGame"` to import the source file as module in order to call functions and use object definitions.
   - `export type main_fn` it will be useful later for the mutation tests to point to the main function to call/mutate.
   - `Test.reset_state ( 2...` this creates two implicit accounts on the test environment.
   - `Test.nth_bootstrap_account` this return the nth account from the environment.
   - `Test.to_contract(taddr)` and `Tezos.address(contr)` are util functions to convert typed addresses, contract and contract addresses.
   - `let _testPoke = (s : address) : unit => {...}` declaring function starting with `_` is escaping the test for execution. Use this to factorize tests changing only the parameters of the function for different scenarios.
   - `Test.set_source` do not forget to set this value for the transaction signer.
   - `Test.transfer_to_contract(CONTRACT, PARAMS, TEZ_COST)` A transaction to send, it returns an operation.
   - `Test.get_storage` this is how to retrieve the contract's storage.
   - `assert_with_error(CONDITION,MESSAGE)` Use assertion for unit testing.
   - `const testSender1Poke = ...` This test function will be part of the execution report.
   - `Test.originate_module(MODULE_CONVERTED_TO_CONTRACT,INIT_STORAGE, INIT_BALANCE)` It originates a smart contract into the Test environment. A module is converted to a smart contract.

1. Run the test.

   ```bash
   TAQ_LIGO_IMAGE=ligolang/ligo:1.1.0 taq test unit_pokeGame.jsligo
   ```

   Output should give you intermediary logs and finally the test results.

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

## Do an inter contract call

To keep things simple, 2 versions of the same smart contract are deployed to simulate inter-contract call and get the feedback message (cf. [sequence diagram](#poke-and-get-feedback-sequence-diagram)).

Create a new poke function `PokeAndGetFeedback: (other : address)` with a second part function `PokeAndGetFeedbackCallback: (feedback : returned_feedback)` as a callback. Calling a contract is asynchronous, this is the reason it is done in two times.

The function to call on the second contract is `GetFeedback: (contract_callback: oracle_param)` and returns a feedback message.

> Very often, this kind of contract is named an `Oracle`, because generally its storage is updated by an offchain scheduler and it exposes data to any onchain smart contracts.

1. Edit the file `pokeGame.jsligo`, to define new types:

   ```ligolang
   type returned_feedback = [address, string]; //address that gives feedback and a string message

   type oracle_param = contract<returned_feedback>;
   ```

   Explanations :

   - `type returned_feedback = [address, string]` the parameters of an oracle function always start with the address of the contract caller and followed by the return objects.
   - `type oracle_param = contract<returned_feedback>` the oracle parameters need to be wrapped inside a typed contract.

1. Write the missing functions, starting with `getFeedback`. Add this new function at the end of the file.

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

   - `Tezos.transaction(RETURNED_PARAMS,TEZ_COST,CALLBACK_CONTRACT)` the oracle function requires to return the value back to the contract caller that is passed already as first parameter.
   - `return [list([op]) ,store]` this time, you return a list of operations to execute, there is no need to update the contract storage (but it is a mandatory return object).

1. Add now, the first part of the function `pokeAndGetFeedback`.

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

   - `Tezos.get_entrypoint_opt("%getFeedback",oracleAddress)` you require to get the oracle contract address. Then you want to call a specific entrypoint of this contract. The function name is always starting with `%` with always the first letter in lowercase (even if the code is different).
   - `Tezos.transaction(((Tezos.self("%pokeAndGetFeedbackCallback") as contract<returned_feedback>)),TEZ_COST,call_to_oracle())` The transaction takes as first param the entrypoint of for the callback that the oracle uses to answer the feedback, the tez cost and the oracle contract you got just above as transaction destination.

1. Write the last missing function `pokeAndGetFeedbackCallback`, receive the feedback and finally store it.

   ```ligolang
   @entry
   const pokeAndGetFeedbackCallback = (feedback : returned_feedback, store : storage) : return_ => {
       let feedbackMessage = {receiver : feedback[0] ,feedback: feedback[1]};
       return [  list([]) as list<operation>, {...store,
           pokeTraces : Map.add(Tezos.get_source(), feedbackMessage , store.pokeTraces) }];
   };
   ```

   - `let feedbackMessage = {receiver : feedback[0] ,feedback: feedback[1]}` prepares the trace including the feedback message and the feedback contract creator.
   - `{...store,pokeTraces : Map.add(Tezos.get_source(), feedbackMessage , store.pokeTraces) }` add the new trace to the global trace map.

1. Compile the contract.

   > Note: Remove the file `pokeGame.parameterList.jsligo` to remove all unnecessary error logs as there is need to maintain this file anymore.

   ```bash
   TAQ_LIGO_IMAGE=ligolang/ligo:1.1.0 taq compile pokeGame.jsligo
   ```

1. (Optional) Write a unit test for this new function `pokeAndGetFeedback`.

## Use views instead of inter-contract call

As you saw on the previous step, inter-contract calls makes the business logic more complex but not only, [thinking about the cost is even worst](https://ligolang.org/docs/tutorials/inter-contract-calls/?lang=jsligo#a-note-on-complexity).

In this training, the oracle is providing a read-only storage that can be replaced by a `view` instead of a complex and costly callback.

[See documentation here about onchain views](https://ligolang.org/docs/protocol/hangzhou#on-chain-views).

```mermaid
sequenceDiagram
  Note left of User: Prepare to poke on Smartcontract1 and get feedback from Smartcontract2
  User->>Smartcontract1: pokeAndGetFeedback(Smartcontract2)
  Smartcontract1-->>Smartcontract2 : feedback()
  Smartcontract2-->>Smartcontract1 : [Smartcontract2,feedback]
  Note left of Smartcontract1:  store Smartcontract2 address + feedback from Smartcontract2
```

:warning: **Comment below functions (with `/* */` syntax or // syntax) or just remove it, it is no more useful** :warning:

- `pokeAndGetFeedbackCallback`
- `getFeedback`

1. Edit function `pokeAndGetFeedback` to call view instead of a transaction.

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

1. Declare the view at the end of the file. Do not forget the annotation `@view` !

   ```ligolang
   @view
   export const feedback = (_: unit, store: storage): string => { return store.feedback };
   ```

1. Compile the contract.

   ```bash
   TAQ_LIGO_IMAGE=ligolang/ligo:1.1.0 taq compile pokeGame.jsligo
   ```

1. (Optional) Write a unit test for the updated function `pokeAndGetFeedback`.

## Write mutation tests

Ligo provides mutations testing through the Test library. Mutation tests are like `testing your tests` to see if your unit tests coverage is strong enough. Bugs, or mutants, are automatically inserted into your code. Your tests are run on each mutant.

If your tests fail then the mutant is killed. If your tests passed, the mutant survived.
The higher the percentage of mutants killed, the more effective your tests are.

[Example of mutation features for other languages](https://stryker-mutator.io/docs/mutation-testing-elements/supported-mutators)

1. Create a file `mutation_pokeGame.jsligo`.

   ```bash
   taq create contract mutation_pokeGame.jsligo
   ```

1. Edit the file.

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

   Explanation:

   - `#import <SRC_FILE> <NAMESPACE>`: import your source code that will be mutated and your unit tests. For more information [module doc](https://ligolang.org/docs/language-basics/modules).
   - `const _tests = (ta: typed_address<parameter_of PokeGame, PokeGame.storage>, _: michelson_contract, _: int) : unit => {...`: you need to provide the test suite that will be run by the framework. Just point to the unit test you want to run.
   - `const test_mutation = (() : unit => {`: this is the definition of the mutations tests.
   - `Test.originate_module_and_mutate_all(CONTRACT_TO_MUTATE, INIT_STORAGE, INIT_TEZ_COST, UNIT_TEST_TO_RUN)`: This will take the first argument as the source code to mutate and the last argument as unit test suite function to run over. It returns a list of mutations that succeed (if size > 0 then bad test coverage) or empty list (good, even mutants did not harm your code).

1. Run the test.

   ```bash
   TAQ_LIGO_IMAGE=ligolang/ligo:1.1.0 taq test mutation_pokeGame.jsligo
   ```

   Output:

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

   Invaders are here.

   What happened ?

   The mutation has altered a part of the code which is not tested, it was not covered, so the unit test passed.

   For a short fix, tell the Library to ignore this function for mutants.

1. Go to your source file pokeGame.jsligo, and annotate the function `pokeAndGetFeedback` with `@no_mutation`.

   ```ligolang
   @no_mutation
   @entry
   const pokeAndGetFeedback ...
   ```

1. Run again the mutation tests.

   ```bash
   TAQ_LIGO_IMAGE=ligolang/ligo:1.1.0 taq test mutation_pokeGame.jsligo
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

## Update the frontend

1. Reuse the dApp files from [previous session](https://github.com/marigold-dev/training-dapp-1/tree/main/solution/app).

1. Redeploy a new version of the smart contract.

   > Note: You can set `feedback` value to any action other than default `kiss` string (it is more fun for other to discover it).

   ```bash
   TAQ_LIGO_IMAGE=ligolang/ligo:1.1.0 taq compile pokeGame.jsligo
   taq generate types ./app/src
   taq deploy pokeGame.tz -e "testing"
   ```

1. Adapt the frontend application code. Edit `App.tsx`, and add new import.

   ```typescript
   import { address } from "./type-aliases";
   ```

1. Add new React variable after `userBalance` definition.

   ```typescript
   const [contractToPoke, setContractToPoke] = useState<string>("");
   ```

1. Change the poke function to set entrypoint to `pokeAndGetFeedback`.

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

1. Change the display to a table changing `contracts.map...` by:

   ```html
   <table><thead><tr><th>address</th><th>trace "contract - feedback - user"</th><th>action</th></tr></thead><tbody>
       {contracts.map((contract) => <tr><td style={{borderStyle: "dotted"}}>{contract.address}</td><td style={{borderStyle: "dotted"}}>{(contract.storage !== null && contract.storage.pokeTraces !== null && Object.entries(contract.storage.pokeTraces).length > 0)?Object.keys(contract.storage.pokeTraces).map((k : string)=>contract.storage.pokeTraces[k].receiver+" "+contract.storage.pokeTraces[k].feedback+" "+k+", "):""}</td><td style={{borderStyle: "dotted"}}><form onSubmit={(e) =>poke(e,contract)}><input type="text" onChange={e=>setContractToPoke(e.currentTarget.value)} placeholder='enter contract address here' /><button  type='submit'>Poke</button></form></td></tr>)}
       </tbody></table>
   ```

1. Relaunch the app.

   ```bash
   cd app
   yarn install
   yarn dev
   ```

   On the listed contract, choose your line and input the address of the contract you will receive a feedback. Click on `poke`.

   ![The dApp page showing the result of the poke action](/img/tutorials/dapp-result.png).

   This time, the logged user will receive a feedback from a targeted contract (as input of the form) via any listed contract (the first column of the table).

1. Refresh manually clicking on `Fetch contracts` button.

   Poke other developer's contract to discover their contract hidden feedback when you poke them.

## Summary

Now, you are able to call other contracts, use views and test you smart contract before deploying it.

On next training, you will learn how to use tickets.

When you are ready, continue to [Part 3: Tickets](./part-3).
