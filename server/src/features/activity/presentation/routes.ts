import { Router } from 'express';
import { GetRecentActivityQuery } from '../application/queries/GetRecentActivityQuery.js';
import type { GetRecentActivityHandler } from '../application/queries/GetRecentActivityQuery.js';

export function createActivityRouter(
  getRecentActivityHandler: GetRecentActivityHandler
): Router {
  const router = Router();

  router.get('/recent', async (req, res, next) => {
    try {
      const query = new GetRecentActivityQuery();
      const result = await getRecentActivityHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
