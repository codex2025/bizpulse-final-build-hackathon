import { json } from 'express';

/**
 * Reviewed CSV records travel back through the gateway on `ingest/apply-mapping`: up to 5,000 rows
 * from a CSV of up to 2 MB, which is several MB of JSON. Express's 100 KB default rejected ordinary
 * uploads with "request entity too large". The larger limit is scoped to that one route so every
 * other endpoint keeps the small default.
 */
export const APPLY_MAPPING_PATH = '/api/decision-forge/ingest/apply-mapping';
export const APPLY_MAPPING_LIMIT = '6mb';

/** Must run before the application's default body parser is registered (i.e. before `app.init()`). */
export function configureBodyLimits(app: {
  use: (path: string, handler: any) => any;
}) {
  const parse = json({ limit: APPLY_MAPPING_LIMIT });
  // The wrapper's NAME matters: Nest skips registering its own global JSON parser when it finds a
  // middleware called "jsonParser" (which is what body-parser's json() is named), and every other
  // route would then receive no parsed body at all.
  app.use(
    APPLY_MAPPING_PATH,
    function applyMappingBodyParser(req: any, res: any, next: any) {
      return parse(req, res, next);
    },
  );
}
