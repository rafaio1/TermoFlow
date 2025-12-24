import { Router } from 'express';
import { OrganizationController } from '../controllers/OrganizationController';

const createOrganizationsRouter = (organizationController: OrganizationController): Router => {
  const router = Router();

  router.get('/', organizationController.getOrganizations.bind(organizationController));
  router.post('/', organizationController.createOrganization.bind(organizationController));
  router.patch('/:id', organizationController.updateOrganization.bind(organizationController));
  router.delete('/:id', organizationController.deleteOrganization.bind(organizationController));

  return router;
};

export default createOrganizationsRouter;
