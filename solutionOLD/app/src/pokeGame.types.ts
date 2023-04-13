
import { ContractAbstractionFromContractType, WalletContractAbstractionFromContractType } from './type-utils';
import { address, MMap } from './type-aliases';

export type Storage = {
    feedback: string;
    pokeTraces: MMap<address, {
        feedback: string;
        receiver: address;
    }>;
};

type Methods = {
    poke: () => Promise<void>;
    pokeAndGetFeedback: (param: address) => Promise<void>;
};

type MethodsObject = {
    poke: () => Promise<void>;
    pokeAndGetFeedback: (param: address) => Promise<void>;
};

type contractTypes = { methods: Methods, methodsObject: MethodsObject, storage: Storage, code: { __type: 'PokeGameCode', protocol: string, code: object[] } };
export type PokeGameContractType = ContractAbstractionFromContractType<contractTypes>;
export type PokeGameWalletType = WalletContractAbstractionFromContractType<contractTypes>;
