import { z } from 'zod';

/** Railway y otros entornos pueden definir variables vacías: se tratan como ausentes. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
    /** Puerto HTTP/2 sin TLS (h2c) para clientes gRPC nativos. Opcional. */
    GRPC_PORT: optional(z.coerce.number().int().min(1).max(65_535)),
    DATABASE_URL: optional(z.url({ protocol: /^postgres(ql)?$/ })),
    /** Orígenes permitidos separados por comas. Admite `*` como comodín. */
    CORS_ORIGIN: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim().replace(/\/$/, ''))
          .filter(Boolean),
      ),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Obligatoria en producción',
      });
    }
    if (env.CORS_ORIGIN.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'Obligatoria en producción' });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Valida `process.env` y termina con un mensaje claro si algo falta. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
