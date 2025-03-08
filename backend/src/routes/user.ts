import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { AddressBookController } from '../controllers/addressBookController';
import { UserClaimsController } from '../controllers/userClaimsController';
import { privyAuth, serviceAuth, basicPrivyAuth } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = Router();

router.use(setControllerContext('UserController'));

router.get('/me', privyAuth, UserController.getCurrentUser);
router.delete('/:userId', privyAuth, UserController.deleteUser);

router.get('/:userId/address-book', basicPrivyAuth, setControllerContext('AddressBookController'), AddressBookController.getAddressBook);
router.post('/:userId/address-book', basicPrivyAuth, setControllerContext('AddressBookController'), AddressBookController.addAddress);
router.put('/:userId/address-book/:addressId', basicPrivyAuth, setControllerContext('AddressBookController'), AddressBookController.updateAddress);
router.delete('/:userId/address-book/:addressId', basicPrivyAuth, setControllerContext('AddressBookController'), AddressBookController.deleteAddress);

router.get('/claims', privyAuth, setControllerContext('UserClaimsController'), UserClaimsController.getClaimStatus);

router.get('/:userId', serviceAuth, UserController.getUserById);

export { router as userRouter }; 