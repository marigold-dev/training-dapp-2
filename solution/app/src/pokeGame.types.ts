import { MMap, address } from "./type-aliases";
import {
  ContractAbstractionFromContractType,
  WalletContractAbstractionFromContractType,
} from "./type-utils";

export type Storage = {
  pokeTraces: MMap<
    address,
    {
      receiver: address;
      feedback: string;
    }
  >;
  feedback: string;
};

type Methods = {
  pokeAndGetFeedback: (param: address) => Promise<void>;
  poke: () => Promise<void>;
};

type MethodsObject = {
  pokeAndGetFeedback: (param: address) => Promise<void>;
  poke: () => Promise<void>;
};

type contractTypes = {
  methods: Methods;
  methodsObject: MethodsObject;
  storage: Storage;
  code: { __type: "PokeGameCode"; protocol: string; code: object[] };
};
export type PokeGameContractType =
  ContractAbstractionFromContractType<contractTypes>;
export type PokeGameWalletType =
  WalletContractAbstractionFromContractType<contractTypes>;
