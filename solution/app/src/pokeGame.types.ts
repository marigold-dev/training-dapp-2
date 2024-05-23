
import { ContractAbstractionFromContractType, WalletContractAbstractionFromContractType } from './type-utils';
import { address, MMap, unit } from './type-aliases';

export type Storage = {
    pokeTraces: MMap<address, {
        receiver: address;
        feedback: string;
    }>;
    feedback: string;
};

type Methods = {
    pokeAndGetFeedback: (param: address) => Promise<void>;
    poke: () => Promise<void>;
};

export type PokeAndGetFeedbackParams = address
export type PokeParams = unit

type MethodsObject = {
    pokeAndGetFeedback: (param: address) => Promise<void>;
    poke: () => Promise<void>;
};

type contractTypes = { methods: Methods, methodsObject: MethodsObject, storage: Storage, code: { __type: 'PokeGameCode', protocol: string, code: object[] } };
export type PokeGameContractType = ContractAbstractionFromContractType<contractTypes>;
export type PokeGameWalletType = WalletContractAbstractionFromContractType<contractTypes>;
