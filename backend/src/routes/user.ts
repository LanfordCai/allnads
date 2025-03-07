import { Router } from 'express';
import { UserController } from '../controllers/user';
import { AddressBookController } from '../controllers/addressBook';
import { UserClaimsController } from '../controllers/userClaims';
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

// 地址簿路由
router.get('/address-book', privyAuth, setControllerContext('AddressBookController'), AddressBookController.getAddressBook);
router.post('/address-book', privyAuth, setControllerContext('AddressBookController'), AddressBookController.addAddress);
router.put('/address-book/:addressId', privyAuth, setControllerContext('AddressBookController'), AddressBookController.updateAddress);
router.delete('/address-book/:addressId', privyAuth, setControllerContext('AddressBookController'), AddressBookController.deleteAddress);

// 奖励领取路由
router.get('/claims', privyAuth, setControllerContext('UserClaimsController'), UserClaimsController.getClaimStatus);

// 管理员路由 (这里仅作示例，实际应该添加管理员权限检查中间件)
router.get('/:userId', privyAuth, UserController.getUserById);

export { router as userRouter }; 