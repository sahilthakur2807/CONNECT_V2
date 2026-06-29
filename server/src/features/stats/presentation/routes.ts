import { Router } from 'express';
import { GetStatsQuery } from '../application/queries/GetStatsQuery.js';
import type { GetStatsQueryHandler } from '../application/queries/GetStatsQuery.js';

export function createStatsRouter(
  getStatsQueryHandler: GetStatsQueryHandler
): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const query = new GetStatsQuery();
      const result = await getStatsQueryHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
