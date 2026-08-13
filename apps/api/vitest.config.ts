import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 15000,
  },
  // NestJS depende de decorator metadata para injeção de dependência.
  // Esbuild não emite por padrão — habilitar explicitamente.
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        target: "es2022",
      },
    },
  },
});
