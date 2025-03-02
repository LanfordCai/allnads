import { Router } from 'express';
import { NFTController } from '../controllers/nft';
import { privyAuth } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = Router();

// 添加控制器上下文中间件
router.use(setControllerContext('NFTController'));

// Public routes - use the router's get method correctly
router.get('/check/:address', NFTController.checkNFT);

// Protected routes (require authentication)
router.post('/airdrop', privyAuth, NFTController.checkAndAirdropNFT);

export { router as nftRouter }; 