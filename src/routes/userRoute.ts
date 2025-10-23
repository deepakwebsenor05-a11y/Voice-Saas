import express from 'express';
import { createUser, loginUser, getAllUsers, logoutUser, forgotPassword, resetPassword, getCurrentUser } from '../controller/userController';
import { isAdmin, verifyToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', createUser);
router.post('/login', loginUser);
router.get('/getAll', verifyToken, isAdmin, getAllUsers);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', verifyToken, getCurrentUser);

export default router;
