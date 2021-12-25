const { expectRevert, time, ether, expectEvent } = require('@openzeppelin/test-helpers');
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert');

const NFTCollection = artifacts.require('./NFTCollection.sol');
const NFTMarketplace = artifacts.require('./NFTMarketplace.sol');

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
    before(async () => {
      await nftContract.safeMint('testURI3', 100); // royalty: 1%
    })

    it('Creates an Auction and Emits an Event Auction', async () => {
      await nftContract.approve(mktContract.address, 3);
      const result = await mktContract.makeAuction(3, ether('0.2'), 4);

      expectEvent(result, 'NftAuctionCreated', {
        buyNowPrice: ether('0.2'),
        tokenId: '3',
        nftSeller: accounts[0],
      });
    });
  });

  describe('Cancel Auction', () => {
    it('Cancels an Auction and Emits an Event Cancel Auction', async () => {
      const result = await mktContract.cancelAuction(3);
      expectEvent(result, 'NftAuctionCanceled', {
        tokenId: '3',
        nftSeller: accounts[0],
      });
    });
    it('Rejects Cancels an Auction for not owner', async () => {
      await expectRevert(mktContract.cancelAuction(3), "The only owner of the auction can cancel it");
      await nftContract.approve(mktContract.address, 3);
      await mktContract.makeAuction(3, ether('0.2'), 4);
      await expectRevert(mktContract.cancelAuction(3, { from: accounts[5] }), "The only owner of the auction can cancel it");
    })
    it('Rejects Cancels an Auction after bid created', async () => {
      await mktContract.makeBid(3, { from: accounts[7], value: String(1.5 * 10 ** 18) });
      await expectRevert(mktContract.cancelAuction(3), "The bid must not exist");
    })
  });

  describe('Make bid', () => {
    it('Make a bid and Emits an Event Make bid', async () => {
      const fundsBefore = await mktContract.userFunds(accounts[7]);
      assert.equal(fundsBefore, '0');
      const result = await mktContract.makeBid(3, { from: accounts[3], value: String(2.0 * 10 ** 18) });
      expectEvent(result, 'BidCreated', {
        tokenId: '3',
        nftHighestBid: String(2.0 * 10 ** 18),
        nftHighestBidder: accounts[3],
      });
    })

    it('Refund 10% to auction creator from first bidder', async () => {
      const funds = await mktContract.userFunds(accounts[0]);
      assert.equal(funds, String(1.5 * 10 ** 18 * 0.1)); // No fee because, marketplace owner and token minter
    })

    it('Refund 10% to previous bidder', async () => {
      const fundsAfter = await mktContract.userFunds(accounts[7]);
      assert.equal(fundsAfter, String((1.5 * 0.9 + 2.0 * 0.1) * 10 ** 18));
    })

    it('Rejects Make a bid for non existing Auction', async () => {
      await expectRevert(mktContract.makeBid(2, { from: accounts[4], value: String(2.5 * 10 ** 18) }), "The auction must exist");
    })

    it('Rejects Make a bid for owner of Auction', async () => {
      await expectRevert(mktContract.makeBid(3, { value: String(2.5 * 10 ** 18) }), "The owner of the auction cannot bid it");
    })

    it('Rejects Make a bid for no more 110% bid price', async () => {
      await expectRevert(mktContract.makeBid(3, { from: accounts[4], value: String(2.19 * 10 ** 18) }), "The ETH amount should be more than 110% of NFT highest bid Price");
    })

    it('Rejects Make a bid after bid period', async () => {
      await time.increase(time.duration.days(1));
      await expectRevert(mktContract.makeBid(3, { from: accounts[4], value: String(2.5 * 10 ** 18) }), "Auction has ended");
    })

  });

  describe('Cancel bid', () => {

  });
});