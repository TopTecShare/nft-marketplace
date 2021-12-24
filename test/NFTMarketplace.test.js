const { expectRevert } = require('@openzeppelin/test-helpers');
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert');

const NFTCollection = artifacts.require('./NFTCollection.sol');
const NFTMarketplace = artifacts.require('./NFTMarketplace.sol');
// const time = require("../src/helpers/time");
const { time } = require("@openzeppelin/test-helpers");

contract('NFTMarketplace', (accounts) => {
  let nftContract;
  let mktContract;

  before(async () => {
    nftContract = await NFTCollection.new();

    const NFTaddress = nftContract.address;
    mktContract = await NFTMarketplace.new(NFTaddress);

    await nftContract.safeMint('testURI', 100); // royalty: 1%
    await nftContract.safeMint('testURI2', 100); // royalty: 1%
  });

  describe('Make Offer', () => {
    it('Requires the approval from the user', async () => {
      await expectRevert(mktContract.makeOffer(1, 10), 'ERC721: transfer caller is not owner nor approved');
    });

    before(async () => {
      await nftContract.approve(mktContract.address, 2);
      await mktContract.makeOffer(2, 10);
    })

    it('Transfers the ownership to this contract', async () => {
      const owner = await nftContract.ownerOf(2);
      assert.equal(owner, mktContract.address);
    });

    it('Creates an offer', async () => {
      const offer = await mktContract.offers(1);
      assert.equal(offer.offerId.toNumber(), 1);
      assert.equal(offer.id.toNumber(), 2);
      assert.equal(offer.user, accounts[0]);
      assert.equal(offer.price.toNumber(), 10);
      assert.equal(offer.fulfilled, false);
      assert.equal(offer.cancelled, false);
    });

    it('Emits an Event Offer', async () => {
      await nftContract.approve(mktContract.address, 1);
      const result = await mktContract.makeOffer(1, 20);
      const log = result.logs[0];
      assert.equal(log.event, 'Offer');
      const event = log.args;
      assert.equal(event.offerId.toNumber(), 2);
      assert.equal(event.id.toNumber(), 1);
      assert.equal(event.user, accounts[0]);
      assert.equal(event.price.toNumber(), 20);
      assert.equal(event.fulfilled, false);
      assert.equal(event.cancelled, false);
    });
  });

  describe('Fill Offer', () => {
    it('fills the offer and emits Event', async () => {
      const result = await mktContract.fillOffer(1, { from: accounts[1], value: 10 });
      const offer = await mktContract.offers(1);
      assert.equal(offer.fulfilled, true);
      const userFunds = await mktContract.userFunds(offer.user);
      assert.equal(userFunds.toNumber(), 10);

      const log = result.logs[0];
      assert.equal(log.event, 'OfferFilled');
      const event = log.args;
      assert.equal(event.offerId.toNumber(), 1);
    });

    it('The offer must exist', async () => {
      await expectRevert(mktContract.fillOffer(3, { from: accounts[1] }), 'The offer must exist');
    });

    it('The owner cannot fill it', async () => {
      await expectRevert(mktContract.fillOffer(2, { from: accounts[0] }), 'The owner of the offer cannot fill it');
    });

    it('Cannot be fulfilled twice', async () => {
      await expectRevert(mktContract.fillOffer(1, { from: accounts[1] }), 'An offer cannot be fulfilled twice');
    });

    it('A fulfilled order cannot be cancelled', async () => {
      await expectRevert(mktContract.cancelOffer(1, { from: accounts[0] }), 'A fulfilled offer cannot be cancelled');
    });

    it('The ETH sent should match the price', async () => {
      await expectRevert(mktContract.fillOffer(2, { from: accounts[1], value: 5 }), 'The ETH amount should match with the NFT Price');
    });
  });

  describe('Cancel Offer', () => {
    it('Only the owner can cancel', async () => {
      await expectRevert(mktContract.cancelOffer(2, { from: accounts[1] }), 'The offer can only be canceled by the owner');
    });

    it('Cancels the offer and emits Event', async () => {
      const result = await mktContract.cancelOffer(2, { from: accounts[0] });
      const offer = await mktContract.offers(2);
      assert.equal(offer.cancelled, true);

      const log = result.logs[0];
      assert.equal(log.event, 'OfferCancelled');
      const event = log.args;
      assert.equal(event.offerId.toNumber(), 2);
    });

    it('The offer must exist', async () => {
      await expectRevert(mktContract.cancelOffer(3, { from: accounts[0] }), 'The offer must exist');
    });

    it('Cannot be cancelled twice', async () => {
      await expectRevert(mktContract.cancelOffer(2, { from: accounts[0] }), 'An offer cannot be cancelled twice');
    });

    it('A cancelled offer cannot be fulfilled', async () => {
      await expectRevert(mktContract.fillOffer(2, { from: accounts[1] }), 'A cancelled offer cannot be fulfilled');
    });
  });

  describe('Claim funds', () => {
    it('Rejects users without funds to claim', async () => {
      await expectRevert(mktContract.claimFunds({ from: accounts[1] }), 'This user has no funds to be claimed');
    });

    it('Pays the correct amount and emits Event', async () => {
      const fundsBefore = await mktContract.userFunds(accounts[0]);
      const result = await mktContract.claimFunds({ from: accounts[0] });
      const fundsAfter = await mktContract.userFunds(accounts[0]);
      assert.equal(fundsBefore.toNumber(), 10);
      assert.equal(fundsAfter.toNumber(), 0);

      const log = result.logs[0];
      assert.equal(log.event, 'ClaimFunds');
      const event = log.args;
      assert.equal(event.user, accounts[0]);
      assert.equal(event.amount.toNumber(), 10);
    });
  });

  describe('Make Auction', () => {
    it('Make Auction', async () => {
      await nftContract.safeMint('testURI3', 100); // royalty: 1%
      await nftContract.approve(mktContract.address, 3);
      await mktContract.makeAuction(3, String(1.0 * 10 ** 18), 4);
      await mktContract.cancelAuction(3);
      await nftContract.approve(mktContract.address, 3);
      await mktContract.makeAuction(3, String(1.0 * 10 ** 18), 4);
      await mktContract.makeBid(3, { from: accounts[2], value: String(1.5 * 10 ** 18) });
      // await mktContract.cancelAuction(3);
      await mktContract.makeBid(3, { from: accounts[3], value: String(2.0 * 10 ** 18) });
      await mktContract.makeBid(3, { from: accounts[4], value: String(2.2 * 10 ** 18) });
      await time.increase(time.duration.days(1));
      await expectRevert(mktContract.makeBid(3, { from: accounts[5], value: String(3.0 * 10 ** 18) }), 'Auction has ended');
    })
  });
});