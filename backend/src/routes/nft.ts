import { Router } from 'express';
import { NFTController } from '../controllers/nft';
import { privyAuth } from '../middleware/auth';

const router = Router();

// Public routes - use the router's get method correctly
router.get('/check/:address', NFTController.checkNFT);

// Protected routes (require authentication)
router.post('/airdrop', privyAuth, NFTController.checkAndAirdropNFT);

export { router as nftRouter }; 