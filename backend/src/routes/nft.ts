import { Router } from 'express';
import { NFTController } from '../controllers/nft';
import { privyAuth, basicPrivyAuth } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = Router();

router.use(setControllerContext('NFTController'));

// Template route
router.get('/templates', basicPrivyAuth, NFTController.getAllTemplates);

router.get('/check/:address', privyAuth, NFTController.checkNFT);

router.post('/airdrop', privyAuth, NFTController.checkAndAirdropNFT);

export { router as nftRouter }; 