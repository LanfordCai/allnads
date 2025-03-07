import { Router } from 'express';
import { UserController } from '../controllers/user';
import { AddressBookController } from '../controllers/addressBook';
import { UserClaimsController } from '../controllers/userClaims';
import { privyAuth, serviceAuth } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = Router();

router.use(setControllerContext('UserController'));

router.get('/me', privyAuth, UserController.getCurrentUser);
router.delete('/:userId', privyAuth, UserController.deleteUser);

router.get('/address-book', privyAuth, setControllerContext('AddressBookController'), AddressBookController.getAddressBook);
router.post('/address-book', privyAuth, setControllerContext('AddressBookController'), AddressBookController.addAddress);
router.put('/address-book/:addressId', privyAuth, setControllerContext('AddressBookController'), AddressBookController.updateAddress);
router.delete('/address-book/:addressId', privyAuth, setControllerContext('AddressBookController'), AddressBookController.deleteAddress);

router.get('/claims', privyAuth, setControllerContext('UserClaimsController'), UserClaimsController.getClaimStatus);

router.get('/:userId', serviceAuth, UserController.getUserById);

export { router as userRouter }; 