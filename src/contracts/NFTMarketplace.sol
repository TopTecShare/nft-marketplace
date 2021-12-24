// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFTCollection.sol";

contract NFTMarketplace {
    uint256 public offerCount;
    uint256 marketFee = 250;
    mapping(uint256 => _Offer) public offers;
    mapping(address => uint256) public userFunds;
    mapping(uint256 => Auction) public nftAuctions;
    NFTCollection nftCollection;
    address private _owner;

    struct _Offer {
        uint256 offerId;
        uint256 id;
        uint256 price;
        address user;
        bool fulfilled;
        bool cancelled;
    }

    struct Auction {
        //map token ID to
        uint256 buyNowPrice;
        uint256 nftHighestBid;
        uint256 auctionEnd;
        address nftHighestBidder;
        address nftSeller;
    }

    event Offer(
        uint256 offerId,
        uint256 id,
        address user,
        uint256 price,
        bool fulfilled,
        bool cancelled
    );

    event NftAuctionCreated(
        uint256 auctionEnd,
        uint256 buyNowPrice,
        uint256 tokenId,
        address nftSeller
    );

    event NftAuctionCanceled(uint256 tokenId, address nftSeller);
    event NftAuctionSettled(
        uint256 tokenId,
        address nftSeller,
        uint256 buyNowPrice,
        address winner,
        uint256 price
    );

    event BidCreated(
        uint256 tokenId,
        uint256 nftHighestBid,
        address nftHighestBidder,
        uint256 auctionEnd
    );

    event BidCanceled(uint256 tokenId);

    event OfferFilled(uint256 offerId, uint256 id, address newOwner);
    // event OfferUpdated(uint256 offerId, uint256 price);
    event OfferCancelled(uint256 offerId, uint256 id, address owner);
    event ClaimFunds(address user, uint256 amount);

    constructor(address _nftCollection) {
        nftCollection = NFTCollection(_nftCollection);
        _owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner);
        _;
    }

    function _marketTransfer(
        uint256 _price,
        uint256 _tokenId,
        address _receiver
    ) internal {
        require(_price > 0);
        uint256 royalty = nftCollection.royalty(_tokenId);
        address inventor = nftCollection.inventor(_tokenId);
        userFunds[_owner] += (_price * marketFee) / 10000;
        userFunds[inventor] += (_price * royalty) / 10000;
        userFunds[_receiver] +=
            _price -
            (_price * (marketFee + royalty)) /
            10000;
    }

    function makeOffer(uint256 _id, uint256 _price) public {
        nftCollection.transferFrom(msg.sender, address(this), _id);
        offerCount++;
        offers[offerCount] = _Offer(
            offerCount,
            _id,
            _price,
            msg.sender,
            false,
            false
        );
        emit Offer(offerCount, _id, msg.sender, _price, false, false);
    }

    function fillOffer(uint256 _offerId) public payable {
        _Offer storage _offer = offers[_offerId];
        require(_offer.offerId == _offerId, "The offer must exist");
        require(
            _offer.user != msg.sender,
            "The owner of the offer cannot fill it"
        );
        require(!_offer.fulfilled, "An offer cannot be fulfilled twice");
        require(!_offer.cancelled, "A cancelled offer cannot be fulfilled");

        require(
            msg.value + userFunds[msg.sender] >= _offer.price,
            "The ETH amount should match with the NFT Price"
        );
        nftCollection.transferFrom(address(this), msg.sender, _offer.id);
        _offer.fulfilled = true;
        _marketTransfer(msg.value, _offer.id, _offer.user);
        userFunds[msg.sender] -= _offer.price - msg.value;
        emit OfferFilled(_offerId, _offer.id, msg.sender);
    }

    function cancelOffer(uint256 _offerId) public {
        _Offer storage _offer = offers[_offerId];
        require(_offer.offerId == _offerId, "The offer must exist");
        require(
            _offer.user == msg.sender,
            "The offer can only be canceled by the owner"
        );
        require(
            _offer.fulfilled == false,
            "A fulfilled offer cannot be cancelled"
        );
        require(
            _offer.cancelled == false,
            "An offer cannot be cancelled twice"
        );
        nftCollection.transferFrom(address(this), msg.sender, _offer.id);
        _offer.cancelled = true;
        emit OfferCancelled(_offerId, _offer.id, msg.sender);
    }

    function updateOffer(uint256 _offerId, uint256 _price) public {
        _Offer storage _offer = offers[_offerId];
        require(_offer.offerId == _offerId, "The offer must exist");
        require(
            _offer.user == msg.sender,
            "The offer can only be updated by the owner"
        );
        require(
            _offer.fulfilled == false,
            "A fulfilled offer cannot be updated"
        );

        _offer.price = _price;
        emit Offer(_offerId, _offer.id, msg.sender, _price, false, false);
    }

    function makeAuction(
        uint256 _tokenId,
        uint256 _price,
        uint256 period
    ) public {
        nftCollection.transferFrom(msg.sender, address(this), _tokenId);

        nftAuctions[_tokenId].buyNowPrice = _price;
        nftAuctions[_tokenId].auctionEnd = block.timestamp + period * 1 hours;
        nftAuctions[_tokenId].nftSeller = msg.sender;

        emit NftAuctionCreated(
            nftAuctions[_tokenId].auctionEnd,
            _price,
            _tokenId,
            msg.sender
        );
    }

    function cancelAuction(uint256 _tokenId) public {
        require(
            nftAuctions[_tokenId].nftSeller != msg.sender,
            "The only owner of the auction can cancel it"
        );
        require(
            nftAuctions[_tokenId].nftHighestBid <
                nftAuctions[_tokenId].buyNowPrice,
            "The bid must not exist"
        );
        nftCollection.transferFrom(address(this), msg.sender, _tokenId);

        nftAuctions[_tokenId].buyNowPrice = 0;
        nftAuctions[_tokenId].auctionEnd = 0;
        nftAuctions[_tokenId].nftSeller = address(0);

        emit NftAuctionCanceled(_tokenId, msg.sender);
    }

    function settleAuction(uint256 _tokenId) public {
        require(
            nftAuctions[_tokenId].nftSeller != address(0),
            "The auction must exist"
        );
        require(
            nftAuctions[_tokenId].auctionEnd > block.timestamp,
            "Auction should be ended"
        );

        emit NftAuctionSettled(
            _tokenId,
            nftAuctions[_tokenId].nftSeller,
            nftAuctions[_tokenId].buyNowPrice,
            nftAuctions[_tokenId].nftHighestBidder,
            nftAuctions[_tokenId].nftHighestBid
        );

        if (nftAuctions[_tokenId].nftHighestBidder != address(0)) {
            _marketTransfer(
                nftAuctions[_tokenId].nftHighestBid -
                    nftAuctions[_tokenId].nftHighestBid /
                    10,
                _tokenId,
                nftAuctions[_tokenId].nftSeller
            );
        }

        nftAuctions[_tokenId].buyNowPrice = 0;
        nftAuctions[_tokenId].auctionEnd = 0;
        nftAuctions[_tokenId].nftSeller = address(0);
        nftAuctions[_tokenId].nftHighestBid = 0;
        nftAuctions[_tokenId].nftHighestBidder = address(0);
    }

    function makeBid(uint256 _tokenId) public payable {
        require(
            nftAuctions[_tokenId].nftSeller != address(0),
            "The auction must exist"
        );
        require(
            nftAuctions[_tokenId].auctionEnd > block.timestamp,
            "Auction has ended"
        );
        require(
            nftAuctions[_tokenId].nftSeller != msg.sender,
            "The owner of the auction cannot bid it"
        );
        uint256 limit = nftAuctions[_tokenId].nftHighestBid;
        if (limit < nftAuctions[_tokenId].buyNowPrice) {
            if (limit / 10 > 0.01 ether) limit = (limit * 11) / 10;
            else limit += 0.01 ether;
        } else limit = nftAuctions[_tokenId].buyNowPrice;
        require(
            msg.value >= limit,
            "The ETH amount should be more than 110% of NFT highest bid Price"
        );

        address _receiver = nftAuctions[_tokenId].nftHighestBidder;
        if (_receiver == address(0))
            _receiver = nftAuctions[_tokenId].nftSeller;
        else
            userFunds[_receiver] =
                nftAuctions[_tokenId].nftHighestBid -
                nftAuctions[_tokenId].nftHighestBid /
                10;
        _marketTransfer(msg.value / 10, _tokenId, _receiver);

        nftAuctions[_tokenId].nftHighestBidder = msg.sender;
        nftAuctions[_tokenId].nftHighestBid = uint256(msg.value);
        if (nftAuctions[_tokenId].auctionEnd < block.timestamp + 10 minutes)
            nftAuctions[_tokenId].auctionEnd = block.timestamp + 10 minutes;

        emit BidCreated(
            _tokenId,
            nftAuctions[_tokenId].nftHighestBid,
            msg.sender,
            nftAuctions[_tokenId].auctionEnd
        );
    }

    function cancelBid(uint256 _tokenId) public {
        require(
            nftAuctions[_tokenId].nftSeller != address(0),
            "The auction must exist"
        );
        require(
            nftAuctions[_tokenId].auctionEnd > block.timestamp,
            "Auction has ended"
        );
        require(
            msg.sender == nftAuctions[_tokenId].nftHighestBidder,
            "Only highest bidder can cancel the bid"
        );

        userFunds[msg.sender] =
            nftAuctions[_tokenId].nftHighestBid -
            nftAuctions[_tokenId].nftHighestBid /
            10;
        nftAuctions[_tokenId].nftHighestBidder = address(0);
        nftAuctions[_tokenId].nftHighestBid = 0;

        emit BidCanceled(_tokenId);
    }

    function claimFunds() public {
        require(
            userFunds[msg.sender] > 0,
            "This user has no funds to be claimed"
        );
        payable(msg.sender).transfer(userFunds[msg.sender]);
        emit ClaimFunds(msg.sender, userFunds[msg.sender]);
        userFunds[msg.sender] = 0;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        _owner = newOwner;
    }

    // Fallback: reverts if Ether is sent to this smart-contract by mistake
    fallback() external {
        revert();
    }
}
