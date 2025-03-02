import { Router } from 'express';
import { NFTController } from '../controllers/nft';
import { privyAuth } from '../middleware/auth';

const router = Router();

// Public routes - use the router's get method correctly
router.get('/check/:address', NFTController.checkNFT as any);

// Protected routes (require authentication)
router.post('/airdrop', privyAuth, NFTController.checkAndAirdropNFT as any);

export { router as nftRouter }; 