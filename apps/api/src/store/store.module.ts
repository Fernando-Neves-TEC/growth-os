import { Global, Module } from "@nestjs/common";
import { InMemoryStore } from "./in-memory.store.js";

@Global()
@Module({
  providers: [{ provide: InMemoryStore, useClass: InMemoryStore }],
  exports: [InMemoryStore],
})
export class StoreModule {}
