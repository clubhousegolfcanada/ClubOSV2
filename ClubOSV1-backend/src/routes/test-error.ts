import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

const router = Router();

// Test route that throws an error (with asyncHandler)
router.get('/throw-error', asyncHandler(async (req: Request, res: Response) => {
  throw new Error('Test error - should be caught by asyncHandler');
}));

// Test route that succeeds
router.get('/success', asyncHandler(async (req: Request, res: Response) => {
  const data = { message: 'Success!', timestamp: new Date() };
  return ApiResponse.success(res, data, 'Operation successful');
}));

// Test route with database error
router.get('/db-error', asyncHandler(async (req: Request, res: Response) => {
  const { pool } = require('../utils/db');
  // Intentionally bad query
  await pool.query('SELECT * FROM non_existent_table');
  return ApiResponse.success(res, null);
}));

export default router;