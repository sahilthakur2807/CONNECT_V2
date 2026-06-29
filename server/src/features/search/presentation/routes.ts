import { Router } from 'express';
import { SearchQuery } from '../application/queries/SearchQuery.js';
import type { SearchQueryHandler } from '../application/queries/SearchQuery.js';

export function createSearchRouter(
  searchQueryHandler: SearchQueryHandler
): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const { q } = req.query;
      const query = new SearchQuery(q as string);
      const result = await searchQueryHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
