import { useState } from 'react';
import './App.css';
import ConnectButton from './ConnectWallet';
import { TezosToolkit, WalletContract } from '@taquito/taquito';
import DisconnectButton from './DisconnectWallet';
import { Contract, ContractsService } from '@dipdup/tzkt-api';

import { PokeGameWalletType } from './pokeGame.types';
import { address } from './type-aliases';

function App() {
  
  const [Tezos, setTezos] = useState<TezosToolkit>(new TezosToolkit("https://ghostnet.tezos.marigold.dev"));
  const [wallet, setWallet] = useState<any>(null);
  const [userAddress, setUserAddress] = useState<string>("");
  const [userBalance, setUserBalance] = useState<number>(0);
  const [contractToPoke, setContractToPoke] = useState<string>("");
  
  
  const contractsService = new ContractsService( {baseUrl: "https://api.ghostnet.tzkt.io" , version : "", withCredentials : false});
  const [contracts, setContracts] = useState<Array<Contract>>([]);
  
  const fetchContracts = () => {
    (async () => {
      setContracts((await contractsService.getSimilar({address: process.env["REACT_APP_CONTRACT_ADDRESS"]!, includeStorage:true, sort:{desc:"id"}})));
    })();
  }
  
  //poke
  const poke = async (e :  React.FormEvent<HTMLFormElement>, contract : Contract) => {  
    e.preventDefault(); 
    let c : PokeGameWalletType = await Tezos.wallet.at(""+contract.address);
    try {
      const op = await c.methods.pokeAndGetFeedback(contractToPoke as address).send();
      await op.confirmation();
      alert("Tx done");
    } catch (error : any) {
      console.log(error);
      console.table(`Error: ${JSON.stringify(error, null, 2)}`);
    }
  };
  
  return (
    <div className="App">
    <header className="App-header">
    <p>
    
    <ConnectButton
    Tezos={Tezos}
    setWallet={setWallet}
    setUserAddress={setUserAddress}
    setUserBalance={setUserBalance}
    wallet={wallet}
    />
    
    <DisconnectButton
    wallet={wallet}
    setUserAddress={setUserAddress}
    setUserBalance={setUserBalance}
    setWallet={setWallet}
    />
    
    <div>
    I am {userAddress} with {userBalance} mutez
    </div>
    
    <br />
    <div>
    <button onClick={fetchContracts}>Fetch contracts</button>
    
    <table><thead><tr><th>address</th><th>trace "contract - feedback - user"</th><th>action</th></tr></thead><tbody>
    {contracts.map((contract) => <tr><td style={{borderStyle: "dotted"}}>{contract.address}</td><td style={{borderStyle: "dotted"}}>{(contract.storage !== null && contract.storage.pokeTraces !== null && Object.entries(contract.storage.pokeTraces).length > 0)?Object.keys(contract.storage.pokeTraces).map((k : string)=>contract.storage.pokeTraces[k].receiver+" "+contract.storage.pokeTraces[k].feedback+" "+k+","):""}</td><td style={{borderStyle: "dotted"}}><form onSubmit={(e) =>poke(e,contract)}><input type="text" onChange={e=>setContractToPoke(e.currentTarget.value)} placeholder='enter contract address here' /><button  type='submit'>Poke</button></form></td></tr>)}
    </tbody></table>
    
    </div>
    
    </p>
    
    </header>
    </div>
    );
  }
  
  export default App;