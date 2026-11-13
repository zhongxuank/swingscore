import { createMemoryStore } from "./memory-store";
import { runContestStoreContract } from "./store.contract";

runContestStoreContract("in-memory", () => createMemoryStore());
