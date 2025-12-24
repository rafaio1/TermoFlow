import { Router } from 'express';
import { ItemController } from '../controllers/ItemController';

const createItemsRouter = (itemController: ItemController): Router => {
  const router = Router();

  router.get('/', itemController.getItems.bind(itemController));
  router.post('/', itemController.createItem.bind(itemController));

  return router;
};

export default createItemsRouter;
