import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import {
  validateCreateUser,
  validateUpdateUser,
  validateGetUser,
  validateDeleteUser,
  validateResetPassword,
  validateSearchUsers,
  validatePagination,
  validateBulkUpdate,
  validateApproveReject,
  validateExportUsers,
  validateUserActivity
} from '../validators/userValidators';

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

// Public routes (authenticated users)
router.get('/me', userController.getCurrentUser);
router.get('/search', validate(validateSearchUsers), userController.searchUsers);

// Admin only routes
router.use(roleGuard(['admin']));

// User management
router.get('/', validate(validatePagination), userController.getAllUsers);
router.get('/count', userController.getUserCount);
router.get('/pending', userController.getPendingUsers);
router.get('/export', validate(validateExportUsers), userController.exportUsers);
router.get('/:userId', validate(validateGetUser), userController.getUserById);
router.get('/:userId/activity', validate(validateUserActivity), userController.getUserActivity);

router.post('/', validate(validateCreateUser), userController.createUser);
router.put('/:userId', validate(validateUpdateUser), userController.updateUser);
router.delete('/:userId', validate(validateDeleteUser), userController.deleteUser);

// User actions
router.post('/:userId/reset-password', validate(validateResetPassword), userController.resetUserPassword);
router.put('/:userId/approve', validate(validateApproveReject), userController.approveUser);
router.put('/:userId/reject', validate(validateApproveReject), userController.rejectUser);

// Bulk operations
router.post('/bulk-update', validate(validateBulkUpdate), userController.bulkUpdateUsers);

export default router;