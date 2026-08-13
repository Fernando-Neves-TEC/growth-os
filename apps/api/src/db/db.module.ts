import { Global, Module } from "@nestjs/common";
import { Pool } from "pg";

export const PG_POOL = Symbol("PG_POOL");

const DEFAULT_DB_URL = "postgresql://growthos:growthos@localhost:5433/growthos";

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        // O Pool conecta de forma preguiçosa (primeira query) — boot não depende do banco.
        return new Pool({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DB_URL, max: 10 });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}
