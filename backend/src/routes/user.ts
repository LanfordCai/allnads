import { Router } from 'express';
import { UserController } from '../controllers/user';
import { privyAuth } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = Router();

// 添加控制器上下文中间件
router.use(setControllerContext('UserController'));

// 公共路由
// (无)

// 受保护的路由 (需要 Privy 认证)
router.get('/me', privyAuth, UserController.getCurrentUser);
router.delete('/:userId', privyAuth, UserController.deleteUser);

// 管理员路由 (这里仅作示例，实际应该添加管理员权限检查中间件)
router.get('/:userId', privyAuth, UserController.getUserById);

export { router as userRouter }; 